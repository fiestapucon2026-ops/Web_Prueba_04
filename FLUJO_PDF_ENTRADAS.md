# Flujo de generación del PDF de entradas

## Cómo funciona (no es en la página de éxito)

1. **Usuario paga** → Mercado Pago redirige a `/success`.
2. **Webhook de Mercado Pago** (en segundo plano) recibe la notificación → actualiza órdenes a `paid`, crea filas en `tickets`, **inserta un job en la tabla `job_queue`** (tipo `generate_ticket_pdf`). No genera el PDF ahí.
3. **Worker** (`GET /api/workers/process-tickets`) es llamado por un **cron externo cada 5 minutos** (p. ej. cron-job.org) con header `Authorization: Bearer <CRON_SECRET>`.
4. El worker toma jobs `pending` de `job_queue`, **genera el PDF** (lib/pdf), **lo sube a Supabase Storage** (bucket `tickets`), **envía el email** (Resend) con enlace al PDF y token para Mis entradas, y marca el job como `completed`.

Por tanto: **el PDF no se genera en la pantalla “Venta exitosa”**. Esa pantalla solo espera el token de acceso (orden `paid`) para mostrar “Ver e imprimir mis entradas”. El PDF se genera más tarde (hasta ~5 min después) y llega por **email** con el enlace de descarga; también se puede descargar desde **Mis entradas** (PDF de todas las entradas).

El “ERROR” que se ve en el video/animación del leñador es **parte del chiste del video**, no un error real de la aplicación.

---

## Si el PDF nunca llega: qué revisar

### 1. Que el job se haya encolado (Supabase)

En **Supabase → SQL Editor**:

```sql
SELECT id, type, status, attempts, last_error, created_at, processed_at
FROM public.job_queue
WHERE type = 'generate_ticket_pdf'
ORDER BY created_at DESC
LIMIT 20;
```

- Si **no hay filas** para tu compra: el webhook no insertó el job (revisar que MP llame al webhook, que no falle la firma, y logs de `/api/webhooks/mercadopago` en Vercel).
- Si hay filas con **`status = 'pending'`**: el cron aún no ha pasado o el worker no está siendo llamado.
- Si **`status = 'failed'`**: mirar **`last_error`** (ej.: error al generar PDF, subir a Storage o enviar email).

### 2. Que el cron llame al worker

- **cron-job.org** (u otro): que la URL sea `https://www.festivalpucon.cl/api/workers/process-tickets` (GET) y que envíe el header **`Authorization: Bearer <CRON_SECRET>`**.
- En Vercel: variable **`CRON_SECRET`** definida y con el mismo valor que usa el cron.

### 3. Que el worker pueda generar PDF y enviar email

- **Vercel → Environment Variables**: `RESEND_API_KEY` (para el email con el link al PDF).
- **Supabase → Storage**: bucket **`tickets`** existe y es **público** (o con política que permita lectura de los PDFs).
- **Logs del worker** en Vercel (Functions): si el job pasa a `failed`, en `last_error` y en los logs verás el motivo (PDF, Storage, Resend, etc.).

---

## Resumen

| Dónde              | Qué pasa con el PDF                                      |
|--------------------|----------------------------------------------------------|
| Página “Venta exitosa” | No se genera el PDF; solo se espera el token y se muestra el video. |
| Webhook MP         | Encola el job en `job_queue`; no genera PDF.            |
| Worker (cron 5 min)| Genera el PDF, lo sube a Storage y envía el email.       |
| Usuario            | Recibe email con enlace al PDF y puede usar Mis entradas. |

Si tras una compra no llega el email en unos 5–10 minutos, revisar `job_queue` (status y `last_error`) y que el cron esté llamando al worker con `CRON_SECRET`.
