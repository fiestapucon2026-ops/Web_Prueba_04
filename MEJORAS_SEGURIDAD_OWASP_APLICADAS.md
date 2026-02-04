# Mejoras de seguridad OWASP aplicadas (2026-02-03)

**Respaldo:** Todos los archivos modificados están en `respaldo_pre_seguridad_owasp/*.bak`.

---

## 1. RLS en Supabase (P0)

- **Migración:** `supabase/migrations/20260203_rls_orders_inventory_job_queue.sql`
- **Qué hace:** Habilita RLS en `orders`, `inventory` y `job_queue` con política solo para `service_role`. Sin estas políticas, cualquier cliente con ANON_KEY podría leer/escribir.
- **Acción obligatoria:** Ejecutar el SQL en Supabase (Dashboard → SQL Editor) o aplicar migraciones con `supabase db push` si usas CLI.

---

## 2. Atomicidad de venta (P0)

- **Migración:** `supabase/migrations/20260203_create_orders_atomic_rpc.sql`
- **Qué hace:** Función `create_orders_atomic(p_external_reference, p_user_email, p_items)` que en una transacción bloquea filas de inventario, valida stock y crea órdenes. Evita overselling por condición de carrera.
- **Código:** `src/app/api/entradas/create-preference/route.ts` y `src/app/api/tickets/create-preference/route.ts` llaman a esta RPC antes de crear la preferencia en MP. Si MP falla, se eliminan las órdenes recién creadas (rollback de stock).
- **Acción obligatoria:** Ejecutar la migración en Supabase.

---

## 3. Tabla de auditoría (P2)

- **Migración:** `supabase/migrations/20260203_audit_log.sql`
- **Qué hace:** Tabla `audit_log` (event_type, payload, ip_or_origin, created_at) con RLS solo service_role.
- **Código:** En `src/app/api/webhooks/mercadopago/route.ts`, ante fallo de verificación de firma se inserta una fila con `event_type: 'webhook_mp_signature_failed'`.
- **Acción obligatoria:** Ejecutar la migración en Supabase.

---

## 4. Token "Mis entradas" 24h (P1 – IDOR)

- **Archivo:** `src/lib/security/access-token.ts`
- **Cambio:** TTL reducido de 7 días a **24 horas**. Reduce la ventana de abuso si se filtra el link.

---

## 5. Cron: comparación timing-safe (P2)

- **Archivo:** `src/app/api/workers/process-tickets/route.ts`
- **Cambio:** Verificación de `CRON_SECRET` con `crypto.timingSafeEqual` en lugar de `===` para evitar timing attacks.

---

## 6. Rate limit con Upstash (P1)

- **Nuevo:** `src/lib/rate-limit.ts`. Si existen `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, usa Upstash Redis para el límite por IP. Si no, fallback en memoria (con aviso en consola; en serverless no es fiable).
- **Uso:** `src/app/api/orders/access-token/route.ts` y `src/app/api/orders/by-reference/route.ts` usan `checkRateLimit(ip, limit, windowMs)`.
- **Opcional:** Crear proyecto en https://console.upstash.com/, copiar URL y token a Vercel (y a `.env.local` en desarrollo).

---

## Orden recomendado tras deploy

1. En Supabase: ejecutar las **tres migraciones** en este orden: RLS → create_orders_atomic → audit_log.
2. En Vercel: añadir (opcional) `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` para rate limit fiable.
3. Desplegar: `npx vercel deploy --prod`.
4. Probar flujo de compra (un ítem y multi-ítem) y revisar `audit_log` si hay fallos de firma en el webhook.
