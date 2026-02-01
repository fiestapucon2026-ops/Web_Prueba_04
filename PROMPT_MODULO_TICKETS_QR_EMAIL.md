# Prompt para Cursor — Módulo "Generación de tickets con QR y envío de mail"

**Usa este prompt como primer mensaje en un nuevo chat de Cursor para implementar el módulo.**

---

## Regla de ejecución (protocolo del proyecto)

- No implementar código sin autorización explícita ("Autorizado" o "Proceed").
- Secuencia obligatoria: Análisis de impacto → Propuesta técnica (incl. riesgos) → Ejecución tras autorización.
- Referencia: `.cursorrules` del proyecto.

---

## Objetivo del módulo

Implementar la generación de tickets con códigos QR reales y el envío de emails post-pago, corrigiendo las brechas actuales y unificando la experiencia del cliente tras una compra exitosa.

---

## Contexto del proyecto

| Campo | Valor |
|-------|-------|
| Proyecto | web_oficial_festival (Festival Pucón 2026) |
| Stack | Next.js 14+ (proyecto actual: 16.x), TypeScript (strict), Tailwind, Vercel, Mercado Pago, Supabase, Resend |
| Dominio | www.festivalpucon.cl |
| Módulo de venta de tickets | 100% operativo. No modificar sin acuerdo explícito. |

---

## Lo que NO debes modificar (regla de oro)

- APIs de entradas: `/api/entradas/inventory`, `/api/entradas/create-preference`
- API tickets: `/api/tickets/create-preference`
- Webhook: `/api/webhooks/mercadopago` — flujo de actualización de órdenes y creación de filas en `tickets`
- Esquema BD: tablas existentes (`orders`, `tickets`, `inventory`, `daily_inventory`, `event_days`); columna `orders.quantity`; múltiples órdenes por `external_reference`
- Página de inicio (`/`, PantallaInicio)
- Flujo de pago (delegación 1 ítem vs preferencia MP directa)
- **Módulo Admin:** rutas `/admin/*`, `/api/admin/*`, archivos `src/lib/admin-*.ts`, `src/lib/admin-session*.ts`, `src/middleware.ts`. Estado: 100% operativo; cualquier cambio requiere doble ratificación (ver `PROMPT_NUEVO_CHAT_MODULO_ADMIN_SEGURIDAD.md`)

Solo se permite **extender** o **refactorizar** lo relacionado con PDF, email y visualización de tickets, sin cambiar la lógica de pago ni órdenes.

---

## Esquema BD — política de migraciones

- **No modificar:** tablas existentes ni migraciones ya aplicadas.
- **Nuevas migraciones:** permitidas solo si son necesarias para este módulo (ej. tabla `access_tokens` para tokens de un solo uso) y tras diseño aprobado.

---

## Estado actual (lo que ya existe)

### Base de datos

- **orders:** `id`, `external_reference`, `inventory_id`, `user_email`, `amount`, `quantity`, `status` (pending|paid|rejected), `mp_payment_id`, `created_at`
- **tickets:** `id` (UUID), `order_id`, `inventory_id`, `status` (sold_unused|used), `discount_amount`, `created_at`, `used_at`
- Una compra puede generar varias órdenes (mismo `external_reference`): main ticket, parking, promo
- Cada orden con `quantity` > 1 genera varias filas en `tickets` (una por unidad)
- **inventory** → `event` (name, date, venue), `ticket_type` (name, price)

### Webhook Mercado Pago (`/api/webhooks/mercadopago`)

1. Recibe POST con `type: 'payment'`, `data.id` = payment_id
2. Verifica firma con `MP_WEBHOOK_SECRET` (x-signature, x-request-id)
3. Consulta payment en MP API: `payment.external_reference`, `payment.status`, `payment.payer.email`
4. Si `status === 'approved'`:
   - Actualiza todas las órdenes con ese `external_reference` a `status: 'paid'`
   - Crea filas en `tickets` (una por unidad por orden)
   - Por cada orden: llama `generateTicketPDF(orderData)` y `sendTicketEmail(orderData, pdfBuffer)`

