# Pago con tarjeta sin cuenta Mercado Pago (Android / Galaxy)

## Problema

En Samsung Galaxy (y otros Android), el Checkout Pro de Mercado Pago puede mostrar primero la opción de "Entrar con Mercado Pago" o crear cuenta, mientras que en iPhone suele permitir "Pagar con tarjeta" sin iniciar sesión.

## Intento en código (revertido)

Se probó añadir en la preferencia:

```json
"payment_methods": {
  "excluded_payment_types": [{ "id": "account_money" }]
}
```

**Resultado:** En producción (Chile) la API de Mercado Pago rechazó la preferencia y se mostró "Error al crear la sesión de pago. Reintentar más tarde." Por tanto ese bloque se **revirtió** y ya no se envía. El id `account_money` puede no ser válido para el sitio Chile o la cuenta.

## Si en Android sigue pidiendo cuenta

1. **Revisar en el panel de Mercado Pago (Chile)**  
   - Entrar a [desarrolladores.mercadopago.cl](https://www.mercadopago.cl/developers) o al panel de tu cuenta de vendedor.  
   - Buscar opciones como "Checkout", "Experiencia de pago" o "Permitir pago sin cuenta" / "Pago invitado".  
   - Algunas cuentas tienen la opción de habilitar "pago con tarjeta sin registro".

2. **Contactar soporte Mercado Pago**  
   - Consultar si en Chile existe la opción de "pago invitado" o "guest checkout" y si puede activarse para tu cuenta.  
   - Preguntar si el comportamiento distinto entre Android e iOS (obligar a crear cuenta en Android) es configurable desde el panel o por API.

3. **Indicar a los usuarios con Galaxy**  
   - Que en la pantalla de pago de MP busquen la opción **"Pagar con tarjeta"** o **"Otros medios de pago"** en lugar de "Entrar con Mercado Pago".  
   - El flujo de tarjeta suele permitir ingresar número, vencimiento y CVV sin crear cuenta.

## Referencia API

- [Crear preferencia (Checkout Pro)](https://www.mercadopago.cl/developers/es/reference/preferences/_checkout_preferences/post)  
- Parámetro `payment_methods.excluded_payment_types`: lista de tipos de pago a ocultar. `account_money` = dinero en cuenta Mercado Pago.
