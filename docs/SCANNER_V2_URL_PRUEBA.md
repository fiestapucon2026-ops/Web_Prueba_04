# Módulo Control de Acceso V2 — URL de prueba

Módulo **independiente** con las sugerencias del experto (worker en `/public/workers/`, ScannerV2 con región dinámica, maxScansPerSecond 5, ManualEntryV2, página propia). No modifica `/admin/validar-qr`.

**URL de prueba (producción):**

**https://www.festivalpucon.cl/admin/scanner-v2**

- Misma autenticación admin que validar-qr (clave de acceso).
- Tras login: escáner V2 + alternativa manual debajo.
- Si funciona bien en pruebas, se puede redirigir la ruta antigua a esta o reemplazar el contenido de validar-qr por esta implementación.

**Archivos creados:**

- `public/workers/qr-scanner-worker.min.js` (copiado desde node_modules)
- `src/components/ScannerV2.tsx`
- `src/components/ManualEntryV2.tsx`
- `src/app/admin/scanner-v2/page.tsx`

**Nota:** En qr-scanner 1.4.2 el setter `WORKER_PATH` está deprecado (solo muestra warning). El worker se sirve estáticamente en `/workers/qr-scanner-worker.min.js` por si la librería lo resuelve por URL en algún entorno.
