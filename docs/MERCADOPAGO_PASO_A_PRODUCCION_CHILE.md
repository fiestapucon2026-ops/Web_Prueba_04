# Mercado Pago Chile: paso de modo prueba a modo producción

**Objetivo:** Recibir pagos reales en www.festivalpucon.cl usando las credenciales de **producción** de Mercado Pago.

---

## 1. Qué cambia (solo variables de entorno, no código)

El código ya distingue automáticamente:

- Si `MP_ACCESS_TOKEN` empieza por **`TEST-`** → usa **modo prueba** (sandbox, `sandbox_init_point`).
- Si `MP_ACCESS_TOKEN` empieza por **`APP_USR-`** → usa **modo producción** (pagos reales, `init_point`).

No hace falta tocar el código. Solo hay que **sustituir credenciales de prueba por credenciales de producción** en el entorno (Vercel).

---

## 2. Cambios exactos en variables de entorno (Vercel)

| Variable | Modo prueba (actual) | Modo producción (qué poner) |
|----------|----------------------|-----------------------------|
| **MP_ACCESS_TOKEN** | `TEST-xxxxx` (token de prueba) | **Access Token de producción** (empieza por `APP_USR-`). Se obtiene en [Tus integraciones](https://www.mercadopago.cl/developers/panel/app) → tu app → **Producción** → Credenciales de producción. |
| **NEXT_PUBLIC_MP_PUBLIC_KEY** | Clave pública de **prueba** (si usas Bricks/pago on-site) | **Public Key de producción** (misma pantalla Producción → Credenciales de producción). |
| **MP_WEBHOOK_SECRET** | Secret del webhook de **prueba** | **Secret del webhook de producción**. Se obtiene al configurar la URL de notificaciones en **producción** (ver punto 3). |

Las demás variables (**MP_PAYMENT_DATA_SECRET**, Supabase, CRON, etc.) **no cambian**; son propias de tu app.

---

## 3. Dónde obtener las credenciales de producción (Mercado Pago Chile)

1. Entra a **[Tus integraciones](https://www.mercadopago.cl/developers/panel/app)** (desarrolladores.mercadopago.cl o mercadopago.cl/developers).
2. Inicia sesión y elige la **aplicación** que usas para el festival.
3. En el menú izquierdo: **Producción** → **Credenciales de producción**.
4. Si es la primera vez, tendrás que **activar** las credenciales de producción:
   - Industria/rubro del negocio.
   - **Sitio web (obligatorio):** por ejemplo `https://www.festivalpucon.cl`.
   - Aceptar declaración de privacidad y términos → **Activar credenciales de producción**.
5. Copia:
   - **Access Token** (producción) → será el nuevo valor de `MP_ACCESS_TOKEN` (empieza por `APP_USR-`).
   - **Public Key** (producción) → será el nuevo valor de `NEXT_PUBLIC_MP_PUBLIC_KEY` (si usas Bricks).

Documentación oficial: [Credenciales – Mercado Pago Developers Chile](https://www.mercadopago.cl/developers/es/docs/checkout-api/additional-content/your-integrations/credentials).

---

## 4. Webhook en producción (obligatorio para que se confirmen los pagos)

Las notificaciones de pago (para marcar órdenes como pagadas y generar tickets) deben apuntar a tu URL real y usar el **secret de producción**.

1. En la misma app, en el menú izquierdo: **Producción** → **Webhooks** (o **Your integrations** → **Notifications** / **Webhooks**).
2. Configura la **URL de notificación** de producción:
   - **URL:** `https://www.festivalpucon.cl/api/webhooks/mercadopago`
3. Elige los eventos que ya uses (por ejemplo **Pagos** / **Payments**).
4. Guarda y copia la **Secret signature** (o “Firma del webhook”) que te muestre Mercado Pago para esa URL.
5. Ese valor es el nuevo **MP_WEBHOOK_SECRET** en Vercel (solo para producción).

Si en prueba tenías otra URL (por ejemplo de Vercel Preview), en producción la URL debe ser la del dominio real (festivalpucon.cl). Cada entorno (prueba/producción) puede tener su propia URL y su propio secret.

---

## 5. Resumen de pasos operativos

1. **En Mercado Pago (Chile):**
   - Activar credenciales de producción si no está hecho.
   - Copiar **Access Token** y **Public Key** de producción.
   - En Producción → Webhooks, configurar URL `https://www.festivalpucon.cl/api/webhooks/mercadopago` y copiar la **Secret signature**.

2. **En Vercel (proyecto del festival):**
   - **Settings** → **Environment Variables**.
   - Para el entorno **Production** (y, si aplica, Preview):
     - **MP_ACCESS_TOKEN** → pegar el Access Token de **producción** (`APP_USR-...`).
     - **NEXT_PUBLIC_MP_PUBLIC_KEY** → pegar la Public Key de **producción** (si usas Bricks).
     - **MP_WEBHOOK_SECRET** → pegar la **Secret signature** del webhook de **producción**.
   - Guardar.

3. **Redeploy:**
   - **Deployments** → menú (⋮) del último deployment → **Redeploy** (o hacer un nuevo deploy desde `main`).
   - Así el entorno de producción de Vercel usa las nuevas variables.

4. **Comprobar:**
   - Hacer una compra de prueba con **tarjeta real** (o el método que vayas a usar) por un monto bajo.
   - Verificar que el pago aparece en [Mercado Pago](https://www.mercadopago.cl) y que en tu app la orden pasa a “pagada” y se generan las entradas (y el webhook no falla en los logs de Vercel).

---

## 6. Qué no hay que cambiar

- **Código del proyecto:** no es necesario tocar create-preference, webhook ni rutas de éxito/fallo; el cambio es solo de credenciales.
- **MP_PAYMENT_DATA_SECRET:** es un secreto **tuyo** (para el token de pago on-site); puede seguir igual.
- **SUPABASE_*, CRON_SECRET, ADMIN_SECRET, etc.:** siguen igual.
- **NEXT_PUBLIC_BASE_URL:** en producción debe ser `https://www.festivalpucon.cl` (ya suele estar así).

---

## 7. Referencias

- [Credenciales – Mercado Pago Developers Chile](https://www.mercadopago.cl/developers/es/docs/checkout-api/additional-content/your-integrations/credentials)
- [Activar credenciales de producción](https://www.mercadopago.cl/developers/es/docs/checkout-api/additional-content/your-integrations/credentials#bookmark_activar_credenciales_de_producción)
- [Webhooks](https://www.mercadopago.cl/developers/es/docs/your-integrations/notifications/webhooks) (configurar URL y secret en producción)
