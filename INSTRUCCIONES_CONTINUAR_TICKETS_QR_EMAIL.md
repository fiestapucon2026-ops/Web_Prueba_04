# Instrucciones para continuar — Módulo Tickets QR + Email

**Copia y pega este documento como primer mensaje en un nuevo chat de Cursor para continuar sin perder el avance.**

**AVISO:** Un chat anterior llegó a ~95% de contexto sin avances demostrables: build falló en Vercel (module-not-found), se mergeó a main sin Preview OK y hubo que revertir main. **Leer la sección FRACASOS** (más abajo) antes de tocar create-preference o hacer merge.

**CRÍTICO:** Antes de modificar `create-preference` (entradas o tickets), leer **ADVERTENCIAS — Regresión create-preference** y la tabla **Restaurar flujo Entradas + MP si vuelve 502**.

---

## Resumen ejecutivo

- **Módulo:** Generación de tickets con QR real + email único por compra
- **Estado:** Implementado en rama `feature/mercado-pago-payment`; **build pasa en local** (`npm run build`), **falla en Vercel** (module-not-found: `react-qr-code`, `html-to-image`, `downloadjs`, `qrcode`). **Production (`main`) revertida** al punto anterior al merge — sin /entradas en producción.
- **Pendiente:** Resolver build en Vercel en la rama feature → Preview OK → merge a main → pruebas E2E.
- **Herramientas E2E:** Checklist (`CHECKLIST_E2E_TICKETS_QR.md`) y script (`npm run verify:tickets-qr`) listos.
- **LEER PRIMERO:** Sección **FRACASOS** (más abajo) para no repetir el camino que consumió ~95% de contexto sin avances demostrables.

---

## Cómo hacer prueba E2E

### Opción A: Servidor local (sin webhook MP)
```bash
npm run dev
# Abrir: http://localhost:3000/entradas
```

### Opción B: Vercel Preview (recomendado para E2E completo)
```bash
git add -A && git commit -m "feat: módulo tickets QR + email" && git push
# La URL de preview aparece en Vercel dashboard o en el output del push
# Ejemplo: https://web-oficial-festival-git-feature-xxx.vercel.app/entradas
```

### URLs para pruebas (sustituir BASE por localhost:3000 o tu preview)
| Página | URL |
|--------|-----|
| Entradas | `{BASE}/entradas` |
| Success (MP redirige aquí) | `{BASE}/success?external_reference=UUID&status=approved` |
| Mis entradas | `{BASE}/mis-entradas?token=TOKEN` |
| API access-token | `{BASE}/api/orders/access-token?external_reference=UUID` |

---

## Contexto del proyecto

- **Proyecto:** web_oficial_festival (Festival Pucón 2026)
- **Stack:** Next.js 16, TypeScript (strict), Tailwind, Vercel, Mercado Pago, Supabase, Resend, qrcode
- **Regla de oro:** Página de inicio, módulo MP y módulo de venta de tickets son **INTOCABLES** (en producción).
- **QR:** debe identificar cada entrada individual (`ticket.id`), no la compra.
- **QR se genera:** solo tras respuesta exitosa de MP (webhook `approved` → tickets creados → luego QR/PDF/email).

---

## Protocolo obligatorio (antes de modificar archivos)

1. **Backup primero:** Antes de modificar cualquier archivo existente, crear copia en `respaldo_pre_tickets_qr/`.
2. **Luego modificar:** Ya con el respaldo, proceder con todos los cambios necesarios.
3. **Si algo falla:** Restaurar desde el backup y empezar de nuevo.
4. **Claridad > 95%:** Si no hay suficiente claridad del problema, preguntar al usuario; no suponer.

---

## Estado actual: IMPLEMENTADO EN FEATURE; BUILD FALLA EN VERCEL

El módulo de tickets con QR real y email único por compra está **implementado** en la rama `feature/mercado-pago-payment`. El **build pasa en local** (`npm run build`); en **Vercel falla** por module-not-found (`react-qr-code`, `html-to-image`, `downloadjs`, `qrcode`) hasta que se resuelva con `transpilePackages` o `dynamic` + `ssr: false`. Production (`main`) está revertida al punto anterior al merge.

### Archivos modificados (tienen backup en `respaldo_pre_tickets_qr/`)

