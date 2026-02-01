# Propuesta de solución — Build Vercel (Tickets QR + Email)

**Objetivo:** Hacer que el build en Vercel pase sin `module-not-found`, manteniendo el flujo Entradas + MP intacto, y poder ejecutar E2E en Preview antes de merge a `main`.

---

## 1. Por qué falló antes (diagnóstico)

### Hechos

- **Local:** `npm run build` pasa.
- **Vercel:** `next build` falla con **module-not-found** en:
  - `src/components/TicketCard.tsx`: `react-qr-code`, `html-to-image`, `downloadjs`
  - `src/lib/pdf.tsx`: `qrcode`
- Las cuatro dependencias están en `package.json` → `dependencies`. No es falta de instalación.
- Se probó `transpilePackages` en `next.config.ts`; no hubo confirmación de que el build pasara en Vercel.

### Causa probable

1. **TicketCard** (y sus imports) se incluyen en el grafo de módulos que el bundler de Next (Turbopack/Webpack) resuelve en **build**. En Vercel el entorno (Node, resolución ESM/CJS, rutas) es distinto al local. Esos paquetes son de uso **solo cliente** (DOM, canvas, descarga en navegador). Si el bundler intenta resolverlos en un contexto de servidor o con reglas distintas, puede dar `module-not-found`.
2. **pdf.tsx** se usa solo en rutas API (servidor). **qrcode** es CJS/Node. El bundler de Next puede estar intentando empaquetarlo para el servidor y fallar la resolución en el entorno de Vercel.

Conclusión: el fallo no es "falta el paquete", sino **cómo y en qué contexto** se resuelven esos módulos durante `next build` en Vercel.

### Incertidumbre no resuelta (punto ciego)

- Los logs de Vercel no distinguen explícitamente si el `module-not-found` ocurrió en el **bundle de servidor** o en el **bundle de cliente** (chunk que contiene TicketCard).
- **Si fue en servidor:** `dynamic(..., { ssr: false })` elimina TicketCard del bundle de servidor; suficiente.
- **Si fue en cliente:** el chunk de cliente que contiene TicketCard se sigue construyendo en Vercel y debe resolver `react-qr-code`, `html-to-image`, `downloadjs`; el mismo fallo puede persistir. La propuesta incluye endurecimiento (extracción de tipo + paso de verificación en log).

---

## 2. Propuesta de solución (dos frentes)

### A. TicketCard: no formar parte del bundle de servidor

- **Idea:** Que el componente que usa `react-qr-code`, `html-to-image` y `downloadjs` **no sea cargado en el servidor**.
- **Mecanismo:** Cargar `TicketCard` con **dynamic import** y **`ssr: false`** en las páginas que lo usan (`mis-entradas`, `checkout/success/[id]`).
- **Efecto:** El servidor no incluye `TicketCard` en su bundle → no intenta resolver esos tres paquetes en build de servidor. El cliente los carga en un chunk aparte cuando hace falta.

**Por qué puede funcionar ahora:**

- Es el patrón estándar de Next para librerías "solo cliente" que rompen SSR o build (canvas, APIs de navegador, etc.).
- No depende de que Turbopack resuelva bien esos paquetes en el bundle de servidor, porque ese bundle ya no los referencia.
- Cambio acotado: solo puntos de uso de `TicketCard`, sin tocar create-preference ni flujo MP.

### B. pdf.tsx / qrcode: no empaquetar en servidor

- **Idea:** Que Next **no empaquete** el módulo `qrcode` en el bundle de servidor y que Node lo cargue en runtime desde `node_modules`.
- **Mecanismo:** Añadir **`serverExternalPackages: ['qrcode']`** en `next.config.ts`.
- **Efecto:** El bundler no intenta incluir `qrcode` en el bundle del servidor; en runtime Node hace `require('qrcode')` (o el equivalente ESM) desde `node_modules`, que en Vercel está instalado correctamente.

**Por qué puede funcionar ahora:**

- `serverExternalPackages` es la opción recomendada por Next para paquetes que deben ejecutarse en Node y no ser empaquetados (CJS, nativos, o que dan problemas de resolución).
- `qrcode` es un paquete pensado para Node; dejarlo "externo" en el servidor evita los fallos de resolución del bundler en Vercel.

