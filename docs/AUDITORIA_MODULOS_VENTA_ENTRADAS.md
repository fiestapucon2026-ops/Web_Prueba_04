# Auditoría: Módulos conectados y checklist venta de entradas

**Proyecto:** web_oficial_festival (www.festivalpucon.cl)  
**Alcance:** Página web de venta de entradas para varios días, pago MP, generación QR/tickets, administración.

---

## 1. Checklist: qué debe tener una web de venta de entradas

| Requisito | Estado | Módulo / nota |
|-----------|--------|----------------|
| **Varios días de evento** | ✅ | `event_days`, `events`, `daily_inventory`, `inventory`; seed con fechas 2026. |
| **Selección de fecha y tipo** | ✅ | `/entradas`: DateSelector + TicketSelector por día. `/tickets`: evento + tipo desde API. |
| **Reserva temporal + idempotencia** | ✅ | `idempotency_keys`, `reserve` (entradas/tickets), `create-preference` con cleanup. |
| **Pago por internet (Mercado Pago)** | ✅ | Checkout Pro o Bricks; `create-preference`, `create-payment`, `payment-data`, `access-token`. |
| **Webhook MP verificado** | ✅ | Firma `x-signature` con `MP_WEBHOOK_SECRET`; `audit_log` en fallos. |
| **Órdenes y tickets tras pago** | ✅ | `process-approved-order`, `job_queue` tipo `generate_ticket_pdf`. |
| **Generación de PDF con QR** | ✅ | `pdf.tsx` (qr_uuid o token firmado), worker `process-tickets` → Storage. |
| **Envío de email con ticket** | ✅ | Resend en worker; `sendTicketEmail`; opcional si no hay `RESEND_API_KEY`. |
| **Ver / descargar entradas (post-compra)** | ✅ | `/mis-entradas`, `/api/orders/by-reference`, `/by-reference/pdf`, `access-token`. |
| **Control de acceso (validar QR)** | ✅ | `/admin/scanner-v2`, `/api/admin/tickets/validate`, 4 estados (verde/rojo/morado/amarillo). |
| **Admin: inventario y precios** | ✅ | `/admin/stock`, `/api/admin/inventory`, edición nominal_stock, price, fomo, overbooking. |
| **Admin: autenticación** | ✅ | `/api/admin/login`, logout, cookie; `ADMIN_SECRET`; rate limit. |
| **Health check** | ✅ | `/api/health`. |
| **Worker para PDF + email** | ✅ | `/api/workers/process-tickets` (CRON_SECRET); reintentos, bucket `tickets`. |
| **Seguridad post-compra** | ✅ | `QR_SIGNING_SECRET`, access token de un solo uso, token en URL/session para mis-entradas. |

---

## 2. Entradas por días = Tickets (un solo producto)

**Regla documentada:** Las “entradas por días” y los “tickets” son el mismo producto. Ambos flujos escriben en las mismas tablas `orders` y `tickets`. La fecha del ticket y su condición están bien definidas en el modelo.

- **Fecha del ticket:** No hay columna `tickets.fecha`. La fecha es la del **evento** asociado al inventario del ticket:  
  `ticket.inventory_id` → `inventory.event_id` → `events.date`.  
  Documentado en: `supabase/migrations/orders_quantity_and_tickets_table.sql` (tickets → inventory), `src/lib/types.ts` (OrderWithDetails → inventory.event), `src/lib/tickets/validate.ts` (validación por día usando event.date).

- **Condición del ticket:** Campo **`status`** en `tickets`: `sold_unused` | `used`. Además: `scanned_at`, `used_at` para control de uso.  
  Documentado en: `orders_quantity_and_tickets_table.sql` — *"Condiciones: disponible para venta (no hay fila), vendido no utilizado (sold_unused), utilizado (used)"*; `job_queue_and_tickets_storage_sin_drop.sql` (qr_uuid, scanned_at).

### 2.1 Flujos de venta (dos UIs, mismo backend)

- **`/entradas`** — UI “por día”: usuario elige fecha → inventario de ese día → carrito → create-preference (entradas) o reserve + pago.  
  APIs: `GET /api/entradas/inventory?date=`, `POST /api/entradas/create-preference`, `POST /api/entradas/reserve`.

- **`/tickets`** — UI “por evento”: datos de `GET /api/tickets/types` → create-preference (tickets) o reserve + pago.  
  APIs: `GET /api/tickets/types`, `POST /api/tickets/create-preference`, `POST /api/tickets/reserve`.

Ambos crean **órdenes** y, tras el pago, **tickets** (con `inventory_id` → evento con fecha). El webhook MP actualiza estado y dispara la cola de PDF.

### 2.2 Base de datos (Supabase)