| Archivo | Cambio |
|---------|--------|
| `src/app/api/orders/[id]/route.ts` | Consulta tabla `tickets`, devuelve N tickets con `qr_token = signTicket(ticket.id, ticketType.name)` |
| `src/lib/pdf.tsx` | QR real por ticket con `qrcode`, `generateTicketsPDF(items)`, `generateTicketPDF(order, ticketId)` |
| `src/lib/email.ts` | Nueva función `sendPurchaseEmail(to, token, itemsSummary, pdfBuffer?)` |
| `src/app/api/tickets/generate-pdf/route.ts` | Usa `generateTicketsPDF` con tickets de la orden |
| `src/app/api/webhooks/mercadopago/route.ts` | Un email por compra (agrupa por `external_reference`), enlace "Mis entradas" + PDF único adjunto |
| `src/app/success/page.tsx` | Lee `external_reference` de searchParams, pide token, redirige a `/mis-entradas?token=` |
| `src/app/api/entradas/create-preference/route.ts` | Corrección de tipos (mpBody para PreferenceRequest) |
| `src/lib/admin-session-edge.ts` | Corrección de tipos (crypto.subtle.sign BufferSource) |
| `tsconfig.json` | `exclude`: supabase, respaldo_pre_tickets_qr, respaldo_mod_venta_tickets |

### Archivos nuevos (sin backup previo necesario)

| Archivo | Uso |
|---------|-----|
| `src/lib/security/access-token.ts` | `createAccessToken(ref)`, `verifyAccessToken(token)` — TTL 7 días |
| `src/app/api/orders/by-reference/route.ts` | GET `?token=XXX` — órdenes+tickets pagados, rate limit 10 req/min |
| `src/app/api/orders/by-reference/pdf/route.ts` | GET `?token=XXX` — PDF único con todos los tickets |
| `src/app/api/orders/access-token/route.ts` | GET `?external_reference=XXX` — devuelve token para "Mis entradas" |
| `src/app/mis-entradas/page.tsx` | Página con token en query, lista de TicketCards, botón "Descargar PDF" |

### Backups disponibles

```
respaldo_pre_tickets_qr/
├── admin_session_edge.ts.bak
├── email.ts.bak
├── entradas_create_preference_route.ts.bak
├── entradas_create_preference_route_antes_auto_return.bak   ← VERSIÓN OPERATIVA entradas (restaurar si 502)
├── orders_id_route.ts.bak
├── orders_id_route_MODIFICADO.ts
├── pdf.tsx.bak
├── success_page.tsx.bak
├── success_page_antes_venta_exitosa.bak
├── success_page_antes_tickets_visibles.bak                  ← VERSIÓN OPERATIVA success (Venta exitosa + polling)
├── tickets_generate_pdf_route.ts.bak
├── webhooks_mercadopago_route.ts.bak
└── archivos_nuevos/
```

**IMPORTANTE:** `src/app/api/tickets/create-preference/route.ts` **NO tiene backup** en `respaldo_pre_tickets_qr/`. Antes de modificar ese archivo, crear copia manual, ej.: `cp src/app/api/tickets/create-preference/route.ts respaldo_pre_tickets_qr/tickets_create_preference_route.ts.bak`

**Restaurar flujo Entradas + MP si vuelve 502:**

| Archivo actual | Restaurar desde |
|----------------|-----------------|
| `src/app/api/entradas/create-preference/route.ts` | `respaldo_pre_tickets_qr/entradas_create_preference_route_antes_auto_return.bak` |
| `src/app/api/tickets/create-preference/route.ts` | Revertir manualmente: `baseUrl = process.env.NEXT_PUBLIC_BASE_URL \|\| 'https://www.festivalpucon.cl'`, `back_urls` inline en body, catch solo `console.error` y mensaje genérico 502 (sin devolver mensaje de MP al cliente). |
| `src/app/success/page.tsx` | `respaldo_pre_tickets_qr/success_page_antes_tickets_visibles.bak` |

---

## Flujo implementado

1. **Pago MP aprobado** → Webhook recibe evento
2. **Webhook:** Actualiza órdenes a `paid`, crea filas en `tickets`
3. **Webhook:** Agrupa por `external_reference`, genera `generateTicketsPDF(items)` con QR real por ticket
4. **Webhook:** `createAccessToken(external_reference)` + `sendPurchaseEmail(to, token, itemsSummary, pdfBuffer)`
5. **Usuario** recibe 1 email con enlace `/mis-entradas?token=XXX` y PDF adjunto
6. **Página /success:** Si tiene `external_reference` y `status=approved`, obtiene token y redirige a `/mis-entradas?token=`
7. **Página /mis-entradas:** Muestra TicketCards con QR, botón "Descargar PDF (todas las entradas)"

---

