# Auditoría del sistema de venta de tickets — Festival 20 Feb

**Alcance:** Sistema de venta de tickets (Entrada, Estacionamiento, PROMO) con pago por Mercado Pago; visualización en pantalla, descarga de PDF y envío por email. Incluye revisión de vulnerabilidades.

**Fecha:** Febrero 2026.

---

## 1. Resumen del sistema

| Componente | Tecnología / Ruta |
|------------|-------------------|
| Front venta | Next.js (entradas/tickets, checkout, pago) |
| Pago | Mercado Pago (preferencia → checkout → webhook) |
| Backend | Next.js API Routes + Supabase (Postgres, Storage) |
| Email | Resend (envío tras pago aprobado) |
| Tickets | Tabla `tickets` con `qr_uuid`; PDF generado en servidor; validación en puerta por scanner |

**Flujo de compra (resumido):**

1. Usuario elige entradas (Entrada, Estacionamiento, PROMO) y llega a checkout.
2. Se crea preferencia MP y órdenes `pending` en BD con `external_reference` único.
3. Usuario paga en Mercado Pago; MP notifica al **webhook** `POST /api/webhooks/mercadopago`.
4. Webhook verifica firma (`x-signature` + `MP_WEBHOOK_SECRET`), actualiza órdenes a `paid`, llama a `processApprovedOrder`: crea filas en `tickets` e inserta un job en `job_queue` (tipo `generate_ticket_pdf`) con `external_reference`, `order_ids` y `email`.
5. Un **worker** debe invocar `GET /api/workers/process-tickets` (protegido con `CRON_SECRET`). Ese endpoint procesa jobs: genera PDF, sube a Storage, llama a **Resend** (`sendPurchaseEmail`) para enviar el correo al comprador.
6. El comprador puede **ver tickets en pantalla** y **descargar PDF** desde:
   - **Mis entradas:** `/mis-entradas?token=<access_token>` → `GET /api/orders/by-reference` (token HMAC con `QR_SIGNING_SECRET`, TTL 24h) y `GET /api/orders/by-reference/pdf`.
   - **Éxito de pago:** `/checkout/success/[orderId]` → `GET /api/orders/[id]` (por `order_id` en URL, sin token).

---

## 2. Cumplimiento de requisitos

| Requisito | Estado | Notas |
|-----------|--------|--------|
| Ver tickets en pantalla | **Operativo** | Mis entradas (por token) y checkout success (por order_id). Entrada, Estacionamiento y PROMO se muestran según inventario. |
| Descargar PDF | **Operativo** | PDF desde Mis entradas (by-reference/pdf con token) o desde success; worker sube PDF a Storage y el email incluye enlace al PDF. |
| Enviar al mail del cliente | **No operativo** | El código está implementado (worker llama a `sendPurchaseEmail`), pero el envío depende de: (1) que el worker se ejecute (cron externo con `CRON_SECRET`), (2) `RESEND_API_KEY` en Vercel, (3) dominio `festivalpucon.cl` verificado en Resend. Si alguno falla, el email no llega. |

**Conclusión sobre el email:**  
No es un fallo de lógica de negocio sino de **configuración/operación**: cron que llame al worker, Resend configurado y dominio verificado. Ver `docs/EMAIL_NO_LLEGAN.md` para diagnóstico paso a paso.

---

## 3. Flujo técnico del email (por qué puede no llegar)

- **Webhook** → actualiza órdenes a `paid` y encola job en `job_queue` (correcto).
- **Worker** `GET /api/workers/process-tickets`:
  - Solo se ejecuta si algo **externo** (cron) llama a la URL con `Authorization: Bearer <CRON_SECRET>` (o `x-cron-secret`). No hay cron definido en `vercel.json`.
  - Si no se llama, los jobs quedan en `pending` y nunca se envía el email.
- **Resend:** `sendPurchaseEmail` en `src/lib/email.ts` usa `from: 'Festival Pucón <noreply@festivalpucon.cl>'`. Si `RESEND_API_KEY` no está definido o el dominio no está verificado en Resend, el envío falla (el worker captura el error y marca el job como `failed`; ver `last_error` en `job_queue`).

**Recomendación:**  
1) Configurar un cron (Vercel Cron o cron-job.org) que llame a `https://www.festivalpucon.cl/api/workers/process-tickets` con `Authorization: Bearer <CRON_SECRET>`.  
2) En Vercel: definir `RESEND_API_KEY` y `CRON_SECRET`.  
3) En Resend: verificar el dominio de envío.  
4) Revisar en Supabase la tabla `job_queue` (status, `last_error`) tras una compra de prueba.

