# Pago con tarjeta sin cuenta Mercado Pago (Android / Galaxy)

## Problema

En Samsung Galaxy (y otros Android), el Checkout Pro de Mercado Pago puede mostrar primero la opción de "Entrar con Mercado Pago" o crear cuenta, mientras que en iPhone suele permitir "Pagar con tarjeta" sin iniciar sesión.

## Respuesta de la IA de Mercado Pago

> En Checkout Pro, por defecto el checkout muestra la opción de pagar con cuenta de Mercado Pago y también como invitado. Si en un Galaxy les "obliga" a crear cuenta, casi siempre es porque tu integración quedó configurada como **solo pagos con cuenta Mercado Pago (modo "Wallet only")**, lo que deshabilita el pago como invitado.
>
> Para evitarlo, revisá en la creación de la preferencia/checkout que **no esté activada la opción de "solo usuarios logueados / wallet"**.

## Cómo generamos el checkout

- **Método:** Preferencia desde **backend** (Node.js), SDK oficial de Mercado Pago (`preferenceClient.create({ body: ... })`).
- **No usamos** plugin ni Checkout Bricks en front; solo redirigimos al `init_point` que devuelve la API.

## JSON de preferencia que enviamos (sin credenciales)

Ejemplo representativo del body que enviamos a `POST https://api.mercadopago.com/checkout/preferences` (Authorization: Bearer **tu_access_token**). No incluimos ningún campo `purpose`, ni `payment_methods` (excluimos ese bloque tras un intento previo que rompía en Chile).

```json
{
  "items": [
    {
      "id": "<ticket_type_id UUID>",
      "title": "Promo 2x1 Cerveza Artesanal - Festival Pucón 2026 (x1)",
      "quantity": 1,
      "unit_price": 12000,
      "currency_id": "CLP"
    }
  ],
  "payer": {
    "email": "comprador@ejemplo.com"
  },
  "back_urls": {
    "success": "https://www.festivalpucon.cl/success",
    "failure": "https://www.festivalpucon.cl/failure",
    "pending": "https://www.festivalpucon.cl/pending"
  },
  "notification_url": "https://www.festivalpucon.cl/api/webhooks/mercadopago",
  "auto_return": "approved",
  "external_reference": "<UUID de la orden>"
}
```

**Qué no enviamos:** `payment_methods`, `purpose`, `shipments`, ni ningún parámetro que diga explícitamente "solo wallet" o "solo usuarios logueados". Si el modo "Wallet only" existe, podría estar en **configuración de la aplicación/cuenta** en el panel de MP (Chile), no en este JSON.

## Intento en código (revertido)

Se probó añadir en la preferencia:

```json
"payment_methods": {
  "excluded_payment_types": [{ "id": "account_money" }]
}
```

**Resultado:** En producción (Chile) la API de Mercado Pago rechazó la preferencia y se mostró "Error al crear la sesión de pago. Reintentar más tarde." Por tanto ese bloque se **revirtió** y ya no se envía.

## Qué revisar / preguntar a Mercado Pago

1. **Panel de la aplicación (Chile)**  
   En [desarrolladores.mercadopago.cl](https://www.mercadopago.cl/developers) → Tu aplicación → revisar si hay opción tipo "Checkout", "Experiencia de pago", "Solo usuarios con cuenta" / "Wallet only" y **desactivarla** si existe.

2. **Soporte / IA de MP**  
   Preguntar: *"¿Dónde se activa o desactiva el modo 'Wallet only' para Checkout Pro en Chile? En nuestra preferencia no enviamos `purpose` ni `payment_methods`; ¿ese modo se configura en el panel de la aplicación?"*  
   Pegar el JSON de preferencia de arriba (y este doc) si piden el body.

3. **Indicar a usuarios con Galaxy**  
   Que en la pantalla de pago de MP busquen **"Pagar con tarjeta"** o **"Otros medios de pago"** en lugar de "Entrar con Mercado Pago".

## Referencia API

- [Crear preferencia (Checkout Pro) – Chile](https://www.mercadopago.cl/developers/es/reference/preferences/_checkout_preferences/post)