## Variables de entorno necesarias

- `QR_SIGNING_SECRET` — firma QR y token de acceso
- `RESEND_API_KEY` — envío de emails
- `NEXT_PUBLIC_BASE_URL` — URL base para enlaces
- `NEXT_PUBLIC_SUCCESS_REDIRECT_URL` (opcional)
- `NEXT_PUBLIC_SUCCESS_REDIRECT_SECONDS` (opcional)

---

## Qué seguir (próximos pasos)

| Prioridad | Tarea | Estado | Descripción |
|-----------|-------|--------|-------------|
| **1** | **Pruebas E2E** | ✅ Herramientas listas | Checklist y script creados. Ver abajo. |
| **2** | **Cerrar módulo** | Pendiente | Actualizar `PROMPT_MODULO_TICKETS_QR_EMAIL.md`: marcar **TERMINADO**. Documentar **doble ratificación**. |
| **3** | **Verificación pre-producción** | Pendiente | Confirmar `NEXT_PUBLIC_BASE_URL`; dominio Resend. |
| **4** | **back_urls de MP** | Pendiente | Verificar URLs success en `create-preference`. |
| **5** | **Decisión /checkout/success/[id]** | Pendiente | Confirmar si se mantiene o se depreca. |

### Herramientas E2E (Prioridad 1 — listas)

- **`CHECKLIST_E2E_TICKETS_QR.md`** — Checklist paso a paso: env, webhook, compra MP, /success → /mis-entradas, PDF, email, BD.
- **`npm run verify:tickets-qr`** — Script que verifica APIs:
  - Sin servidor: solo comprueba que las rutas existan (400 esperado sin params).
  - Con `EXTERNAL_REF=uuid`: prueba access-token → by-reference → by-reference/pdf.

```bash
# Verificación básica (servidor debe estar corriendo)
npm run verify:tickets-qr

# Verificación completa (con orden pagada)
EXTERNAL_REF=tu-external-reference-uuid npm run verify:tickets-qr

# En Vercel Preview
VERIFY_URL=https://tu-preview.vercel.app EXTERNAL_REF=xxx npm run verify:tickets-qr
```

### Archivos con regla de doble ratificación (no modificar sin acuerdo explícito)

- `src/lib/pdf.tsx`
- `src/lib/email.ts`
- `src/lib/security/qr-signer.ts`
- `src/lib/security/access-token.ts`
- `src/app/api/webhooks/mercadopago/route.ts`
- `src/app/api/orders/[id]/route.ts`
- `src/app/api/orders/by-reference/route.ts`
- `src/app/api/orders/by-reference/pdf/route.ts`
- `src/app/api/orders/access-token/route.ts`
- `src/app/mis-entradas/page.tsx`

---

## Comandos útiles

```bash
# Verificar build
npm run build

# Verificar APIs del módulo Tickets QR (servidor debe estar corriendo)
npm run verify:tickets-qr
EXTERNAL_REF=uuid-orden-pagada npm run verify:tickets-qr

# Restaurar un archivo desde backup (ejemplo)
cp respaldo_pre_tickets_qr/pdf.tsx.bak src/lib/pdf.tsx
```

---

## Referencias

- `PROMPT_MODULO_TICKETS_QR_EMAIL.md` — Especificación original del módulo
- `CHECKLIST_E2E_TICKETS_QR.md` — Checklist E2E para pruebas del flujo completo
- `.cursorrules` — Protocolo del proyecto (análisis → propuesta → autorización → ejecución)
- `RESUMEN_PARA_NUEVO_CHAT.md` — Estado general del módulo de venta

---

## ADVERTENCIAS — Regresión create-preference (no repetir)

**Origen:** En un chat anterior se modificaron las rutas de create-preference y el flujo Entradas → MP dejó de funcionar (502, "auto_return invalid. back_url.success must be defined"). Se recuperó la operatividad restaurando desde respaldos. Las advertencias siguientes se basan solo en lo ocurrido.

### Hechos ocurridos (resumen)

1. **Estado operativo previo:** Flujo Entradas → formulario "Datos para tu entrada" → Continuar → MP → compra exitosa. Módulo entradas + MP 100% operativo.
2. **Cambios que provocaron la regresión:**
   - **entradas/create-preference:** Se añadió `auto_return: 'approved'` en todos los entornos (se eliminó la condición `isProduction`). Se añadió normalización de `baseUrl` (trim, comprobación URL absoluta, fallback `http://localhost:3000`). Se añadieron `console.log` de back_urls en dev.
   - **tickets/create-preference:** Se añadió normalización de `baseUrl` y fallback a `http://localhost:3000`. Se cambió el default de `baseUrl` de `'https://www.festivalpucon.cl'` a `'http://localhost:3000'`. Se introdujo variable `backUrls` y `console.log`. En el catch se devolvió el mensaje de MP al cliente en dev.