- **event_days** → **events** (fecha, nombre, venue).  
- **daily_inventory**: stock por día y tipo (nominal_stock, price, fomo, overbooking).  
- **inventory**: capacidad por evento y tipo (event_id → **fecha del ticket** vía events.date).  
- **orders**: external_reference, inventory_id, user_email, amount, quantity, status (pending | paid | rejected), mp_payment_id.  
- **tickets**: order_id, **inventory_id** (define evento/fecha), **status** (sold_unused | used), qr_uuid, scanned_at, used_at.  
- **job_queue**: tipo `generate_ticket_pdf`, payload (external_reference, order_ids, email).  
- **idempotency_keys**: evita duplicados en reserve/create-preference.  
- **audit_log**: fallos de firma webhook.

### 2.3 Pago y post-pago

- Preferencia MP → redirect a Checkout Pro o uso de Bricks en `/pago` (payment-data, access-token, create-payment).  
- Webhook `POST /api/webhooks/mercadopago`: si payment approved → `processApprovedOrder` (orders paid, tickets creados, job_queue).  
- Cron/worker `GET /api/workers/process-tickets`: procesa job_queue → PDF → Storage → email (Resend).  
- Usuario: `/success` → token → `/mis-entradas?token=...` o sessionStorage; `GET /api/orders/by-reference?token=`, `GET /api/orders/by-reference/pdf?token=`.

### 2.4 Admin

- **Stock:** `/admin/stock` → `GET/PATCH /api/admin/inventory` (event_days, daily_inventory, inventory, sold).  
- **Control de acceso:** `/admin/scanner-v2` (y legacy `/admin/validar-qr`) → `POST /api/admin/tickets/validate` (qr_uuid → valid / ya utilizada / no válida / válido otro día).  
- Auth: middleware en `/admin/*` y `/api/admin/*` (excepto login/logout); cookie con ADMIN_SECRET.

---

## 3. Lo que puede estar faltando o reforzar

| Área | Estado | Recomendación |
|------|--------|---------------|
| **Listado de ventas/órdenes (admin)** | ❌ No existe | Añadir vista admin (ej. `/admin/ventas`) con listado de órdenes por fecha, referencia, email, estado, monto; opcional filtro por fecha/estado. |
| **Devoluciones / reembolsos** | ❌ No implementado | Si el negocio lo requiere: integración MP refunds + actualizar estado de tickets/órdenes y posible anulación de QR. |
| **Reportes (exportar ventas)** | ❌ No existe | Opcional: export CSV/Excel de órdenes pagadas y tickets por evento/día para contabilidad. |
| **Búsqueda por email o referencia (admin)** | ❌ No centralizada | Hoy el usuario usa token en mis-entradas; admin no tiene búsqueda por email/referencia. Añadir búsqueda en admin (por referencia o email) para soporte. |
| **Dominio de email (Resend)** | ⚠️ Configurable | `.env.example` usa `noreply@festivalpucon.cl`; verificar dominio verificado en Resend y from correcto. |
| **Cron en Vercel** | ⚠️ Externo | `process-tickets` debe invocarse por cron (Vercel Cron o externo) con `CRON_SECRET`; documentar URL y frecuencia (ej. cada 1–2 min). |
| **Rate limit en producción** | ⚠️ En memoria | `.env.example` menciona Upstash Redis para access-token y by-reference; sin Redis el límite es por instancia. Valorar Redis en producción. |
| **Sonido/vibración scanner** | ✅ | Success tiene audio; rechazos tienen vibración; opcional asegurar que `/sounds/success.mp3` exista en `public`. |

---

## 4. Variables de entorno críticas (recordatorio)

- **Supabase:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.  
- **Mercado Pago:** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`; opcional Bricks: `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_PAYMENT_DATA_SECRET`.  
- **URLs:** `NEXT_PUBLIC_BASE_URL`; opcional success: `NEXT_PUBLIC_SUCCESS_REDIRECT_URL`, `NEXT_PUBLIC_SUCCESS_REDIRECT_SECONDS`.  
- **Seguridad:** `QR_SIGNING_SECRET`, `ADMIN_SECRET`, `CRON_SECRET`.  
- **Email:** `RESEND_API_KEY` (opcional; sin él no se envían emails con ticket).  

---

## 5. Resumen

- **Conectados y operativos:** Múltiples días, inventario por día/tipo, reserva e idempotencia, pago MP (Checkout Pro/Bricks), webhook verificado, creación de órdenes y tickets, cola PDF+email, generación de QR en PDF, mis-entradas y descarga PDF, control de acceso con 4 estados, admin de stock y auth.  
- **Para dar de alta con confianza:** Configurar cron que llame a `process-tickets`, verificar Resend y dominio de email, y (opcional) Redis para rate limit.  
- **Mejoras sugeridas:** Panel admin de ventas/órdenes, búsqueda por referencia/email en admin y, si aplica, reembolsos vía MP y export de reportes.