---

## 4. Vulnerabilidades y riesgos

### 4.1 Críticas / altas

| ID | Descripción | Ubicación | Recomendación |
|----|-------------|-----------|----------------|
| V1 | **Worker sin rate limit** | `GET /api/workers/process-tickets` | Quien tenga `CRON_SECRET` puede disparar muchas veces el endpoint y saturar cola/Resend/Storage. Añadir rate limit por IP o por token (p. ej. máx. N llamadas/minuto) o restringir por IP del cron. |
| V2 | **IDOR por order_id** | `GET /api/orders/[id]` | Cualquiera que conozca un UUID de orden puede obtener datos del pedido y tokens QR (usado en `/checkout/success/[id]`). El order_id queda en la URL de éxito. | Mitigar: no exponer order_id en logs públicos; valorar redirigir a Mis entradas con token en lugar de success con order_id, o proteger `/api/orders/[id]` con un token de un solo uso ligado a la sesión de pago. |

### 4.2 Medias

| ID | Descripción | Ubicación | Recomendación |
|----|-------------|-----------|----------------|
| V3 | **Rate limit en serverless** | `src/lib/rate-limit.ts` | Si no hay Upstash Redis (`UPSTASH_REDIS_REST_*`), se usa límite en memoria por instancia; en Vercel no es fiable (múltiples instancias). | Configurar Upstash para rate limit fiable en by-reference y access-token. |
| V4 | **Logs con datos sensibles** | Webhook y otros | `console.log` del webhook incluye `data.id`, presencia de headers; no se observan emails ni referencias completas en el fragmento revisado, pero conviene evitar loguear payload completo o PII. | Revisar todos los `console.log`/`console.error` en webhook y worker; no loguear tokens, emails ni referencias completas. |

### 4.3 Bajas / refuerzo

| ID | Descripción | Ubicación | Recomendación |
|----|-------------|-----------|----------------|
| V5 | **Token Mis entradas 24h** | `src/lib/security/access-token.ts` | TTL 24h reduce ventana de IDOR si el link se filtra; el comentario menciona 7 días en un lugar y 24h en otro (constante real 24h). | Unificar documentación/comentarios a 24h. |
| V6 | **Admin por cookie/session** | Rutas `/admin/*` | Las APIs admin usan `verifyAdminKey` (cookie de sesión o header). Asegurar que las cookies tengan `HttpOnly`, `Secure` y `SameSite` según despliegue. | Revisar configuración de la cookie de sesión admin. |

### 4.4 Lo que está bien implementado

- **Webhook MP:** Firma verificada con `MP_WEBHOOK_SECRET` (HMAC, comparación timing-safe); timestamp con tolerancia; sin secret no se procesa (503).
- **Worker:** Autenticación con `CRON_SECRET` y comparación timing-safe; no se usa comparación en claro.
- **Mis entradas:** Acceso por token HMAC (`QR_SIGNING_SECRET`), TTL 24h, verificación timing-safe.
- **Payment-data:** Token de un solo uso con nonce en `idempotency_keys`; consumo atómico (23505 = ya usado).
- **Validación QR en puerta:** `validateTicketByQrUuid` con rol (acceso/caja) para restricción PROMO; validación por `qr_uuid`.
- **RLS:** Tablas críticas (`orders`, `inventory`, `job_queue`) con RLS y política solo `service_role` (migración 20260203).
- **Supabase:** Uso de service role solo en backend; no se exponen anon keys para escritura en tablas críticas desde el cliente.

---

## 5. Resumen ejecutivo

- **Funcionalidad:** Ver tickets en pantalla y descargar PDF están operativos. El envío por email está implementado pero **depende de que el worker sea invocado por un cron** y de que **Resend esté configurado y el dominio verificado**; sin eso, los correos no llegan.
- **Seguridad:** El diseño es sólido (firma webhook, CRON_SECRET, token Mis entradas, payment-data de un solo uso, RLS). Principales mejoras: rate limit en el worker, mitigar IDOR en `GET /api/orders/[id]`, y rate limit fiable (Redis) en endpoints públicos.
- **Acciones prioritarias:**  
  1) Poner en marcha el cron del worker y comprobar Resend (ver `docs/EMAIL_NO_LLEGAN.md`).  
  2) Valorar rate limit en `/api/workers/process-tickets` y restricción o sustitución de acceso por order_id en `/api/orders/[id]`.

---

*Documento de auditoría. No se ha modificado código; solo análisis y recomendaciones.*