### Mercado Pago — datos disponibles

- **payment.external_reference:** UUID único del pago (lo usamos al crear la preferencia)
- **payment.status:** approved | pending | rejected | cancelled
- **payment.payer.email:** email del comprador
- **payment.status_detail:** motivo si rechazado
- El webhook NO envía el body completo del payment; hay que consultar la API de MP con el payment_id

### Generación de PDF (`src/lib/pdf.tsx`)

- Usa `@react-pdf/renderer`
- Recibe `OrderWithDetails` (order + inventory.event + inventory.ticket_type)
- **Problema actual:** el QR es un placeholder de texto (`order.external_reference`), no un código QR real
- Muestra: evento, tipo, fecha, lugar, orden, email, monto, fecha compra

### Email (`src/lib/email.ts`)

- Usa Resend
- Envía HTML + PDF adjunto
- **Problema actual:** el webhook envía un email por cada orden; una compra con main+parking+promo genera 3 emails

### Firma de tickets (`src/lib/security/qr-signer.ts`)

- `signTicket(uuid: string, type: string): string`
- Payload: `${uuid}|${type}|${issued_at}`; firma HMAC-SHA256; output Base64URL
- Requiere `QR_SIGNING_SECRET` (solo servidor; no exponer en cliente ni en variables `NEXT_PUBLIC_*`)
- **Problema actual:** se usa `order.id` como uuid; debería usarse `ticket.id` para identificar cada ticket físico

### API `/api/orders/[id]`

- GET por `order_id` (UUID de orders)
- Retorna: `order_id`, `status`, `tickets[]` con `uuid`, `category`, `access_window`, `qr_token`
- **Problema actual:** devuelve un solo ticket por orden (usa order.id), pero una orden puede tener varios tickets (quantity > 1)
- Debería consultar la tabla `tickets` y firmar cada `ticket.id`

### Página `/checkout/success/[id]`

- Muestra tickets de UNA orden por `order_id`
- **Problema:** una compra tiene varias órdenes (external_reference); el usuario no sabe qué order_id usar
- Verificar si está en uso activo antes de decidir mantener o migrar a by-reference

### Página `/success`

- Mensaje "Pago exitoso", cuenta regresiva, redirección a `NEXT_PUBLIC_SUCCESS_REDIRECT_URL`
- Variables: `NEXT_PUBLIC_SUCCESS_REDIRECT_URL`, `NEXT_PUBLIC_SUCCESS_REDIRECT_SECONDS`
- Mantener compatibilidad con estas variables; añadir lógica opcional para `external_reference` en searchParams si está presente

### Variables de entorno (`.env.example`)

- `QR_SIGNING_SECRET` — para firmar tokens QR; solo servidor; no exponer en cliente ni en `NEXT_PUBLIC_*`
- `RESEND_API_KEY` — para enviar emails
- `NEXT_PUBLIC_SUCCESS_REDIRECT_URL` — URL post-pago (ej. /mis-entradas)
- `NEXT_PUBLIC_BASE_URL`

---

## Qué falta implementar (alcance del módulo)

### 1. QR real en PDF

- Generar imagen QR real en el PDF (no solo texto)
- El QR debe codificar el token firmado: `signTicket(ticket.id, ticketType.name)`
- Usar `ticket.id` (UUID de tabla tickets), no `order.id`
- **Librería:** `@react-pdf/renderer` soporta `<Image>`. Para QR: generar imagen con `qrcode` (npm) en servidor y pasarla como base64/data URL al PDF

### 2. Un email por compra (no por orden)

- Agrupar todas las órdenes con el mismo `external_reference`
- Fuente del email: `payment.payer.email` (webhook de MP). Fallback: si ausente, usar `orders[0].user_email`
- Contenido: resumen de todos los ítems comprados, enlace a "Ver/descargar mis entradas"
- Opciones: (a) un PDF único con todos los tickets, o (b) enlace a la web para ver/descargar (sin adjuntar PDF)
- El enlace debe llevar al usuario a ver todos sus tickets (por external_reference + token)

