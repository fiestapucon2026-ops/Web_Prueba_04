# URL de webhook Mercado Pago (producción)

**Registro:** URL configurada en el panel de Mercado Pago para recibir notificaciones de pago.

---

## URL actual (producción)

```
https://www.festivalpucon.cl/api/webhooks/mercadopago
```

- **Dominio:** `www.festivalpucon.cl`
- **Ruta:** `/api/webhooks/mercadopago`
- **Handler en código:** `src/app/api/webhooks/mercadopago/route.ts`

---

## Nota

- La preferencia de pago (create-preference) construye `notification_url` con la misma base que el request (`getBaseUrlFromRequest`), por lo que en producción debe coincidir con esta URL.
- En el panel de Mercado Pago debe figurar exactamente esta URL (sin `/api/payment/webhook` ni otros dominios como `web3-pucon2026.vercel.app`).
- Actualizado: febrero 2026.