3. **Efecto:** POST `/api/entradas/create-preference` devolvió 502. El frontend mostró "auto_return invalid. back_url.success must be defined".
4. **Restauración que devolvió la operatividad:**
   - `src/app/api/entradas/create-preference/route.ts` ← contenido de `respaldo_pre_tickets_qr/entradas_create_preference_route_antes_auto_return.bak`
   - `src/app/api/tickets/create-preference/route.ts` ← revertido manualmente (sin .bak): `baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl'`, `back_urls` inline en el body, catch con solo `console.error` y mensaje genérico 502
   - `src/app/success/page.tsx` ← contenido de `respaldo_pre_tickets_qr/success_page_antes_tickets_visibles.bak`
5. **Resultado tras restauración:** Flujo operativo de nuevo (usuario confirmó paso a MP y compra exitosa).

### Advertencias técnicas (obligatorias para el próximo chat)

1. **No modificar `src/app/api/entradas/create-preference/route.ts` ni `src/app/api/tickets/create-preference/route.ts`** sin:
   - Crear backup de **ambos** archivos antes (tickets no tiene .bak en la carpeta de respaldo; crear uno).
   - Hacer **un solo cambio a la vez** (entradas o tickets, no ambos en la misma iteración).
   - Probar de inmediato: Entradas → elegir fecha y entrada → Continuar → comprobar que no aparece 502 ni mensaje de MP en el frontend.

2. **No volver a aplicar** en entradas create-preference:
   - `auto_return: 'approved'` en todos los entornos (la versión operativa usa `...(isProduction ? { auto_return: 'approved' } : {})`).
   - Normalización de `baseUrl` con fallback a `http://localhost:3000` (la versión operativa usa `(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').trim()` y `baseUrl.replace(/\/$/, '')` para las URLs, sin comprobación de URL absoluta ni reasignación).

3. **No volver a aplicar** en tickets create-preference:
   - Cambio del default de `baseUrl` de `'https://www.festivalpucon.cl'` a `'http://localhost:3000'`.
   - Normalización con `trim`, comprobación `^https?:\/\/`, fallback y `replace(/\/$/, '')`.
   - Variable `backUrls` separada y `console.log` de back_urls.
   - En el catch, devolver al cliente el mensaje de MP en dev (la versión operativa devuelve mensaje genérico siempre).

4. **Si aparece 502 en POST `/api/entradas/create-preference`:**
   - Revertir **de inmediato** los últimos cambios en entradas y tickets create-preference (usar respaldos y/o reversión manual indicada arriba).
   - No añadir más cambios (logs, mensajes de error, etc.) antes de haber restaurado y comprobado que el flujo vuelve a funcionar.

5. **Flujo que dispara create-preference:** El POST a create-preference **no** se ejecuta al abrir la URL `/entradas`. Se ejecuta solo cuando el usuario completa paso 3 ("Datos para tu entrada") y envía el formulario (botón Continuar). Las advertencias de consola (CSS, HMR) al cargar la página son independientes de create-preference.

### Respaldo de tickets create-preference (crear si se va a editar)

No existe `tickets_create_preference_route.ts.bak` en `respaldo_pre_tickets_qr/`. Antes de editar `src/app/api/tickets/create-preference/route.ts`:

```bash
cp src/app/api/tickets/create-preference/route.ts respaldo_pre_tickets_qr/tickets_create_preference_route.ts.bak
```

---

## FRACASOS — Chat (contexto ~95% sin avances demostrables)

**Objetivo de ese chat:** Poner en marcha tickets con QR y email en Vercel; resolver 404 en `https://web-prueba-04.vercel.app/entradas` y que MP redirija a /success.

### Qué se hizo (resumen)

1. **Documentación:** Referencias oficiales MP Chile (`back_urls`/`auto_return`), solución multi-dominio (BASE desde request), análisis E2E auditado.
2. **Código:** `src/lib/base-url.ts` (`getBaseUrlFromRequest`), uso en `entradas/create-preference` y `tickets/create-preference` para BASE dinámico. Respaldo previo de ambos create-preference.
3. **Deploy:** Merge de `feature/mercado-pago-payment` en `main` y push a `main` para que Production (web-prueba-04) tuviera `/entradas`.
4. **Build en Vercel:** Los despliegues de `main` (y Preview de feature) fallaron con **Build Failed** — `npm run build` exited with 1. Error: **module-not-found** en:
   - `./src/components/TicketCard.tsx` (líneas 5–6): `react-qr-code`, `html-to-image`, `downloadjs`
   - `./src/lib/pdf.tsx` (línea 3): `qrcode`