### 3. API por external_reference

- Nueva ruta: `GET /api/orders/by-reference/[external_reference]` (o similar)
- Retornar todas las órdenes y tickets del pago
- Cada ticket: `ticket.id`, `category`, `access_window`, `qr_token` (firmado con ticket.id)
- **Validación:** `external_reference` — validar UUID v4 con `z.string().uuid()` antes de query
- **Token:** requerido en query (ver especificación de token en Consideraciones técnicas)
- **Seguridad:** comparación timing-safe si se verifica contra secreto; respuestas de error genéricas (no exponer mensajes de BD)

### 4. Especificación del token "Mis entradas"

- **Formato:** HMAC-SHA256(external_reference|timestamp, QR_SIGNING_SECRET)
- **Representación:** base64url(external_reference|timestamp) + '.' + base64url(signature)
- **TTL:** 7 días desde emisión (timestamp en el token)
- **Verificación:** en GET by-reference, extraer timestamp, verificar TTL, comparar signature con timing-safe (`crypto.timingSafeEqual` en Node, constant-time en Edge)
- **Alternativa:** si se requiere revocación, usar UUID en tabla `access_tokens` con `external_reference`, `expires_at`, `used_at`

### 5. Página "Mis entradas"

- Ruta: `/mis-entradas` o `/entradas/[token]`
- El usuario llega desde el email (enlace con token)
- Mostrar todos los tickets de la compra con QR (verificar `TicketCard` existente: si ya muestra QR o solo datos; extender si hace falta)
- Botón "Descargar PDF" (todos los tickets en un PDF) y/o descarga individual

### 6. Integración con webhook — solo extender

- **Extender únicamente:** tras crear tickets, agrupar órdenes por `external_reference` y enviar un solo email con enlace a "Mis entradas" (URL con token)
- **No modificar:** lógica de actualización de orders/tickets, verificación de firma (MP_WEBHOOK_SECRET), idempotencia
- **Pruebas de regresión obligatorias:** mismo external_reference con múltiples órdenes; reenvío de webhook (idempotencia)
- Opcional: adjuntar PDF único con todos los tickets con QR real

### 7. API /api/orders/[id] — corrección

- **Mantener** para compatibilidad con `/checkout/success/[id]` si está en uso
- Consultar la tabla `tickets` para esa orden
- Retornar un ticket por cada fila en `tickets`, con `uuid = ticket.id` y `qr_token = signTicket(ticket.id, ticketType.name)`

### 8. Política de rutas orders

- `GET /api/orders/[id]`: mantener y corregir para devolver N tickets (compatibilidad)
- Flujo principal post-pago: `GET /api/orders/by-reference/[ref]` con token firmado

### 9. Redirección post-pago

- **Mercado Pago envía en la URL de success:** `?external_reference=XXX&status=approved&...` (GET params en back_urls)
- La página `/success` puede leer `external_reference` desde searchParams y redirigir a `/mis-entradas?token=XXX` (token generado con external_reference)
- Mantener compatibilidad con `NEXT_PUBLIC_SUCCESS_REDIRECT_URL` y `NEXT_PUBLIC_SUCCESS_REDIRECT_SECONDS`
- Si `external_reference` presente: construir URL con token; si no, mantener comportamiento actual (cuenta regresiva + redirect fija)

---

## Consideraciones técnicas

### Seguridad

- No exponer `external_reference` ni `order_id` en URLs públicas sin validación (usar token firmado)
- Validación de token: comparación timing-safe; respuestas de error genéricas ("No encontrado", "Error interno")
- Rate limit para GET by-reference: 10 req/min por IP (extender matcher de middleware o crear lógica en la ruta)

### Middleware y CSP

- Verificar si matcher actual de `src/middleware.ts` cubre `/api/orders/by-reference/*`
- Si no, extender matcher o aplicar rate limit en la ruta

### Idempotencia

- El webhook ya es idempotente (verifica si órdenes ya están paid). Mantener ese comportamiento.

### Tipos de ticket

- Definidos en BD (`ticket_types` / inventario); no hardcodear nombres en código

