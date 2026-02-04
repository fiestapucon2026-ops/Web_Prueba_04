# Traspaso para nuevo chat — Módulo Tickets QR + Email (99% listo)

**Para copiar al nuevo chat:** usar también (o en su lugar) el archivo **`INSTRUCCIONES_PARA_SIGUIENTE_CHAT.md`**, que incluye el diagnóstico del token truncado en la URL de Mis entradas.

---

## REGLA DE ORO (OBLIGATORIA)

- **Antes de modificar cualquier archivo: respaldar primero.**  
  Ejemplo: `cp src/app/success/page.tsx respaldo_pre_tickets_qr/success_page_antes_XXXX.bak`  
- No tocar código sin respaldo. Respaldos en `respaldo_pre_tickets_qr/`.

---

## ESTADO ACTUAL: 99% OPERATIVO

- **Deploy:** Producción en **www.festivalpucon.cl** (Vercel CLI: `npx vercel deploy --prod`).  
  Los push a GitHub no disparan Vercel (integración rota); los despliegues son manuales por CLI.
- **Módulo tickets QR + cola:**  
  Webhook encola jobs → worker `/api/workers/process-tickets` → cron externo (cron-job.org cada 5 min) con header `Authorization: Bearer <CRON_SECRET>` → PDF a Storage + email con link. **Operativo.**
- **Página "Venta exitosa" (`/success`):**  
  - Sin countdown ni redirección automática. El cliente elige: **Ver e imprimir mis entradas** | **Volver al inicio** | **Comprar más entradas**.  
  - Obtiene token vía `external_reference` o `payment_id`/`collection_id` (API `/api/orders/access-token`).  
  - Respaldo antes del último cambio: `respaldo_pre_tickets_qr/success_page_antes_sin_countdown.bak`.

---

## PENDIENTE (1%) — PARA EL NUEVO CHAT

### 1. Error "Error al cargar" en Mis entradas

- **Síntoma:** En `www.festivalpucon.cl/mis-entradas?token=...` aparece "Error al cargar. No se pudieron cargar tus entradas. El enlace puede haber expirado (válido 7 días)."
- **Causa posible:** Token inválido, truncado en la URL, o API `GET /api/orders/by-reference` falla (por ejemplo 404/500). Revisar:  
  - Que el token se pase completo en la URL (no recortado).  
  - Respuesta de `GET /api/orders/access-token?external_reference=<uuid>` (debe ser 200 con `{ token: "..." }`).  
  - Respuesta de `GET /api/orders/by-reference?token=<token>` (debe ser 200 con órdenes y tickets).  
- **Variable crítica en Vercel:** `QR_SIGNING_SECRET` debe existir (generar con `openssl rand -hex 32`). Sin ella, access-token devuelve 500.

### 2. Verificar flujo post-compra

- Tras compra de prueba: en `/success` debe aparecer el botón **"Ver e imprimir mis entradas"** (cuando el token se obtiene bien).  
- Al hacer clic → `/mis-entradas?token=...` debe cargar las entradas sin "Error al cargar".  
- Si sigue el error, depurar: Network (F12) para ver qué petición falla (access-token, by-reference) y con qué código/body.

---

## ARCHIVOS CLAVE

| Ruta | Rol |
|------|-----|
| `src/app/success/page.tsx` | Venta exitosa: sin tiempo, 3 botones (Ver e imprimir / Volver al inicio / Comprar más). |
| `src/app/api/orders/access-token/route.ts` | Token para Mis entradas; acepta `external_reference` o `payment_id`/`collection_id`. Requiere `QR_SIGNING_SECRET`. |
| `src/app/api/orders/by-reference/route.ts` | Devuelve órdenes + tickets por token; usado por Mis entradas. |
| `src/app/mis-entradas/page.tsx` | Página Mis entradas; usa token en query y llama by-reference. |
| `src/app/api/webhooks/mercadopago/route.ts` | Webhook MP: encola job `generate_ticket_pdf` en `job_queue`. |
| `src/app/api/workers/process-tickets/route.ts` | Worker: procesa cola, genera PDF, Storage, envía email. Protegido con `CRON_SECRET`. |

---

## VARIABLES DE ENTORNO (Vercel)

- `QR_SIGNING_SECRET` — **Obligatoria** para access-token y firma de tokens Mis entradas.  
- `CRON_SECRET` — Para el worker; cron-job.org llama con header `Authorization: Bearer <CRON_SECRET>`.  
- `SUPABASE_*`, `MP_*`, `RESEND_API_KEY`, `NEXT_PUBLIC_BASE_URL`, etc. (ya usadas).

---

## DEPLOY

- Siempre: `npx vercel deploy --prod` desde la raíz del proyecto.  
- No confiar en deploy automático por push (no funciona en este proyecto).

---

## RESPALDOS RECIENTES (respaldo_pre_tickets_qr/)

- `success_page_antes_sin_countdown.bak`  
- `entradas_create_preference_route_antes_external_ref_success.bak`  
- `orders_access_token_route_antes_payment_id.bak`  
- Otros en la misma carpeta.

---

**Objetivo para el nuevo chat:** Resolver el "Error al cargar" en Mis entradas y confirmar que el flujo Venta exitosa → Ver e imprimir mis entradas → listado de entradas funciona de punta a punta. Mantener la regla de oro: respaldar antes de tocar cualquier archivo.
