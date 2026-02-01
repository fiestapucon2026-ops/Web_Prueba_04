# Auditoría de Infraestructura — Módulo Tickets QR + Email

Respuestas técnicas basadas en el código y las migraciones del repositorio. Lo que no se puede afirmar desde el código se indica explícitamente.

---

## BLOQUE 1: Estrategia de Ejecución Asíncrona (Timeout)

### 1.1 ¿Tienes implementado algún sistema de Colas (Message Queue)?

**Respuesta:** **No.** No hay uso de colas en el código.

- **Verificado en código:** En `src/app/api/webhooks/mercadopago/route.ts` el flujo es **síncrono**: tras validar firma y consultar el pago en MP, se actualizan órdenes, se crean filas en `tickets`, se llama a `generateTicketsPDF(items)` y luego a `sendPurchaseEmail(toEmail, accessToken, itemsSummary, pdfBuffer)` en el mismo handler. La respuesta `200 OK` se devuelve **después** de todo ese procesamiento (líneas 362-363 y retorno en 441).
- **Búsqueda en repo:** No hay referencias a Supabase pg_mq, Upstash, QStash, Inngest ni cron jobs para delegar trabajo. Las únicas apariciones de "queue" están en `package-lock.json` como dependencia transitiva (no como cola de mensajes).

**Consecuencia:** Si la generación del PDF + envío por email supera el límite de la función (10s Hobby / 60s Pro), existe riesgo de timeout, 504 y tickets cobrados sin email. Para 1.200 transacciones diarias con picos, responder 200 en <2s y delegar PDF+email a una cola es la arquitectura recomendada.

**Preferencia por cola:** No está definida en el código. Habría que decidir si usar algo dentro de Supabase (pg_mq u otro) o externo (Upstash/QStash, Inngest, etc.).

### 1.2 Runtime de generación del PDF

**Respuesta:** **Node.js** (runtime por defecto de las API routes en Next.js).

- **Verificado:** No hay `export const runtime = 'edge'` en las rutas que usan `pdf.tsx` (webhook, `tickets/generate-pdf`, `orders/by-reference/pdf`). `src/lib/pdf.tsx` usa `@react-pdf/renderer` y `qrcode`, librerías Node. `vercel.json` no fuerza Edge para estas rutas.

**Conclusión:** El PDF se genera en runtime Node.js. Edge no está en uso para este flujo.

---

## BLOQUE 2: Seguridad y Criptografía del QR (Anti-Fraude)

### 2.1 Contenido del QR

**Respuesta (verificado en código):** El QR **no** contiene solo un ID. Contiene un token firmado con **HMAC-SHA256** (clave simétrica).

- **Implementación:** `src/lib/security/qr-signer.ts`. `signTicket(uuid, type)` construye:
  - Payload: `uuid|type|issued_at` (uuid del ticket, tipo de entrada, timestamp en segundos).
  - Firma: HMAC-SHA256 con `QR_SIGNING_SECRET`.
  - Salida: Base64URL(payload + '.' + signature_hex). No es JWS (no es firma asimétrica).

### 2.2 Entorno de validación en puerta (Scan)

**Respuesta:** **No hay implementación de validación en puerta en el repositorio.**

- No existe ruta API ni función que verifique el token del QR (no hay equivalente a `verifyAccessToken` para el token del ticket). `qr-signer.ts` solo exporta `signTicket`; no hay `verifyTicket` ni uso del token en una API de escaneo.
- Los documentos (`RESUMEN_PARA_NUEVO_CHAT.md`, etc.) mencionan “marcar tickets como utilizado vía escaneo/API en puerta”, pero **no hay código que implemente ese flujo**.

**Por tanto no se puede afirmar si el diseño actual es A (online) o B (offline/híbrido).** Para definirlo hace falta:

- **Escenario A (online):** API que reciba el token, opcionalmente lo decodifique/verifique con el mismo secret, consulte en Supabase el ticket por `id` (uuid del payload) y actualice `status`/`used_at`. Requiere internet en puerta.
- **Escenario B (offline/híbrido):** El token actual (HMAC con payload `uuid|type|issued_at`) permite validación offline si el dispositivo de escaneo tiene la misma clave y lógica: decodificar, verificar HMAC, comprobar `issued_at` y tipo. No es JWS (clave asimétrica); es HMAC (clave simétrica compartida). Si se quiere B con clave asimétrica, habría que cambiar a JWS y que el QR contenga esa firma.

**Resumen:** Hoy el QR es HMAC (simétrico), firmado en servidor. No hay app/API de escaneo en el repo; el escenario A o B debe definirse e implementarse.

---

## BLOQUE 3: Infraestructura de Email (Deliverability)

### 3.1 Proveedor de API transaccional

**Respuesta (verificado en código):** **Resend.**

- **Implementación:** `src/lib/email.ts` usa `import { Resend } from 'resend'` y `process.env.RESEND_API_KEY`. El envío se hace con `resend.emails.send(...)`. En el flujo de compra se usa `sendPurchaseEmail` (y existe `sendTicketEmail`). El remitente configurado en el código es `'Festival Pucón <noreply@festivalpucon.cl>'`.

