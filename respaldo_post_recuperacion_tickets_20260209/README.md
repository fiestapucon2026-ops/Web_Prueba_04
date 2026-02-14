# Respaldo post-recuperación tickets (2026-02-09)

Respaldo del **estado resuelto** del problema "tickets no visibles tras venta exitosa", para poder recuperar o consultar si se cae en algo similar.

---

## Contenido de esta carpeta

| Archivo | Descripción |
|---------|-------------|
| `orders_by_reference_route_post_fix_23505_20260209.ts.bak` | Código de `src/app/api/orders/by-reference/route.ts` con fallback ante error 23505 (UNIQUE mp_payment_id). |
| `webhooks_mercadopago_route_post_fix_firma_20260209.ts.bak` | Código de `src/app/api/webhooks/mercadopago/route.ts` con firma MP robustecida (tolerancia 10 min, data.id raw y lowercase). |
| `20260209_drop_orders_mp_payment_id_unique.sql` | Migración que elimina UNIQUE en `orders.mp_payment_id` (ejecutar en Supabase si la restricción vuelve a existir). |
| `ANALISIS_SECUENCIA_RECUPERACION_TICKETS.md` | Análisis detallado: síntomas, causa (webhook 401 + 23505), cadena causal, punto de recuperación. |
| `ANALISIS_PUNTO_RECUPERACION_100_PORCIENTO.md` | Análisis del commit 8043457 como punto de recuperación y pasos recomendados. |
| `README.md` | Este archivo. |

---

## Resumen del problema que se resolvió

- **Síntoma:** Tras pagar en Mercado Pago, en Mis entradas se veía "Procesando tu pago" y no aparecían los tickets.
- **Causas:**
  1. **Webhook 401:** Firma del webhook MP fallaba → la orden no pasaba a `paid` por ese camino.
  2. **by-reference 23505:** El fallback intentaba poner el mismo `mp_payment_id` en varias órdenes (entrada + estacionamiento); en BD existía UNIQUE en `mp_payment_id` → violación y fallo del fallback.

---

## Solución aplicada (para repetir o adaptar)

1. **Supabase:** Ejecutar la migración que quita UNIQUE en `orders.mp_payment_id` (o no volver a crear esa restricción).
2. **By-reference:** Si el UPDATE falla con código 23505, actualizar en dos pasos: todas las órdenes a `status='paid'`, luego asignar `mp_payment_id` solo a la primera.
3. **Webhook:** Tolerancia de timestamp 600 s; probar firma con `data.id` en raw y en minúsculas.

---

## Cómo usar este respaldo

- **Restaurar código:** Copiar los `.bak` al path correspondiente (`src/app/api/orders/by-reference/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`) si se pierden cambios o se revierte por error.
- **Restaurar BD:** Ejecutar `20260209_drop_orders_mp_payment_id_unique.sql` en Supabase si en el futuro se añade de nuevo una UNIQUE en `mp_payment_id` y vuelve el 23505.
- **Consultar:** Leer `ANALISIS_SECUENCIA_RECUPERACION_TICKETS.md` para entender la cadena causal y las opciones de recuperación.

---

*Generado 2026-02-09. Commit del fix: dce92f9.*
