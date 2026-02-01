# Referencias oficiales Mercado Pago Chile — back_urls y auto_return

**Fuente:** Documentación y API de desarrolladores de Mercado Pago **Chile** (mercadopago.cl/developers).

---

## 1. Configurar URLs de retorno (Checkout Pro)

**URL:** https://www.mercadopago.cl/developers/es/docs/checkout-pro/configure-back-urls

- La URL de retorno es la dirección a la que se redirige al usuario después de completar el pago (éxito, fallido o pendiente). **Debe ser una página web que controles, como un servidor con dominio nombrado (DNS).**
- Se configura mediante el atributo **`back_urls`** en el backend, en la preferencia de pago. Con este atributo se define que el comprador sea redirigido al sitio configurado, **ya sea automáticamente o a través del botón "Volver al sitio"**, según el estado del pago.
- Se pueden configurar hasta **tres URL**: correspondientes a pago **pendiente**, **éxito** o **error**.

### Atributos (según doc Chile)

| Atributo     | Descripción |
|-------------|-------------|
| **back_urls** | URL de retorno al sitio. Escenarios: `success` (pago aprobado), `pending` (pendiente), `failure` (rechazado). |
| **auto_return** | Los compradores son redirigidos **automáticamente** al sitio cuando se aprueba el pago. Valor: `approved`. **El tiempo de redirección será de hasta 40 segundos y no podrá ser personalizado.** Por defecto también se muestra el botón **"Volver al sitio"**. |

---

## 2. Esquema de apertura (configuración adicional)

**URL:** https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-settings/opening-schema

- **Cita textual:** "Configura correctamente las [back_urls] al crear la preferencia. **Sin ellas, los usuarios no serán redirigidos automáticamente a tu sitio web después del pago, quedándose en la página de Mercado Pago.**" Consulta [Configurar URLs de retorno](https://www.mercadopago.cl/developers/es/docs/checkout-pro/configure-back-urls) para más detalles.

---

## 3. Referencia API — Crear preferencia (Chile)

**URL:** https://www.mercadopago.cl/developers/es/reference/preferences/_checkout_preferences/post

- **Endpoint:** `POST https://api.mercadopago.com/checkout/preferences`
- **Body:** Incluye `back_urls` (objeto con `success`, `pending`, `failure`) y `auto_return: "approved"`.
- **Error documentado:** `invalid_back_urls` — "back_urls invalid. Wrong format."

Ejemplo de body (extraído de la referencia Chile):

```json
"back_urls": {
  "success": "https://test.com/success",
  "pending": "https://test.com/pending",
  "failure": "https://test.com/failure"
},
"notification_url": "https://notificationurl.com",
"auto_return": "approved",
"external_reference": "1643827245"
```

---

## 4. Parámetros devueltos por las back_urls (GET)

La documentación Chile indica que las `back_urls` reciben un GET con parámetros como: `payment_id`, `status` (ej. `approved`, `pending`), `external_reference`, `merchant_order_id`, etc.

---

## Resumen para integración

- **back_urls** son obligatorias para que MP redirija (o muestre "Volver al sitio"); si faltan o tienen formato inválido, el usuario se queda en la página de MP.
- **auto_return: "approved"** provoca redirección automática (hasta 40 s) y además muestra el botón "Volver al sitio".
- Formato inválido de `back_urls` → API devuelve `invalid_back_urls`. La URL debe ser controlada por el comercio (DNS/servidor propio).
