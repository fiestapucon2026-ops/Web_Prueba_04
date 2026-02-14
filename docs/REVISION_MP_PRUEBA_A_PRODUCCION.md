# Revisión: paso de Mercado Pago Chile (prueba) a producción

**Objetivo:** Listar todo lo que debe cambiarse y analizar posibles problemas antes de ejecutar. Solo revisión; no ejecución.

---

## 1. Cambios obligatorios (qué tocar)

### 1.1 Variables de entorno (Vercel → Production)

| Variable | Modo prueba (actual) | Modo producción |
|----------|----------------------|------------------|
| **MP_ACCESS_TOKEN** | `TEST-xxxxx` | **Access Token de producción** (`APP_USR-...`). Obtener en [Tus integraciones](https://www.mercadopago.cl/developers/panel/app) → tu app → **Producción** → Credenciales de producción. |
| **MP_WEBHOOK_SECRET** | Secret del webhook de **prueba** | **Secret del webhook de producción**. Se genera al configurar la URL de notificaciones en **Producción** → Webhooks (ver 1.3). |
| **NEXT_PUBLIC_MP_PUBLIC_KEY** | Clave pública de prueba (si se usa) | **Public Key de producción** (misma pantalla Credenciales de producción). |

Las demás variables (**SUPABASE_***, **MP_PAYMENT_DATA_SECRET**, **CRON_SECRET**, **RESEND_API_KEY**, **NEXT_PUBLIC_BASE_URL**, **ADMIN_SECRET**, **ACCESS_CONTROL_KEY**, **QR_SIGNING_SECRET**) **no se cambian** para el paso a producción de MP; son propias de la app.

**Crítico:** En Vercel, aplicar las variables al entorno **Production** (y, si usas Preview para producción, también a Preview). Luego **Redeploy** del deployment de producción.

---

### 1.2 Panel Mercado Pago Chile (desarrolladores)

- **Activar credenciales de producción** (si no está hecho): industria/rubro, sitio web (ej. `https://www.festivalpucon.cl`), aceptar términos.
- **Copiar de Producción → Credenciales de producción:**
  - Access Token → `MP_ACCESS_TOKEN`
  - Public Key → `NEXT_PUBLIC_MP_PUBLIC_KEY` (si usas Bricks/pago on-site).

---

### 1.3 Webhook en producción (obligatorio)

- En la misma app: **Producción** → **Webhooks** (o Notificaciones).
- **URL de notificación (producción):** `https://www.festivalpucon.cl/api/webhooks/mercadopago`
- Eventos: mismo que en prueba (p. ej. **Pagos** / **Payments**).
- **Guardar** y copiar la **Secret signature** (firma del webhook) que MP muestre para esa URL.
- Ese valor → **MP_WEBHOOK_SECRET** en Vercel (solo producción).

Importante: la URL y el secret de **producción** son distintos a los de **prueba**. No reutilizar el secret de prueba en producción.

---

### 1.4 Código (no hay que cambiar)

El código ya diferencia modo prueba y producción:

- **`src/lib/mercadopago.ts`:** Usa `MP_ACCESS_TOKEN` tal cual; no comprueba prefijo.
- **`src/app/api/entradas/create-preference/route.ts`** y **`src/app/api/tickets/create-preference/route.ts`:**
  - Si `MP_ACCESS_TOKEN` empieza por `TEST-` → usan `sandbox_init_point`.
  - Si no (p. ej. `APP_USR-...`) → usan `init_point` (pagos reales).
- **`src/app/api/entradas/create-preference/route.ts`:** Añade `auto_return: 'approved'` solo cuando la base URL es HTTPS y contiene "festivalpucon" (producción).
- **notification_url** y **back_urls** se construyen con la base URL del request (o `NEXT_PUBLIC_BASE_URL`); en producción debe ser `https://www.festivalpucon.cl`.

No hace falta tocar create-preference, webhook, success, by-reference ni process-tickets para el cambio de credenciales.

---

### 1.5 Comprobación de entorno antes del cambio

- **NEXT_PUBLIC_BASE_URL** en Vercel Production debe ser `https://www.festivalpucon.cl` (sin barra final). Si no, back_urls y notification_url podrían apuntar a otro dominio.
- **GET /api/health:** Verificar que en producción aparezcan `mp.hasAccessToken` y `mp.hasWebhookSecret` (tras poner las variables de producción).

---

## 2. Resumen de pasos operativos (orden sugerido)

1. **Mercado Pago (Chile):** Activar producción, copiar Access Token y Public Key de producción; en Producción → Webhooks configurar URL `https://www.festivalpucon.cl/api/webhooks/mercadopago` y copiar la **Secret signature**.
2. **Vercel:** Settings → Environment Variables → Production (y Preview si aplica): actualizar **MP_ACCESS_TOKEN**, **MP_WEBHOOK_SECRET** y **NEXT_PUBLIC_MP_PUBLIC_KEY** con los valores de producción.
3. **Redeploy** del proyecto en Vercel (Production) para cargar las nuevas variables.
4. **Prueba real:** Una compra con monto bajo y tarjeta real; comprobar pago en MP, orden pagada en la app, tickets visibles en Mis entradas y que en Vercel Logs el webhook no devuelve 401.

---

## 3. Análisis de posibles problemas

### 3.1 Firma del webhook (401) en producción

- **Riesgo:** En producción MP usa un **secret distinto** al de prueba. Si en Vercel se deja el secret de prueba o se copia mal el de producción, el webhook responderá 401 y las órdenes no pasarán a `paid` por ese camino.
- **Mitigación:** Copiar exactamente la Secret signature desde el panel de MP (Producción → Webhooks) después de guardar la URL. No espacios ni caracteres de más. Tras el cambio, hacer una compra de prueba y revisar Vercel Logs para `/api/webhooks/mercadopago` (debe ser 200, no 401).
- **Respaldo:** El fallback por **by-reference** (y el fix 23505) sigue activo: si el webhook falla, Mis entradas puede seguir mostrando tickets cuando el usuario hace polling, siempre que la migración sin UNIQUE en `mp_payment_id` esté aplicada y el código desplegado sea el actual.

### 3.2 URL del webhook incorrecta o no guardada

- **Riesgo:** En Producción → Webhooks, si la URL no es exactamente `https://www.festivalpucon.cl/api/webhooks/mercadopago` o no se guarda, las notificaciones no llegarán o llegarán a otra ruta.
- **Mitigación:** Revisar en el panel que la URL de producción sea esa y que se haya guardado; comprobar que el secret que se copia corresponde a esa URL.

### 3.3 Mezcla de credenciales (prueba en Production de Vercel)

- **Riesgo:** Dejar `MP_ACCESS_TOKEN=TEST-...` en el entorno Production de Vercel tras el cambio. Los pagos serían en sandbox y no se cobraría de verdad; o al revés, poner token de producción en Preview y mezclar entornos.
- **Mitigación:** Comprobar en Vercel que Production tenga `APP_USR-...` y que el secret del webhook sea el de la URL de producción. No usar el mismo secret para Preview y Production si las URLs son distintas.

### 3.4 NEXT_PUBLIC_BASE_URL errónea en producción

- **Riesgo:** Si en Production de Vercel `NEXT_PUBLIC_BASE_URL` no es `https://www.festivalpucon.cl`, las `back_urls` y la `notification_url` podrían construirse con otro dominio (p. ej. preview.vercel.app), y MP podría rechazar o redirigir mal.
- **Mitigación:** En Vercel → Environment Variables → Production, fijar `NEXT_PUBLIC_BASE_URL=https://www.festivalpucon.cl`. El código ya usa esa URL como fallback cuando la base del request no es de producción, pero es mejor tenerla explícita.

### 3.5 Tarjetas y montos reales

- **Riesgo:** Al pasar a producción se cobran pagos reales. Una prueba con monto real puede generar reembolsos manuales si no se desea cobrar.
- **Mitigación:** Hacer la primera compra de prueba con un monto bajo; verificar flujo completo (Success → Mis entradas → tickets y/o PDF) y luego comprobar en el panel de MP el pago y, si aplica, reembolso de prueba.

### 3.6 Rate limit y UPSTASH_REDIS

- **Riesgo:** Sin **UPSTASH_REDIS_REST_URL** y **UPSTASH_REDIS_REST_TOKEN**, el rate limit de by-reference y access-token usa memoria por instancia (no fiable en serverless). En tráfico alto podría haber 429 o comportamiento inconsistente.
- **Mitigación:** Para producción con tráfico relevante, configurar Upstash Redis y añadir esas variables. No bloquea el paso a producción de MP, pero es recomendable para estabilidad.

### 3.7 CRON / worker process-tickets

- **Riesgo:** Si el worker que procesa la cola de PDF/email no se invoca (CRON o cron job sin **CRON_SECRET** correcto), los tickets se crean y se muestran en Mis entradas, pero el email con PDF podría no enviarse.
- **Mitigación:** Verificar que el job que llama a `GET /api/workers/process-tickets` con `Authorization: Bearer <CRON_SECRET>` (o `x-cron-secret`) esté configurado en Vercel (Cron Jobs) o externamente, y que **CRON_SECRET** en Vercel coincida.

### 3.8 Idempotencia y UNIQUE en BD

- **Riesgo:** Si en el futuro se vuelve a añadir una restricción UNIQUE en `orders.mp_payment_id`, el fallback de by-reference podría volver a fallar con 23505 cuando haya varias órdenes por pago (entrada + estacionamiento).
- **Mitigación:** No crear UNIQUE en `mp_payment_id`. La migración `20260209_drop_orders_mp_payment_id_unique.sql` ya documenta y elimina esa restricción; mantenerla aplicada en producción.

---

## 4. Checklist pre-producción (MP)

- [ ] Credenciales de producción activadas en MP Chile (sitio web, términos).
- [ ] Access Token de producción (`APP_USR-...`) copiado.
- [ ] Public Key de producción copiada (si se usa Bricks).
- [ ] En Producción → Webhooks: URL `https://www.festivalpucon.cl/api/webhooks/mercadopago` configurada y guardada.
- [ ] Secret signature del webhook de **producción** copiada (no la de prueba).
- [ ] Vercel Production: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `NEXT_PUBLIC_MP_PUBLIC_KEY` (si aplica) y `NEXT_PUBLIC_BASE_URL` actualizados.
- [ ] Redeploy de producción ejecutado.
- [ ] Prueba de compra real (monto bajo) y verificación: pago en MP, orden paid, tickets en Mis entradas, webhook 200 en logs.

---

## 5. Referencias

- **Guía ya existente:** `docs/MERCADOPAGO_PASO_A_PRODUCCION_CHILE.md`
- **Back URLs y auto_return:** `docs/REFERENCIAS_MP_CHILE_BACK_URLS.md`
- **Credenciales MP Chile:** https://www.mercadopago.cl/developers/es/docs/checkout-api/additional-content/your-integrations/credentials
- **Webhooks MP:** https://www.mercadopago.cl/developers/es/docs/your-integrations/notifications/webhooks

---

*Documento de revisión; no incluye ejecución de cambios. Fecha: 2026-02-09.*