### 3.2 DNS (SPF, DKIM, DMARC)

**Respuesta:** **No se puede saber desde el código.** La configuración de DNS (registros SPF, DKIM, DMARC para el dominio de envío) es externa al repositorio. Solo puede confirmarse en el panel de Resend y en el DNS del dominio. **Debes confirmar si tienes acceso al DNS de `festivalpucon.cl` (o del dominio desde el que envías) y si los registros recomendados por Resend están creados.** Sin eso, el riesgo de bloqueo o bandeja de spam es alto con 1.200 correos/día.

---

## BLOQUE 4: Integridad de Datos e Idempotencia

### 4.1 Estructura de la tabla de tickets y restricción UNIQUE sobre pago MP

**Respuesta (parcial):**

- **Tabla `tickets`:** Definida en `supabase/migrations/orders_quantity_and_tickets_table.sql`: `id` (UUID PK), `order_id`, `inventory_id`, `status`, `discount_amount`, `created_at`, `used_at`. No hay columna `payment_id` en `tickets`; el identificador de pago de MP está en la tabla **orders** (`mp_payment_id`).
- **Tabla `orders`:** Las migraciones del repo **no** contienen la creación inicial de `orders`. Solo se ve: añadir columna `quantity`, eliminar UNIQUE sobre `external_reference` (para permitir varias órdenes por mismo external_reference). **No aparece en el repo ninguna restricción UNIQUE sobre `mp_payment_id`.** No puedo afirmar si en tu base real existe esa restricción (podría estar en migraciones no versionadas o en otro entorno).

### 4.2 Comportamiento ante webhook duplicado

**Respuesta (verificado en código):** **Idempotencia por lógica, no por restricción UNIQUE ni UPSERT automático.**

- En `src/app/api/webhooks/mercadopago/route.ts`:
  1. Se consulta si ya existe una orden con `mp_payment_id` igual al `paymentId` del webhook (líneas 136-141).
  2. Si existe y su `status` es `paid`, se retorna `200 OK` sin más procesamiento (líneas 147-150).
  3. Si no, se actualiza `orders` por `external_reference` (y se setea `mp_payment_id` en ese update), se crean filas en `tickets` solo si no existen ya para ese `order_id` (count por `order_id`, si existingTickets > 0 se omite insert), y luego se genera PDF y se envía email.

**Conclusión:** Un segundo webhook duplicado para el mismo pago resulta en: (1) consulta por `mp_payment_id`, (2) si ya hay orden paid → 200 sin cambios; (3) si no, podría intentar de nuevo el update y la creación de tickets (el insert en `tickets` se evita por el `existingTickets > 0`). No hay restricción UNIQUE en BD sobre `mp_payment_id` en el esquema versionado en el repo; si la hubiera, un segundo update/insert que violara UNIQUE lanzaría error y el handler devuelve 200 igual (catch general al final). **No está implementado un UPSERT explícito en la tabla de órdenes**; es update por `external_reference` + `status = 'pending'`.

---

## BLOQUE 5: Persistencia del Activo (PDF)

### 5.1 Política de almacenamiento del PDF

**Respuesta (verificado en código):** **Opción A (efímero).**

- En el webhook: `generateTicketsPDF(items)` devuelve un `Buffer`; ese buffer se pasa a `sendPurchaseEmail(..., pdfBuffer)` como adjunto. No hay llamadas a `supabase.storage`, ni a ningún bucket, en `src/`. El PDF se genera en memoria, se adjunta al email y no se persiste en Storage.

### 5.2 Bucket en Supabase

**Respuesta:** **No hay uso de Supabase Storage en el código.** No existe referencia a buckets ni a `supabase.storage` en el proyecto. No se puede saber desde el repo si en el proyecto Supabase está creado un bucket para PDFs; eso se configura en el dashboard de Supabase o en migraciones de Storage (no encontradas en el repo).

---

## Resumen de lagunas y decisiones pendientes

| Bloque | Lo que el código no define | Necesario para 1.200 trans/día y picos |
|--------|----------------------------|----------------------------------------|
| 1 | Cola de mensajes | Implementar cola (pg_mq, Upstash, Inngest, etc.) y responder 200 al webhook en <2s delegando PDF+email. |
| 2 | Escenario de validación en puerta (A o B) | Definir A (online) o B (offline/híbrido) e implementar API/app de escaneo y, si aplica, JWS. |
| 3 | DNS (SPF, DKIM, DMARC) | Confirmar acceso DNS y configuración en Resend. |
| 4 | UNIQUE en `mp_payment_id` | Verificar en la BD real; si no existe, valorar añadirla o reforzar idempotencia. |
| 5 | Bucket y persistencia del PDF | Decidir si se mantiene efímero o se pasa a Opción B (Storage + link en el email). |

Este documento refleja únicamente lo que se puede afirmar o no desde el código y las migraciones del repositorio.
