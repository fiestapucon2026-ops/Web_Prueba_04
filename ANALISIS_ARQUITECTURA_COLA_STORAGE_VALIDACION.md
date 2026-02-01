# Análisis de la arquitectura propuesta (Cola + Storage + Validación Online)

**Estado:** Solo análisis. No se ha ejecutado ningún cambio. Esperando instrucción directa y clara para ejecutar.

---

## Confirmación de tus decisiones

| Pregunta | Tu respuesta |
|----------|--------------|
| **Cola** | Opción A (Nativa Postgres) |
| **Internet en Puerta** | Sí (Online – Modelo A) |
| **Storage** | Activar |
| **DNS** | Pendiente |

---

## 1. Aclaración sobre “Opción A (Nativa Postgres)”

El SQL que compartiste **no usa la extensión pg_mq** de Supabase. Usa una **tabla `job_queue`** en Postgres y un **worker invocado por Vercel Cron** que hace polling (lee `status = 'pending'`, procesa, actualiza `status`). Es el patrón “Transactional Outbox” + cron, no cola push con pg_mq.

- **Si “Opción A” para ti es “cola en la BD” (tabla + cron):** El diseño propuesto coincide.
- **Si “Opción A” era la extensión pg_mq:** Habría que instalar la extensión en Supabase y usar sus APIs (LISTEN/NOTIFY o la API de pg_mq); el script actual no lo hace.

En lo que sigue se asume **tabla `job_queue` + worker por cron**, tal como en el script.

---

## 2. Diferencias y conflictos con el código actual

### 2.1 Tabla `tickets`

- **Actual (migraciones):** `id` (UUID PK), `order_id`, `inventory_id`, `status` CHECK (`'sold_unused' | 'used'`), `discount_amount`, `created_at`, `used_at`. No hay `qr_uuid`, `pdf_url`, `scanned_at`, `scanned_by`.
- **Propuesta:** Añadir `qr_uuid` UNIQUE, `pdf_url`, `scanned_at`, `scanned_by`.
- **Conflicto:** El ejemplo del worker inserta `status: 'valid'`. En tu esquema `status` solo admite `'sold_unused'` y `'used'`. Hay que **no usar** `'valid'` y seguir con `'sold_unused'` para tickets recién creados y `'used'` al quemar.

### 2.2 Dónde se crean los tickets

- **Actual:** El webhook crea las filas en `tickets` (una por unidad por orden) dentro del mismo request, antes de generar PDF y enviar email.
- **Propuesta (ejemplo):** El worker crea los tickets al procesar el job.
- **Recomendación de análisis:** Mantener la **creación de tickets en el webhook** (ya idempotente por `order_id`) y que el webhook solo **encolé** el job (orden + email + datos para PDF). El worker **no** crea tickets; solo lee órdenes y tickets ya existentes, genera PDF, sube a Storage, envía email y marca job completado. Así se evita duplicar lógica de negocio (inventory_id, quantity, múltiples órdenes por `external_reference`) en el worker y se mantiene una sola fuente de verdad para “tickets creados”.

### 2.3 Contenido del QR

- **Actual:** El QR muestra un token **HMAC** (`signTicket(ticket.id, ticketType.name)`): payload `uuid|type|issued_at` + firma. Las APIs `/api/orders/[id]` y `/api/orders/by-reference` devuelven `qr_token` generado en tiempo de consulta; el PDF usa el mismo `signTicket(ticketId, ...)`.
- **Propuesta (Online A):** El QR contiene solo el **UUID del ticket** (`qr_uuid`), y la API de validación consulta por `qr_uuid` y marca usado.
- **Adaptación necesaria:** Añadir columna `qr_uuid` (UNIQUE), generarla al insertar cada ticket (en webhook). En PDF y en respuestas de “mis entradas” usar **`qr_uuid`** como valor del QR (no el token HMAC). Mantener o no `signTicket` para otros flujos es decisión de producto; para “puerta online” basta con `qr_uuid` + API de validación por `qr_uuid`.

### 2.4 Webhook: qué debe hacer

- **Actual:** Valida firma → consulta MP → idempotencia por `mp_payment_id` → actualiza órdenes a `paid` → crea filas en `tickets` → genera PDF en memoria → envía email con adjunto → responde 200. Todo en el mismo request.
- **Objetivo:** Valida firma → consulta MP → idempotencia por `mp_payment_id` → actualiza órdenes a `paid` → crea filas en `tickets` (con `qr_uuid`) → **inserta una fila en `job_queue`** (payload: `external_reference`, order_ids, email, etc.) → **responde 200 sin generar PDF ni enviar email**. El worker hace después: leer job → cargar órdenes y tickets → generar PDF → subir a Storage → enviar email (link + opcional adjunto) → marcar job completado.

### 2.5 Worker y dependencias

- **Propuesta (ejemplo):** Usa `ReactPDF.renderToStream` y un componente `TicketPDF`. En tu repo el PDF se genera con `@react-pdf/renderer` y `src/lib/pdf.tsx` (`generateTicketsPDF` que devuelve `Promise<Buffer>`). El worker debe reutilizar **`generateTicketsPDF`** (o una variante que reciba órdenes+tickets con `qr_uuid`) y no duplicar lógica. La generación debe recibir los mismos datos que hoy (order + ticketId / qr_uuid, tipo, etc.) para que el PDF sea el mismo.
- **Autenticación del worker:** El ejemplo usa `Authorization: Bearer ${process.env.CRON_SECRET}`. En Vercel Cron se configura `CRON_SECRET` y se envía en el request al worker. Falta hoy en `.env.example`; hay que añadir `CRON_SECRET` y documentar que Vercel Cron debe enviarlo.

