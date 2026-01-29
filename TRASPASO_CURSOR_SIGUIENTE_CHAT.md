# Prompt de traspaso para el siguiente chat en Cursor

**Instrucción:** Copia todo el contenido desde "--- INICIO PROMPT ---" hasta "--- FIN PROMPT ---" y pégalo como **primer mensaje** en un nuevo chat de Cursor. Así el asistente tendrá contexto completo y continuará desde este punto sin empezar de cero.

---

--- INICIO PROMPT ---

## CONTEXTO DE PROYECTO

Soy el usuario del proyecto **web_oficial_festival** (venta de tickets para Festival Pucón 2026). Stack: Next.js 14+, TypeScript estricto, Tailwind, Vercel, Mercado Pago, Supabase. El sitio ya está en internet; la página de inicio está en producción y no debe modificarse hasta que Mercado Pago esté 100 % validado.

Estamos en la rama **feature/mercado-pago-payment**. Repo: fiestapucon2026-ops/Web_Prueba_04 (o equivalente según el proyecto). Vercel: proyecto vinculado a ese repo; equipo fiesta-pucons-projects. Workspace típico en desarrollo: `/home/lvc/web_oficial_festival` (ajustar en comandos si la ruta es distinta).

---

## REGLAS DE ORO (OBLIGATORIAS)

1. **No tocar la página de inicio** (`src/app/page.tsx` ni `src/components/pantalla-inicio/PantallaInicio.tsx`) hasta que el módulo de Mercado Pago esté 100 % probado y validado. La web ya está en uso.
2. **Protocolo de cambios:** Según `.cursorrules`, el asistente debe analizar, proponer y solo ejecutar código tras autorización explícita del usuario. Frase exacta en `.cursorrules`: **"Authorized/Proceed"** (en español: "Autorizado"/"Proceder").
3. **NEXT_PUBLIC_BASE_URL:** Debe ser la URL del deployment que se está probando (Preview o producción), nunca la URL de GitHub. Para pruebas en Preview es la URL que aparece en Vercel → Deployments → [deployment Preview de feature/mercado-pago-payment] → Domains.
4. **Variables de entorno en Vercel:** Cambios en variables solo aplican a **nuevos** deployments. Tras añadir o editar una variable hay que hacer **Redeploy** del deployment correspondiente.

---

## ETAPA ACTUAL

**Fase:** Prueba de pago con Mercado Pago en **Opción A** (Preview).

- **Opción A:** Probar todo en un deployment **Preview** del branch `feature/mercado-pago-payment`, sin tocar main ni la página principal. URL de prueba típica: `https://weboficialfestival-git-feature-me-c98662-fiesta-pucons-projects.vercel.app` (puede cambiar según el último deployment; confirmar en Vercel → Deployments → Domains).
- **Objetivo inmediato:** Completar la **primera compra de prueba exitosa** (pago aprobado en MP, orden en Supabase como `paid`, redirección a `/success`). Luego, si se desea, configurar Resend para el email con el ticket.

---

## LO QUE YA ESTÁ HECHO (NO REPETIR)

- **Backend:** `/api/tickets/create-preference` (preferencia primero, luego orden; idempotencia con header `Idempotency-Key` y tabla `idempotency_keys` en Supabase). `/api/tickets/types` (eventos sin filtrar por fecha para que aparezcan en el dropdown). `/api/webhooks/mercadopago` (firma obligatoria con `MP_WEBHOOK_SECRET`, update atómico `WHERE status = 'pending'` para evitar doble PDF/email). `/api/health` para diagnóstico de env.
- **Frontend:** Página `/tickets` con selector de evento, tipo de ticket, email; botón "Usar email de prueba MP" que rellena `TESTUSER5544200525823207849@testuser.com`; envío de `Idempotency-Key` en la petición a create-preference.
- **Páginas de retorno:** `/success`, `/failure`, `/pending` creadas (back_urls de MP).
- **Supabase:** Tablas `events`, `ticket_types`, `inventory`, `orders` (con `mp_payment_id`), `idempotency_keys`. Datos de prueba: evento Festival Pucón 2026, tipos General y VIP, inventario. Guía en `GUIA_INSERCION_DATOS.md`.
- **Vercel:** Variables configuradas (según proyecto): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `NEXT_PUBLIC_BASE_URL` (para Preview). Redeploy realizado; `/api/health` devuelve `ok: true`; `/api/tickets/types` devuelve eventos y tipos; el dropdown de eventos muestra "Festival Pucón 2026".
- **Mercado Pago:** App "Festivalpucon" creada; webhook configurado (URL = `https://[Preview-URL]/api/webhooks/mercadopago`, evento **payment**); credenciales de prueba en uso (`MP_ACCESS_TOKEN` tipo TEST-...).