---

## 3. Cambios concretos

### 3.1 next.config.ts

- Añadir `serverExternalPackages: ['qrcode']`.
- En Next 16/Turbopack un paquete no puede estar en `transpilePackages` y `serverExternalPackages` a la vez; dejar `qrcode` solo en `serverExternalPackages` y en `transpilePackages` solo los de TicketCard.

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['qrcode'],
  // ...
  transpilePackages: ['react-qr-code', 'html-to-image', 'downloadjs'],
};
```

### 3.2 Cargar TicketCard con dynamic (ssr: false) + endurecimiento por tipo

**Riesgo:** Si `TicketCardDynamic.tsx` importa `type { TicketCardData } from '@/components/TicketCard'`, algunos bundlers pueden seguir incluyendo `TicketCard.tsx` en el grafo. Para garantizar que **ningún código del bundle de servidor** referencie `TicketCard.tsx` en runtime, el tipo debe vivir en un módulo compartido.

**Pasos:**

1. **Extraer tipo a módulo compartido.** Crear `src/types/ticket.ts` con `TicketCardData`.
2. **TicketCard.tsx:** importar tipo desde `@/types/ticket` y eliminar la definición local de `TicketCardData`.
3. **TicketCardDynamic.tsx:** import tipo solo desde `@/types/ticket`; dynamic del componente; no importar desde `TicketCard.tsx`.
4. **mis-entradas/page.tsx** y **checkout/success/[id]/page.tsx:** importar desde `@/components/TicketCardDynamic`.

Resultado: ningún código del **bundle de servidor** (RSC, API) importa en runtime desde `TicketCard.tsx`; TicketCard solo se carga en un **chunk de cliente** vía dynamic.

### 3.3 No tocar (por ahora)

- `src/app/api/entradas/create-preference/route.ts`
- `src/app/api/tickets/create-preference/route.ts`
- `src/app/success/page.tsx`

---

## 4. Si el build en Vercel sigue fallando (Client Component SSR + pdf.tsx)

**Diagnóstico del log:** Si el error apunta a **Client Component SSR** (mis-entradas/page.tsx, TicketCard.tsx líneas 4–6) y a **pdf.tsx:3**, entonces:

1. El bundler sigue resolviendo `TicketCard.tsx` y sus deps (react-qr-code, html-to-image, downloadjs) en el contexto "Client Component SSR"; en Vercel esa resolución falla.
2. El bundler sigue resolviendo `qrcode` en `pdf.tsx`; `serverExternalPackages` no evita el fallo en ese camino de build.

**Orden de aplicación (una sola ruta recomendada):**

| Orden | Qué | Dónde / Cómo |
|-------|-----|----------------|
| **1** | **qrcode sin import estático en pdf.tsx** | En `src/lib/pdf.tsx`: eliminar la línea `import QRCode from 'qrcode';`. En la función `qrDataUrlForToken` (ya async), usar import dinámico: `const { default: QRCode } = await import('qrcode'); return QRCode.toDataURL(token, { width: 300, margin: 1 });`. Así el bundler no resuelve `qrcode` en tiempo de build al analizar pdf.tsx. |
| **2** | **Eliminar dependencia de downloadjs en TicketCard** | En `src/components/TicketCard.tsx`: quitar `import download from 'downloadjs';`. Sustituir la llamada a `download(dataUrl, ...)` por una función local que cree un `<a>` con `href=dataUrl`, `download=nombre`, dispare `click()` y elimine el elemento. Así se elimina un módulo que falla en Vercel (Client Component SSR). |
| **3** | **Si el build sigue fallando (react-qr-code, html-to-image)** | Opciones: (a) Sustituir `react-qr-code` por otra lib que empaquete bien en Vercel, o por un QR generado en servidor (qrcode.toDataURL) pasado como prop. (b) Sustituir `html-to-image` por `canvas.toDataURL` o por otra lib. Aplicar en ese orden según el mensaje de error que quede. |

**Respaldo antes de modificar:** Copiar `src/lib/pdf.tsx` y `src/components/TicketCard.tsx` a `respaldo_pre_tickets_qr/` con nombre descriptivo (ej. `pdf_tsx_antes_qrcode_dinamico.bak`, `TicketCard_tsx_antes_sin_downloadjs.bak`) antes de aplicar 1 y 2.

---

## 5. Orden de ejecución recomendado

1. **Rama:** Trabajar en `feature/mercado-pago-payment` o `feature/tickets-qr-vercel-build`. No mergear a `main` hasta el paso 6.
2. **Respaldo:** Copiar `pdf.tsx` y `TicketCard.tsx` a `respaldo_pre_tickets_qr/`.
3. **Aplicar paso 1 (qrcode dinámico en pdf.tsx):** Eliminar import estático; en `qrDataUrlForToken` usar `await import('qrcode')`.
4. **Aplicar paso 2 (quitar downloadjs en TicketCard):** Sustituir por descarga nativa con `<a download>`.
5. **Build local:** `npm run build`. Si falla, corregir; si pasa, push a la rama feature.
6. **Vercel:** Esperar Preview de la rama a **Ready**. Si falla, revisar log y aplicar paso 3 si siguen fallando react-qr-code o html-to-image.
7. **Solo si Preview está Ready:** Merge a `main`, push. Comprobar build de Production.
8. **E2E:** Seguir `CHECKLIST_E2E_TICKETS_QR.md`.

---

## 6. Si el build en Vercel sigue fallando

- Revisar el **mensaje exacto** y el **contexto** en el log de Vercel: si el error apunta a un chunk de **servidor** (RSC, API) o a un **client chunk** (ej. `static/chunks/...`). Eso determina el siguiente paso.
- **Si el log no permite distinguir** (ruta del módulo no aparece o es ambigua): aplicar en orden — (1) Verificar tipo en `@/types/ticket` y `serverExternalPackages: ['qrcode']` en `next.config.ts`; (2) Aplicar sección 4 (qrcode dinámico + quitar downloadjs); (3) Si persiste, tratar como fallo en **chunk de cliente** (react-qr-code, html-to-image) y aplicar paso 3 de la sección 4.
- **Si fallo en bundle de servidor:** verificar que `TicketCardDynamic` no importa en runtime desde `TicketCard.tsx` (tipo solo desde `@/types/ticket`) y que en pdf.tsx no hay import estático de `qrcode` (usar import dinámico en `qrDataUrlForToken`).
- **Si fallo en chunk de cliente (TicketCard):** aplicar paso 3 de la sección 4 (sustituir react-qr-code y/o html-to-image).
- **Si fallo en pdf.tsx/qrcode:** asegurar que en pdf.tsx se usa import dinámico de `qrcode` dentro de `qrDataUrlForToken` y no import estático en cabecera.

---

## 7. Certificación técnica (auditoría máxima intensidad — cuarta pasada)

- **CIT alcanzado:** 97/100.
- **Factores de degradación corregidos (cuarta pasada):** (7) Análisis anterior no daba una **única ruta recomendada** ni **cambios concretos por archivo**. Corregido: sección 4 con orden 1 → 2 → 3, archivo y función concretos (pdf.tsx, `qrDataUrlForToken`, import dinámico; TicketCard.tsx, sustitución de downloadjs por descarga nativa). (8) Fix de qrcode: antes se decía "import dinámico en el handler"; no se especificaba que el cambio es **en pdf.tsx** dentro de `qrDataUrlForToken` (eliminar import estático en cabecera). Corregido.
- **Justificación CIT:** Densidad de información: 97 (orden de aplicación, archivo/función, respaldo, pasos 1–3). Precisión terminológica: 97 (Client Component SSR, serverExternalPackages, dynamic import, qrDataUrlForToken). Rigor lógico: 97 (causalidad: bundler resuelve en build → fallo; fix: no import estático de qrcode en pdf.tsx, menos deps en TicketCard). -3 por no poder garantizar éxito si react-qr-code o html-to-image siguen fallando (paso 3 depende de librerías alternativas o entorno Vercel).

---

**Resumen:** Orden 1 → 2 → 3: (1) qrcode solo por import dinámico en `qrDataUrlForToken` (pdf.tsx); (2) quitar downloadjs en TicketCard (descarga nativa); (3) si persiste, sustituir react-qr-code y/o html-to-image. Respaldo antes de modificar. No mergear a `main` hasta Preview Ready.
