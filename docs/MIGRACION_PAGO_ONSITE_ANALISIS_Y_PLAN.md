# Migración a pago on-site (Bricks) – Análisis, riesgos y plan

## 1. Riesgos de migrar a flujo on-site (Bricks o Checkout API)

| Riesgo | Nivel | Mitigación |
|--------|--------|------------|
| **Regresión en pagos que hoy funcionan** | Alto | Respaldo completo del flujo actual (rutas + páginas); variable de entorno o feature-flag para alternar Checkout Pro vs Bricks; rollback en un deploy. |
| **Órdenes pendientes abandonadas** | Medio | Hoy: el usuario va a MP y si abandona, la orden queda pending. Con Bricks: reservamos orden al “ir a pagar” y luego mostramos el Brick; si cierra sin pagar, la orden sigue pending. Mismo efecto; opcional: job de limpieza de órdenes pending > 24 h. |
| **Doble pago / doble clic** | Medio | Idempotencia en el endpoint que crea el Payment: por `external_reference` + cabecera `Idempotency-Key`; rechazar si ya existe un pago aprobado para ese `external_reference`. |
| **Exposición de credenciales** | Alto | Bricks requiere **public key** (no access token) en el front. Usar `NEXT_PUBLIC_MP_PUBLIC_KEY` solo en cliente; nunca enviar `MP_ACCESS_TOKEN` al navegador. |
| **Webhook / notificaciones** | Bajo | El webhook actual ya procesa eventos `payment` por `payment_id` y `external_reference`. Los pagos creados con Payment API disparan el mismo webhook; no hay cambio de contrato. |
| **Complejidad y tiempo** | Medio | Dos flujos de entrada: `/tickets` (un ítem) y `/entradas` (uno o más ítems con fecha). Ambos deben poder usar Bricks; la lógica de reserva (órdenes + monto) se reutiliza. |
| **Certificación PCI** | Bajo | Con Bricks, los datos de tarjeta los maneja MP (iframe/SDK); nosotros solo recibimos un token. No almacenar ni loguear el token. |
| **Testing en sandbox** | Medio | Probar con tarjetas de prueba de MP (Chile); validar success/pending/failure y que el webhook actualice órdenes y envíe PDF/email. |

---

## 2. Respaldo de lo que tenemos ahora (sin tocar el flujo actual)

- **Rutas a respaldar (copia en carpeta `respaldo_checkout_pro/`):**
  - `src/app/api/tickets/create-preference/route.ts` → `respaldo_checkout_pro/api/tickets/create-preference/route.ts`
  - `src/app/api/entradas/create-preference/route.ts` → `respaldo_checkout_pro/api/entradas/create-preference/route.ts`
- **Páginas que usan `init_point` (respaldo de los fragmentos relevantes o copia de archivo):**
  - `src/app/tickets/page.tsx` (llama create-preference y redirige a `result.init_point`)
  - `src/app/entradas/page.tsx` (llama create-preference y redirige a `data.init_point`)
- **No se toca (se reutiliza igual):**
  - `src/app/api/webhooks/mercadopago/route.ts`
  - `src/lib/mercadopago.ts` (ya tiene `paymentClient`; se usará para crear Payment)
  - `create_orders_atomic`, success/failure/pending, mis-entradas, by-reference, process-tickets, etc.

Estrategia: copiar los archivos listados a `respaldo_checkout_pro/` con nombres que dejen claro que son el flujo Checkout Pro. El código actual en `src/` se mantiene funcionando hasta que la migración esté probada; luego se puede decidir si se reemplaza por completo o se deja un switch (env) entre Checkout Pro y Bricks.

---

## 3. Propuesta de implementación (flujo on-site con Bricks)

### 3.1 Arquitectura del nuevo flujo

1. **Reserva (sin redirigir a MP)**  
   - Nuevo endpoint: `POST /api/tickets/reserve` (y/o `POST /api/entradas/reserve`).  
   - Mismo cuerpo que el create-preference actual (event_id, ticket_type_id, quantity, payer_email, event_date para tickets; date, items, customer para entradas).  
   - Hace lo mismo que hoy hasta crear órdenes: valida, calcula precios, llama `create_orders_atomic`, genera `external_reference`.  
   - **No** crea preferencia en MP.  
   - Respuesta: `{ external_reference, transaction_amount, payer_email, currency_id: "CLP" }` (y para entradas la suma de todos los ítems).  
   - Si falla la reserva (stock, etc.), se responde error y no se crea orden.

2. **Página de pago con Brick**  
   - Nueva ruta: `/pago` (o `/checkout`). Recibe por query o state `external_reference` (y opcionalmente `payer_email`).  
   - La página carga el SDK de Bricks (Card Payment Brick), inicializado con `transaction_amount` y `payer.email` obtenidos del backend (llamada a `GET /api/orders/payment-data?external_reference=...` que devuelve amount y email; debe validar token de acceso o firma para no exponer datos sin control).  
   - Alternativa más simple: la página `/pago` recibe `external_reference`; llama a un endpoint que devuelve `{ transaction_amount, payer_email }` solo si la orden existe y está en `pending` (y opcionalmente con un token de un solo uso para evitar enumeración).  
   - El usuario completa la tarjeta en el Brick; al enviar, el Brick devuelve un `token` (y `payment_method_id`).  
   - El front llama a `POST /api/tickets/create-payment` (o `/api/entradas/create-payment`) con `{ external_reference, token, payment_method_id, payer_email }`.  
   - El backend crea el pago con `paymentClient.create({ body: { transaction_amount, token, payer, external_reference, ... } })` y devuelve `{ status, redirect_url }`.  
   - El front redirige a `redirect_url` (success, pending o failure) según `status`.