5. **Intentos de corrección:** Se añadió en `next.config.ts`: `turbopack.root: process.cwd()` y `transpilePackages: ['react-qr-code', 'html-to-image', 'downloadjs', 'qrcode']`. Se hizo push a `main`. No hubo confirmación de que el build pasara en Vercel tras eso.

### Resultado (fracaso)

- **404 en `/entradas`** en web-prueba-04.vercel.app siguió (Production siguió sirviendo el deployment anterior, sin /entradas, porque los nuevos builds fallaban).
- **Ninguna prueba E2E** completada en Vercel.
- **Sin avances demostrables** en producción ni en Preview.

### Lecciones para NO repetir

1. **No hacer merge a `main` sin comprobar antes que el build pase en Vercel.** Probar en un **Preview** de la rama feature y confirmar que el build termina en **Ready** antes de mergear. Si el build falla en Preview, corregir ahí (module-not-found → `transpilePackages` o `dynamic(..., { ssr: false })` para `TicketCard`/`pdf.tsx`) y solo después mergear.
2. **module-not-found en Vercel (pero no en local):** Turbopack/Webpack en Vercel resuelve distinto. Opciones: `transpilePackages` en `next.config`, o cargar componentes que usan `react-qr-code`/`html-to-image`/`downloadjs`/`qrcode` con `dynamic(..., { ssr: false })` para no empaquetarlos en el bundle del servidor.
3. **Orden de trabajo:** Primero **build en Preview OK** → luego merge a main. Nunca al revés.
4. **Respaldo antes de tocar create-preference:** Crear `tickets_create_preference_route.ts.bak` y respaldo de entradas create-preference si se vuelve a tocar.

### Avances que SÍ se pueden salvar (para el próximo intento)

| Qué | Dónde / Cómo |
|-----|----------------|
| Documentación MP Chile y multi-dominio | `docs/REFERENCIAS_MP_CHILE_BACK_URLS.md`, `docs/SOLUCION_MULTI_DOMINIO_VERCEL.md` (si existen). Si no, recrear desde la idea: BASE desde request. |
| Función BASE dinámico | `src/lib/base-url.ts` (`getBaseUrlFromRequest`) — está en la rama `feature/mercado-pago-payment`. Reutilizar al retomar. |
| Respaldo create-preference | `respaldo_pre_tickets_qr/tickets_create_preference_route.ts.bak`, `entradas_create_preference_route_antes_base_dinamico.bak` (si se crearon). |
| Análisis E2E | Cualquier `ANALISIS_PROFUNDO_INTEGRACION_E2E_AUDITADO.md` o equivalente — referencias de URLs, webhook, flujo. |

Nada de lo anterior está “en producción”; todo vive en la rama feature o en archivos de docs/respaldos. No hay que “salvar” nada en main; main ya está en punto cero.

### Punto cero (estado actual y cómo partir de cero)

- **`main` (remoto):** Revertida al commit anterior al merge (ej. f378d84). Production sirve el deployment sin /entradas, sin Build Failed.
- **`feature/mercado-pago-payment`:** Sigue con todos los cambios (entradas, mis-entradas, base-url, next.config con transpilePackages, etc.). **Para partir de cero en esa rama también:** hacer `git checkout feature/mercado-pago-payment`, luego `git reset --hard main` (o al commit que se quiera usar como base) — **esto borra los cambios de la feature en local**; si se quiere conservar el código para retomar, no hacer reset de la feature, solo usarla para arreglar el build y volver a intentar el merge.

**Pasos recomendados para el próximo intento (sin repetir fracasos):**

1. Trabajar siempre en `feature/mercado-pago-payment` (o rama derivada).
2. Resolver **module-not-found** en Vercel: `transpilePackages` o `dynamic` con `ssr: false` en `TicketCard` y en el uso de `qrcode` en `pdf.tsx`.
3. Confirmar que el **Preview** de esa rama en Vercel pasa a **Ready** (build OK).
4. Solo entonces: merge a `main` y push.
5. Ejecutar pruebas E2E según `CHECKLIST_E2E_TICKETS_QR.md`.
