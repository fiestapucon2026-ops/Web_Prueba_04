# Por qué no llegan los emails (post-compra)

Resumen del flujo y causas habituales por las que el comprador no recibe el correo con el enlace a "Mis entradas" (y opcional PDF).

---

## Flujo del email

1. **Pago aprobado** → Webhook de Mercado Pago recibe la notificación.
2. **Webhook** → Actualiza órdenes a `paid` y encola un job en la tabla `job_queue` (tipo `generate_ticket_pdf`) con `external_reference`, `order_ids` y `email`.
3. **Worker** → Alguien debe llamar a **`GET /api/workers/process-tickets`** (protegido con `CRON_SECRET`). Ese endpoint:
   - Lee jobs `pending` de `job_queue`,
   - Genera el PDF de los tickets,
   - Sube el PDF a Storage (opcional),
   - Llama a **Resend** para enviar el email (`sendPurchaseEmail` en `src/lib/email.ts`).
4. **Resend** → Envía el correo desde `noreply@festivalpucon.cl` al email del comprador.

Si **no se ejecuta el worker** o **Resend no puede enviar**, el email no llega.

---

## Causas habituales (revisar en este orden)

| # | Causa | Qué revisar |
|---|--------|--------------|
| 1 | **RESEND_API_KEY no configurado o inválido** | En Vercel → Project → Settings → Environment Variables: que exista `RESEND_API_KEY` con una clave válida de Resend. Si falta, en build aparece la advertencia "RESEND_API_KEY no configurado". |
| 2 | **Dominio de envío no verificado en Resend** | El email se envía desde `Festival Pucón <noreply@festivalpucon.cl>`. En el dashboard de Resend hay que **verificar el dominio** `festivalpucon.cl` (registros DNS que indique Resend). Sin verificación, Resend puede rechazar o no entregar. |
| 3 | **El worker no se ejecuta (cron)** | El worker **no se llama solo**. Algún **cron externo** (p. ej. cron-job.org, o Vercel Cron si lo configuras) debe hacer **GET** a `https://www.festivalpucon.cl/api/workers/process-tickets` con header `Authorization: Bearer <CRON_SECRET>` (o `x-cron-secret: <CRON_SECRET>`). Si el cron no está configurado o usa un `CRON_SECRET` distinto al de Vercel, el worker devuelve 401 y no procesa la cola → no se envía email. |
| 4 | **Jobs en cola fallidos o atascados** | En Supabase, tabla `job_queue`: ver si los jobs de tipo `generate_ticket_pdf` están en `pending` o `failed` y si tienen `last_error`. Si están en `failed`, revisar el mensaje de error (ej. Resend rechazó, dominio no verificado, etc.). |
| 5 | **Correo en spam** | El comprador debe revisar carpeta de spam/correo no deseado. |

---

## Comprobaciones rápidas

1. **Variables en Vercel:**  
   `RESEND_API_KEY` y `CRON_SECRET` definidas para el entorno que sirve la app (Production/Preview según corresponda).

2. **Cron:**  
   Llamar a mano con curl (sustituir `TU_CRON_SECRET`):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer TU_CRON_SECRET" "https://www.festivalpucon.cl/api/workers/process-tickets"
   ```
   Debe devolver **200** (no 401).

3. **Resend:**  
   En Resend: dominio `festivalpucon.cl` verificado; en "Logs" ver si los envíos aparecen como enviados o con error.

4. **Base de datos:**  
   Tras una compra de prueba, en `job_queue` ver si el job pasa de `pending` a `completed` tras la ejecución del cron. Si queda en `failed`, leer `last_error`.

---

## Archivos relevantes (solo lectura en este doc)

- **Envío:** `src/lib/email.ts` — `sendPurchaseEmail`, usa Resend; remitente `noreply@festivalpucon.cl`.
- **Worker:** `src/app/api/workers/process-tickets/route.ts` — procesa `job_queue`, genera PDF, llama a `sendPurchaseEmail`.
- **Webhook:** encola el job (p. ej. en `src/lib/orders/process-approved-order.ts` o en el handler del webhook de Mercado Pago).

---

*Si tras revisar todo lo anterior los emails siguen sin llegar, el siguiente paso es revisar los logs de la función en Vercel (invocaciones a `process-tickets`) y los logs de Resend para el dominio.*
