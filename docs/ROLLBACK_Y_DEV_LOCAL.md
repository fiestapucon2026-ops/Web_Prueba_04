# Rollback y desarrollo local

## Punto de rollback (2026-02-07)

Si `/entradas` colapsa la CPU al cargar (6 núcleos al 100 %, sistema bloqueado):

1. **Respaldo con instrumentación de debug (por si se necesita re-añadir logs):**
   - `respaldo_pre_tickets_qr/entradas_create_preference_route_con_debug_20260207.bak`
   - `respaldo_pre_tickets_qr/tickets_create_preference_route_con_debug_20260207.bak`
   - `respaldo_pre_tickets_qr/entradas_reserve_route_con_debug_20260207.bak`
   - `respaldo_pre_tickets_qr/tickets_reserve_route_con_debug_20260207.bak`
   - `respaldo_pre_tickets_qr/debug_log_ts_20260207.bak`

2. **Estado actual (estable):** Se eliminó toda la instrumentación de debug (dbgLog y `src/lib/debug-log.ts`). Las rutas API quedan sin logs de depuración. Si el colapso persiste, la causa no es el debug.

3. **Probar sin Turbopack:** Next.js 16 usa Turbopack por defecto. Si el colapso continúa, ejecutar:
   ```bash
   npx next dev --webpack
   ```
   (o en `package.json`: `"dev:webpack": "next dev --webpack"`).
   Si con Webpack el sistema no colapsa, el origen es Turbopack en tu máquina.

## Regla de oro n.º 1

Antes de modificar cualquier archivo: crear respaldo (ej. en `respaldo_pre_tickets_qr/` con sufijo `_YYYYMMDD.bak`). Ver `.cursorrules`.