### event_days

- La fecha del evento puede obtenerse vía `inventory` → `event` (o `event_days` si el esquema lo requiere; revisar seed y migraciones)

---

## Rollback operacional

- **Antes de modificar** webhook, `src/lib/pdf.tsx`, `src/lib/email.ts`:
  ```bash
  git checkout -b backup/tickets-qr-$(date +%Y%m%d)
  git add -A && git commit -m "pre-tickets-qr: respaldo antes de cambios"
  ```
- **Rollback:** `git checkout main && git branch -D backup/tickets-qr-YYYYMMDD`

---

## Archivos relevantes

| Archivo | Uso |
|---------|-----|
| `src/app/api/webhooks/mercadopago/route.ts` | Extender para email único y agrupación; no alterar lógica orders/tickets |
| `src/lib/pdf.tsx` | Refactorizar para QR real por ticket |
| `src/lib/email.ts` | Refactorizar para email único por compra |
| `src/lib/security/qr-signer.ts` | Usar con `ticket.id` |
| `src/app/api/orders/[id]/route.ts` | Corregir para múltiples tickets por orden |
| `src/app/api/orders/by-reference/[ref]/route.ts` | Crear (o ruta equivalente) con validación de token |
| `src/app/checkout/success/[id]/page.tsx` | Adaptar o crear nueva ruta por external_reference |
| `src/app/success/page.tsx` | Integrar lógica opcional para external_reference + token |
| `src/components/TicketCard.tsx` | Verificar soporte QR; extender si hace falta |
| `supabase/migrations/` | Solo leer schema; nuevas migraciones solo con diseño aprobado |

---

## Orden de implementación sugerido

1. Corregir `GET /api/orders/[id]` para devolver un ticket por cada fila en `tickets` con QR firmado por `ticket.id`
2. Agregar dependencia `qrcode` (o similar) para generar imágenes QR en servidor
3. Refactorizar `generateTicketPDF` para aceptar un array de tickets y generar QR real por cada uno
4. Implementar especificación de token (HMAC con TTL)
5. Crear API `GET /api/orders/by-reference/[ref]` con validación de token y UUID
6. Crear página `/mis-entradas` (o `/entradas/[token]`) para visualizar y descargar tickets
7. Extender webhook: agrupar por external_reference, enviar un solo email con enlace (fuente email: payment.payer.email, fallback orders[0].user_email)
8. Ajustar flujo de redirección post-pago y variables de entorno

### Dependencias entre pasos

- Pasos 1, 2, 3, 4: independientes; aplicar en cualquier orden
- Paso 5: depende de 4 (token)
- Paso 6: depende de 5
- Paso 7: depende de 4 (token) y 5 (fuente email)
- Paso 8: depende de 6 (página destino)

### Riesgo por paso

| Paso | Riesgo | Justificación |
|------|--------|---------------|
| 1, 7 | Alta | Webhook crítico; regresión en orders/tickets |
| 4, 5, 6 | Alta | Seguridad (token, validación) |
| 2, 3, 8 | Media | PDF, email, redirect (menos críticos) |

---

## Documentos de referencia

- `RESUMEN_PARA_NUEVO_CHAT.md` — reglas y estado del módulo de venta
- `MODULO_ENTRADAS_MP_RESUMEN.md` — handoff y datos para emails/tickets
- `PROMPT_NUEVO_CHAT_MODULO_ADMIN_SEGURIDAD.md` — Módulo Admin terminado; doble ratificación
- `RESUMEN_ESTADO.md` — Estado del proyecto y orden lógico
- `.env.example` — variables necesarias

---

## Al cerrar el módulo

- Actualizar este prompt: marcar como **TERMINADO** y **100% operativo**
- Exigir **doble ratificación** para cambios futuros en: PDF (`src/lib/pdf.tsx`), email (`src/lib/email.ts`), QR (`qr-signer.ts`), webhook (extensión), APIs orders (`/api/orders/[id]`, `/api/orders/by-reference/*`), página "Mis entradas"
- Listar archivos afectados por la regla de doble ratificación
