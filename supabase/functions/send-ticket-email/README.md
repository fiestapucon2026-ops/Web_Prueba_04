# send-ticket-email

Edge Function para envío de correo post-compra (desacoplado del flujo de pago).

## Trigger

- **Database Webhook:** En Supabase Dashboard → Database → Webhooks, crear webhook en tabla `orders`, evento **INSERT**, URL de la función.
- **Invocación directa:** `POST` con body `{ "order_id": "uuid" }`.

## Secretos (Deno.env / Supabase Secrets)

| Variable | Uso |
|---------|-----|
| `SUPABASE_URL` | Auto-inyectado por Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-inyectado por Supabase |
| `RESEND_API_KEY` | Envío vía Resend (obligatorio) |
| `SITE_URL` o `NEXT_PUBLIC_BASE_URL` | Base URL para el enlace "Ver/Descargar entradas" (ej. `https://tu-dominio.vercel.app`) |
| `RESEND_FROM_EMAIL` | Opcional; por defecto `Festival Pucón <noreply@festivalpucon.cl>` |
| `QR_SIGNING_SECRET` | Replicado en la función para paridad con Block 2; no se usa en el email actual (solo enlace). |

## Auditing

Inserciones en `public.email_logs` (status: `SENT` o `FAILED`, `error_message` si falla).

## Migración

Ejecutar `supabase/migrations/email_logs.sql` antes de usar la función.
