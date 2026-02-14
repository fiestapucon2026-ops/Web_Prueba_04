# Respaldo recuperación tickets (2026-02-09)

**Problema resuelto:** Tickets no visibles tras venta exitosa (webhook 401 + by-reference 23505).

**Carpeta de respaldo:** `respaldo_post_recuperacion_tickets_20260209/`

- Contiene: copias de by-reference y webhook (fix 23505 y firma), migración SQL, análisis de causa y solución.
- Uso: restaurar archivos o ejecutar migración si se repite el mismo fallo; consultar README y ANALISIS_* dentro de la carpeta.

**Commit del fix:** `dce92f9` — fix: recuperación tickets - fallback 23505 by-reference y firma webhook MP.
