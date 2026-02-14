# Análisis: punto de recuperación 100% (tickets en pantalla + PDF)

**Fecha:** 2026-02-09  
**Alcance:** Solo revisión y análisis. Sin ejecución hasta autorización explícita.  
**Objetivo:** Identificar el commit (o conjunto de respaldos) desde el cual recuperar el sistema al 100% para luego pasar a producción.

---

## 1. Definición de "100% operativo"

- **Success:** Muestra el botón **"Ver e imprimir mis entradas"** (token obtenido vía access-token).
- **Mis entradas:** Muestra los **tickets con QR en pantalla** y permite **generar/descargar PDF**.
- **Backend:** Órdenes pasan a `paid`, se crean filas en `tickets`, el worker genera PDF y envía email (o al menos PDF en Storage y enlace en Mis entradas).

---

## 2. Cronología relevante (solo código del flujo tickets)

| Commit    | Fecha     | Descripción |
|-----------|-----------|-------------|
| dc126d0   | 2026-02-01 | feat: entradas, mis-entradas, BASE, tickets QR, admin. **Primera versión** de success, mis-entradas, by-reference, access-token. Sin fallback MP en by-reference. |
| e3bd4ea   | 2026-02-01 | fix: TicketCard + serverExternalPackages qrcode para build Vercel. |
| 17da185   | 2026-02-01 | Módulo tickets QR: **worker process-tickets**, job_queue, qr_uuid, webhook simplificado. |
| **d04fa88** | **2026-02-03** | **By-reference:** fallback a MP, `processApprovedOrder`, 200 con `pending: true`, caché MP, rate limit 30/min. **Access-token:** acepta `external_reference` **sin filtrar por paid** (token aunque orden pending); acepta `payment_id`/`collection_id`. **Punto mínimo** en que el flujo "tickets en pantalla" puede funcionar aunque el webhook falle (fallback vía by-reference + MP). |
| 9551339   | 2026-02-05 | Estética (español chileno, control de acceso, etc.). No toca flujo tickets. |
| aa5ae49 … 8043457 | 2026-02-07–08 | Fixes de entradas, PDF, fechas, etc. **Ninguno modifica** success, mis-entradas, by-reference, access-token, worker, email de forma que rompa tickets. |
| **3c94255** | **2026-02-08** | **fix(mp): idempotencia P0.** Modifica `email.ts` y `process-tickets/route.ts`. **Rompe** generación de tickets (idempotencia por to_email+subject bloqueaba envío/PDF para email de prueba). |

---

## 3. Conclusión del análisis: punto de recuperación

- **Único commit que rompe el flujo:** **3c94255** (idempotencia P0).
- **Último commit antes de ese cambio:** **8043457** (fix: PDF Fecha sin hora… 2026-02-08).

Por tanto, el **punto de recuperación 100%** (tickets en pantalla + PDF, sin idempotencia que bloquee) es:

- **Commit:** **8043457**

En ese commit están ya:

- Success con "Ver e imprimir mis entradas" y polling a access-token (external_reference o payment_id).
- Access-token que devuelve token con solo `external_reference` (sin exigir `paid`).
- By-reference con fallback a MP y `processApprovedOrder` cuando el pago está `approved`.
- Worker process-tickets y email **sin** la lógica de idempotencia que bloquea el envío.

---

## 4. Respaldos disponibles (no sustituyen a 8043457)

Si en lugar de usar Git se quisiera restaurar solo archivos concretos:

| Origen | Archivos | Uso |
|--------|----------|-----|
| `respaldo_pre_mp_produccion/` | `email_20260208_151537.ts.bak`, `process-tickets-route_20260208_151537.ts.bak` | Versión de email y worker **antes** de idempotencia (equivalente a 8043457 para esos dos archivos). |
| `respaldo_pre_tickets_qr/` | `success_page_*.bak`, `mis_entradas_page_*.bak`, `orders_by_reference_route_*.bak` | Varias fechas; **no** hay un kit único "100% operativo" probado en conjunto. |
| `respaldo_pre_estetica_2026-02-03/` | success, mis_entradas, entradas, etc. | Estado 2026-02-03; by-reference en **d04fa88** ya tiene fallback, pero este respaldo es anterior a d04fa88 para otros archivos. |

La **única forma de garantizar** el estado "100% operativo" de código es usar el commit **8043457** (p. ej. `git reset --hard 8043457` o `git checkout 8043457 -- .`), no una mezcla de respaldos de fechas distintas.

---

## 5. Pasos recomendados (cuando autorices ejecución)

1. **Restaurar código al punto 8043457**  
   - Opción A: `git reset --hard 8043457` (y luego, si quieres deploy, un commit vacío + push para disparar Vercel).  
   - Opción B: `git checkout 8043457 -- .` (solo working tree; luego commit y push).

2. **Desplegar**  
   - Push a `main` (con o sin commit vacío "chore: trigger Vercel deploy") y esperar a que el deploy de 8043457 esté en **Production** en Vercel.

3. **Probar flujo**  
   - Compra de prueba en www.festivalpucon.cl/entradas → Success → "Ver e imprimir mis entradas" → Mis entradas debe mostrar tickets en pantalla y permitir PDF.

4. **Si con 8043457 los tickets siguen sin aparecer**  
   - No sería un problema de versión de código, sino de entorno: webhook (401), CRON del worker, o que by-reference no reciba `payment_id` en la URL cuando el webhook falla. En ese caso habría que revisar:  
     - URL de Success/Mis entradas (si incluye `payment_id`/`collection_id` para el fallback).  
     - Logs del webhook en Vercel (401 = firma).  
     - Ejecución del worker (CRON con `CRON_SECRET`).

---

## 6. Paso a producción (pendiente)

- **Código base:** Una vez recuperado el flujo al 100% con **8043457**, ese mismo commit (o el branch que lo tenga) es la base para pasar a producción.
- **Cambio a producción:** Solo variables (p. ej. `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` a credenciales de producción) y configuración del webhook en el panel de MP, según `INSTRUCCIONES_CHAT_MP_PRODUCCION.md`. No hace falta tocar más código para "pasar a producción" en el sentido MP.

---

**Resumen:** El punto de recuperación 100% es el **commit 8043457**. Restaurar a ese commit (y desplegarlo) es la acción recomendada para recuperar el sistema y, desde ahí, completar el paso a producción. No se ha ejecutado ninguna modificación; este documento es solo análisis.