### 2.6 Storage (Supabase)

- **Propuesta:** Bucket `tickets` (público en el ejemplo), políticas en `storage.objects`. En Supabase, los buckets se crean vía API o Dashboard; la tabla es `storage.buckets`. El script usa `INSERT INTO storage.buckets`; hay que comprobar en la doc de tu versión de Supabase si ese es el camino correcto o si se usa `storage.buckets` creado por la API. Las políticas del ejemplo no indican **rol** (por ejemplo `service_role` para INSERT); hay que definirlas para que solo el backend (service role) suba y, si el bucket es público, cualquiera pueda leer (o usar URLs firmadas si es privado).

### 2.7 Variables de entorno

- **Actual:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (el webhook ya usa service role vía `requireSupabaseClient()` → `supabaseAdmin`).
- **Propuesta:** Usa `NEXT_PUBLIC_SUPABASE_URL`. En tu código se usa `SUPABASE_URL` en servidor; no es necesario exponer la URL en cliente para esta arquitectura. Mantener `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` para webhook y worker.
- **A añadir:** `CRON_SECRET` para proteger el endpoint del worker (Vercel Cron lo enviará en cada invocación).

---

## 3. Flujo resultante (resumen técnico)

1. **Webhook MP (POST):** Validar firma → idempotencia por `mp_payment_id` → actualizar órdenes a `paid` con `mp_payment_id` → crear tickets (con `qr_uuid` por fila) si no existen por `order_id` → insertar en `job_queue` un job tipo `generate_ticket_pdf` con payload (p. ej. `external_reference`, order_ids, email) → responder 200. Sin `generateTicketsPDF` ni `sendPurchaseEmail` en este request.
2. **Worker (GET, llamado por Vercel Cron):** Comprobar `CRON_SECRET` → leer hasta N jobs `status = 'pending'` → por cada job: marcar `processing` → cargar órdenes y tickets por order_ids → llamar a `generateTicketsPDF` (o equivalente que use `qr_uuid` en el QR) → subir buffer a Storage → obtener URL pública (o firmada) → enviar email con link (y opcional adjunto) vía Resend → actualizar job a `completed` y opcionalmente guardar `pdf_url` en órdenes/tickets si lo tienes modelado; en caso de error, incrementar `attempts` y marcar `failed` o dejar `pending` según política de reintentos.
3. **Validación en puerta (POST /api/tickets/validate o /scan):** Recibir `qr_uuid` (o id si mantienes lookup por id) → buscar ticket por `qr_uuid` → si no existe o `status = 'used'` → 200 con `{ valid: false, ... }`; si existe y está `sold_unused` → update `status = 'used'`, `used_at = now()`, opcionalmente `scanned_at`/`scanned_by` → 200 con `{ valid: true, ... }`. Autenticación/autorización del endpoint (solo porteros o admin) es decisión tuya.

---

## 4. Checklist previo a implementación (sin ejecutar aún)

| Item | Estado |
|------|--------|
| SQL: bucket `tickets` y políticas Storage | Revisar sintaxis/rol en tu versión Supabase; no ejecutado |
| SQL: tabla `job_queue` e índice | Alineado con propuesta; no ejecutado |
| SQL: ALTER `tickets` (qr_uuid, pdf_url, scanned_at, scanned_by) | Alineado; no usar `status = 'valid'`; no ejecutado |
| Webhook: dejar de llamar a generateTicketsPDF y sendPurchaseEmail; insertar en job_queue | Pendiente de tu instrucción |
| Worker: nuevo endpoint GET /api/workers/process-tickets con CRON_SECRET | Pendiente |
| Worker: reutilizar generateTicketsPDF y subir a Storage; enviar email con link | Pendiente |
| PDF/QR: usar qr_uuid en lugar de signTicket para contenido del QR (y respuestas de mis entradas) | Pendiente |
| API de validación /api/tickets/validate (o /scan) por qr_uuid | Pendiente |
| Vercel: configurar Cron que llame al worker con CRON_SECRET | Pendiente (configuración en Vercel) |
| DNS (SPF, DKIM, DMARC para Resend) | Pendiente (tú indicaste “Pendiente”) |
| CRON_SECRET en Vercel y en .env.example | Pendiente |

---

## 5. Riesgos si se ejecuta sin cerrar pendientes

- **DNS pendiente:** Con 1.200 correos/día, el dominio puede ser bloqueado o ir a spam hasta que Resend esté verificado (MX, SPF, DKIM, etc.).
- **Worker sin CRON_SECRET:** Cualquiera que descubra la URL podría disparar el procesamiento de la cola; debe protegerse con secreto.
- **Crear tickets en el worker (como en el ejemplo):** Duplica lógica y obliga a pasar en el payload toda la info de órdenes/ítems; recomendación: crear tickets en el webhook y solo encolar referencia (order_ids, email) para generar PDF y enviar email.

---

**Resumen:** Tus decisiones quedan registradas como Cola A (tabla en Postgres + cron), Online en puerta, Storage activado, DNS pendiente. El análisis alinea la propuesta con tu código actual (tabla `tickets`, status `sold_unused`/`used`, creación de tickets en webhook, `generateTicketsPDF` y Resend) y lista conflictos y adaptaciones. Nada se ha ejecutado; a la espera de tu instrucción directa y clara para pasar a implementación.
