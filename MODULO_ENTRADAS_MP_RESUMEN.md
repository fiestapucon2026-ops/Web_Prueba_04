# Módulo Entradas + Mercado Pago — Resumen y reglas

**Este documento sirve de handoff al siguiente módulo (emails, tickets con QR) y fija las reglas de este módulo.**

---

## Regla de oro (doble ratificación)

- **Este módulo no se toca.** No modificar lógica de: `/api/entradas/*`, `/api/tickets/create-preference`, `/api/webhooks/mercadopago`, flujo de órdenes en BD.
- **No modificar la página de inicio** (está en producción en www.festivalpucon.cl vía Vercel) salvo acuerdo explícito.

---

## Qué hace este módulo

- **Frontend:** `/entradas` — selector de fecha, selector de tickets (entrada + estacionamiento opcional), formulario cliente, POST a `/api/entradas/create-preference`.
- **API entradas:** `GET /api/entradas/inventory` (stock/precios por fecha); `POST /api/entradas/create-preference` (un ítem → delega en `/api/tickets/create-preference`; varios ítems → preferencia MP directa, varias órdenes con mismo `external_reference`).
- **API tickets:** `POST /api/tickets/create-preference` (preferencia MP, una orden por pago).
- **Webhook:** `POST /api/webhooks/mercadopago` — recibe notificación de pago, busca todas las órdenes por `external_reference`, actualiza a `paid`, por cada orden genera PDF y envía email (según código actual).
- **BD:** `orders` (varias filas por mismo `external_reference` permitido), `inventory`, `event_days`, `daily_inventory`, `ticket_types`, `events`.
- **Páginas de resultado:** `/success`, `/failure`, `/pending`. En `/success`: mensaje de pago exitoso, cuenta regresiva configurable, redirección a URL configurable (por defecto www.festivalpucon.cl). Cuando exista la ruta de “mis entradas” en el siguiente módulo, se configura `NEXT_PUBLIC_SUCCESS_REDIRECT_URL` para redirigir allí tras el pago.

---

## MP y página de inicio

- **Mercado Pago:** `back_urls` y `auto_return` se envían con `NEXT_PUBLIC_BASE_URL`. En producción debe ser `https://www.festivalpucon.cl` para que MP redirija a `/success`, `/failure`, `/pending` de este mismo sitio.
- **Página de inicio:** Contenido de www.festivalpucon.cl = este repo desplegado en Vercel; desde Cursor se edita este repo y eso es lo que se ve en ese dominio.

---

## Información para emails y tickets (siguiente módulo)

- **Por orden:** `id`, `external_reference`, `inventory_id`, `user_email`, `amount`, `status`, `mp_payment_id`, `created_at`.
- **Por inventario/ticket:** vía `inventory`: `event_id`, `ticket_type_id`, `total_capacity`; evento: `name`, `date`, `venue`; tipo: `name`, `price`.
- **Para email:** `user_email`, resumen de ítems (nombre tipo, evento, cantidad, monto), enlace a “Ver/descargar tickets” (URL que defina el siguiente módulo).
- **Para ticket/QR:** por cada ítem: identificador único (ej. `order.id` + índice o token), datos cliente, evento, fecha, tipo, QR que codifique ese identificador.
- **Fuente:** el webhook ya obtiene orden + detalles (inventory, event, ticket_type); ese mismo payload es la base para emails y generación de tickets con QR.

---

## Redirección post-pago (configurable)

- **URL de redirección:** `NEXT_PUBLIC_SUCCESS_REDIRECT_URL` (por defecto `https://www.festivalpucon.cl`). El siguiente módulo puede definir una ruta tipo `/mis-entradas` o `/tickets/[ref]` y configurar esta variable para redirigir allí tras “Pago exitoso”.
- **Delay:** `NEXT_PUBLIC_SUCCESS_REDIRECT_SECONDS` (por defecto `10`). Opcional: 5 o 10 segundos antes de redirigir.

Cuando el siguiente módulo tenga la ventana de “mis entradas” (PDF o vista con tickets y QR), se configura `NEXT_PUBLIC_SUCCESS_REDIRECT_URL` a esa URL y, tras el delay, el usuario llega allí desde “Pago exitoso”.