---

## LO QUE FALTA / SIGUIENTE PASO

1. **Completar una compra de prueba exitosa:**
   - En `/tickets` (Preview URL): elegir evento, tipo, hacer clic en "Usar email de prueba MP", luego "Comprar con Mercado Pago".
   - En el checkout de MP: el usuario debe estar logueado con una **cuenta de prueba** de MP (Panel MP → Cuentas de prueba). Usar tarjeta de prueba (ej. Mastercard 5416 7526 0258 2580, CVV 123, venc. 11/30, nombre del titular **APRO** para pago aprobado). Documento: 123456789.
   - Si aparece "Una de las partes es de prueba": hay mezcla prueba/producción; la cuenta con la que se entra en mercadopago.cl debe ser **usuario de prueba**, no la cuenta real.
   - Tras pago aprobado: verificar redirección a `/success`, orden en Supabase con `status: paid` y `mp_payment_id`; opcionalmente configurar `RESEND_API_KEY` para recibir el email con el ticket.

2. **Cuando MP esté 100 % validado en Preview:** Merge de `feature/mercado-pago-payment` a `main`, configurar producción (credenciales y webhook de producción, `NEXT_PUBLIC_BASE_URL` de producción). Solo entonces se puede plantear enlazar "Comprar entradas" desde la página principal si se desea.

---

## ARCHIVOS CLAVE

- **API:** `src/app/api/tickets/create-preference/route.ts`, `src/app/api/tickets/types/route.ts`, `src/app/api/tickets/generate-pdf/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`, `src/app/api/health/route.ts`.
- **Frontend tickets:** `src/app/tickets/page.tsx`.
- **Lib:** `src/lib/mercadopago.ts`, `src/lib/supabase.ts`, `src/lib/schemas.ts`.
- **Páginas retorno MP:** `src/app/success/page.tsx`, `src/app/failure/page.tsx`, `src/app/pending/page.tsx`.
- **Documentación:** `EJECUTAR_OPCION_A.md` (pasos para Opción A), `CHECKLIST_PRE_PRUEBA.md`, `PASOS_FINALES_VERCEL.md`, `GUIA_INSERCION_DATOS.md`, `ARQUITECTURA_MODULAR.md`. `.cursorrules` en la raíz (protocolo de análisis → propuesta → ejecución solo con autorización).

---

## PROBLEMAS YA RESUELTOS (PARA NO VOLVER A CAER)

- **SUPABASE_URL "missing" en runtime aunque está en Vercel:** Las variables solo aplican a **nuevos** deployments. Solución: Redeploy del deployment Preview **después** de guardar la variable; comprobar que la variable aplique a **Preview** (o All Environments).
- **"No hay eventos cargados" en /tickets:** El API filtraba eventos con `.gte('date', new Date().toISOString())`; el evento en BD era 2026-01-15 y la fecha del servidor posterior. Se quitó ese filtro en `src/app/api/tickets/types/route.ts` para devolver todos los eventos.
- **"Una de las partes es de prueba" en MP:** Integración usa credenciales de prueba; el comprador debe usar **cuenta de prueba** de MP y **tarjeta de prueba** (nombre titular **APRO** para aprobado). Email de prueba en el formulario: usar "Usar email de prueba MP" o ingresar `TESTUSER5544200525823207849@testuser.com`.
- **404 en /api/health en una URL de Vercel:** Ese deployment era **Production (main)**; el código de MP está en el branch **feature/mercado-pago-payment**. Hay que usar la URL del deployment **Preview** de ese branch (Vercel → Deployments → fila Preview + feature/mercado-pago-payment → Domains).

---

## COMANDOS ÚTILES

```bash
# Desarrollo local
cd /home/lvc/web_oficial_festival && npm run dev

# Build
npm run build

# Subir cambios y desplegar (Vercel despliega al hacer push)
git add .
git commit -m "descripción"
git push origin feature/mercado-pago-payment
```

---

## RESUMEN PARA EL ASISTENTE

- Proyecto: venta de tickets con Mercado Pago; Next.js, Supabase, Vercel.
- Rama: feature/mercado-pago-payment. No tocar la página de inicio.
- Estado: integración MP implementada; falta cerrar la primera compra de prueba exitosa (cuenta + tarjeta + email de prueba en MP).
- Documentación y reglas: ver arriba y `.cursorrules`. Ejecutar cambios solo tras autorización del usuario.

--- FIN PROMPT ---

---

**Uso:** Abre un nuevo chat en Cursor, pega todo lo que está entre "--- INICIO PROMPT ---" y "--- FIN PROMPT ---", envía. El asistente tendrá este contexto para continuar desde aquí.