3. **Crear pago en backend**  
   - Nuevo endpoint: `POST /api/tickets/create-payment` (body: `external_reference`, `token`, `payment_method_id`, `payer` con email).  
   - Validar que exista una orden con ese `external_reference` y estado `pending`; leer `transaction_amount` de la(s) orden(es).  
   - Llamar a `paymentClient.create` con: `transaction_amount`, `token`, `payer`, `external_reference`, `notification_url`, `statement_descriptor` si aplica.  
   - Idempotencia: si ya existe un pago aprobado para ese `external_reference`, devolver éxito y la URL de success sin crear otro pago.  
   - Respuesta: `{ status: "approved" | "pending" | "rejected" | "in_process", redirect_url }`.

4. **Webhook**  
   - Sin cambios. Sigue recibiendo `payment` con `external_reference`; actualiza órdenes y dispara `processApprovedOrder`.

5. **Flujo en entradas (múltiples ítems)**  
   - Opción A: `POST /api/entradas/reserve` que crea todas las órdenes (main + parking + promo) con un solo `external_reference` y devuelve la suma como `transaction_amount`. Luego el mismo Brick y el mismo `create-payment` (por ejemplo `POST /api/entradas/create-payment`) que usa ese `external_reference` y el monto total.  
   - Opción B: Reutilizar la misma lógica que ya tiene entradas (delegar a tickets cuando es 1 ítem o crear varias órdenes con un `external_reference`) y exponer un único endpoint de reserva y otro de create-payment para “entradas” que internamente lean las órdenes por `external_reference` y sumen el monto.

### 3.2 Variables de entorno

- **Nuevo:** `NEXT_PUBLIC_MP_PUBLIC_KEY` (solo para el front; Chile: clave pública de la aplicación en el panel MP).  
- Mantener: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, etc.

### 3.3 Resumen de archivos a añadir/modificar

| Acción | Archivo / ruta |
|--------|-----------------|
| Respaldo | `respaldo_checkout_pro/api/tickets/create-preference/route.ts` (copia) |
| Respaldo | `respaldo_checkout_pro/api/entradas/create-preference/route.ts` (copia) |
| Respaldo | `respaldo_checkout_pro/app/tickets/page.tsx`, `entradas/page.tsx` (copias) |
| Nuevo | `src/app/api/tickets/reserve/route.ts` (reserva; mismo input que create-preference, devuelve external_reference + amount + payer_email) |
| Nuevo | `src/app/api/entradas/reserve/route.ts` (o delegar a tickets cuando 1 ítem y reutilizar lógica entradas para varios) |
| Nuevo | `src/app/api/tickets/create-payment/route.ts` (crea Payment con token + external_reference) |
| Nuevo | `src/app/api/entradas/create-payment/route.ts` (igual, leyendo órdenes por external_reference y monto total) |
| Nuevo | `src/app/api/orders/payment-data/route.ts` (opcional; devuelve transaction_amount y payer_email por external_reference con validación) |
| Nuevo | `src/app/pago/page.tsx` (página con Card Payment Brick; recibe external_reference; llama reserve o payment-data, luego create-payment y redirige) |
| Modificar | `src/app/tickets/page.tsx`: en lugar de redirigir a `init_point`, llamar a reserve y redirigir a `/pago?external_reference=...` (o usar variable de entorno para elegir flujo Checkout Pro vs Bricks). |
| Modificar | `src/app/entradas/page.tsx`: igual, reserve + redirigir a `/pago?external_reference=...`. |
| Documentar | `.env.example`: añadir `NEXT_PUBLIC_MP_PUBLIC_KEY`. |

### 3.4 Orden sugerido de implementación

1. Crear carpeta `respaldo_checkout_pro/` y copiar rutas y páginas actuales.  
2. Implementar `POST /api/tickets/reserve` y `POST /api/entradas/reserve` (o un solo reserve que maneje ambos con body distinto).  
3. Implementar `POST /api/tickets/create-payment` (y entradas si es distinto).  
4. Implementar página `/pago` con Card Payment Brick (SDK MP en cliente, public key).  
5. Añadir `NEXT_PUBLIC_MP_PUBLIC_KEY` a `.env.example` y documentación.  
6. Cambiar `tickets/page.tsx` y `entradas/page.tsx` para que, si está configurado Bricks (por ejemplo `NEXT_PUBLIC_MP_PUBLIC_KEY` presente), usen reserve + redirección a `/pago`; si no, sigan usando create-preference y `init_point` (respaldo).  
7. Probar en sandbox: flujo completo tickets y entradas, success/pending/failure, webhook y envío de PDF/email.  
8. Desplegar y validar en producción; si algo falla, quitar la public key o el switch para volver a Checkout Pro.

---

## 4. Autorización para ejecutar

**No se ha modificado ni creado código aún.**  
Si confirmas **“Autorizado”** o **“Proceder”**, el siguiente paso será:

1. Crear los respaldos en `respaldo_checkout_pro/`.  
2. Implementar los endpoints de reserva y create-payment.  
3. Implementar la página `/pago` con Bricks y el switch en tickets/entradas según variable de entorno.

**Implementación completada.** Respaldo en `respaldo_checkout_pro/`. Endpoints reserve, payment-data, create-payment. Página `/pago` con Card Payment Brick. Switch por `NEXT_PUBLIC_MP_PUBLIC_KEY`. Variables: `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_PAYMENT_DATA_SECRET`.
