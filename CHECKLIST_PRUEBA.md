# Qué falta para hacer una prueba

## 1. Prueba del flujo MP cerrado (/tickets → pago → success)

**Ya está listo si tienes:**

- [ ] **Env** (`.env.local` o Vercel):  
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` (TEST-), `MP_WEBHOOK_SECRET`, `NEXT_PUBLIC_BASE_URL`
- [ ] **BD**: tablas `events`, `ticket_types`, `inventory`, `orders`, `idempotency_keys` con datos (ver `GUIA_INSERCION_DATOS.md` y `CHECKLIST_PRE_PRUEBA.md`).

**Pasos:**

1. `npm run dev`
2. Ir a `/tickets`
3. Elegir evento y tipo, usar "Usar email de prueba MP", Comprar → MP → pago de prueba → redirección a `/success`.

---

## 2. Prueba de la vista de entrada con QR (/checkout/success/[id])

**Falta:**

- [ ] **Env**: `QR_SIGNING_SECRET` (valor secreto largo, ej. `openssl rand -hex 32`). Sin esto, `GET /api/orders/[id]` devuelve 500 al firmar.

**Pasos:**

1. Añadir `QR_SIGNING_SECRET` a `.env.local` (y a Vercel si pruebas en Preview).
2. Tener al menos una orden **pagada** en Supabase (`orders.status = 'paid'`).
3. Copiar el `id` de esa orden en Supabase (tabla `orders`).
4. Abrir en el navegador: `http://localhost:3000/checkout/success/[pegar-id-aquí]`.
5. Deberías ver la tarjeta con QR y botón "Guardar Entrada".

---

## 3. Prueba de DateSelector y CustomerForm

**Falta:**

- [ ] **Una página que los use.** Hoy no hay ruta que muestre `DateSelector` ni `CustomerForm`. Opciones:
  - Crear una ruta nueva (ej. `/entradas` o `/checkout`) que muestre primero `DateSelector`, luego `CustomerForm`, y al enviar el formulario llame a create-preference o redirija a `/tickets` con parámetros; **o**
  - Integrarlos en un flujo aparte (módulo nuevo) sin tocar `/tickets` (módulo MP cerrado).

Mientras no exista esa página, solo puedes probar los componentes en una página de desarrollo o storybook.

---

## 4. Prueba del seed (event_days, daily_inventory)

**Pasos:**

1. Aplicar migración: ejecutar en Supabase SQL Editor el contenido de `supabase/migrations/event_days_daily_inventory.sql` (si aún no está aplicada).
2. En terminal, con env cargada:  
   `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed`
3. Comprobar en Supabase: tablas `event_days` (12 filas), `daily_inventory` (48 filas), y `ticket_types` con Familiar, Todo el Día, Estac. Normal, Estac. VIP.

**Nota:** El flujo actual de `/tickets` y create-preference usa `events` + `inventory`, no `event_days` + `daily_inventory`. El seed sirve para tener la matriz de fechas/precios lista para cuando una nueva pantalla consuma esas tablas.

---

## 5. Resumen mínimo para “hacer una prueba”

| Objetivo                         | Qué tener                         | Acción                                      |
|----------------------------------|-----------------------------------|---------------------------------------------|
| Probar compra MP                 | Env + BD (events/inventory/orders)| Ir a `/tickets` y completar compra de prueba |
| Probar pantalla de entrada con QR| `QR_SIGNING_SECRET` + orden paid  | Abrir `/checkout/success/[order_id]`        |
| Probar grilla de fechas + formulario | Nueva página que los use      | Crear ruta que renderice DateSelector + CustomerForm |
| Probar datos del seed            | Migración aplicada + env          | `npm run db:seed` y revisar tablas en Supabase |
