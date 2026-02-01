# Solución para dejar 100% operativo el módulo /entradas

**Objetivo:** Una sola transacción = elegir fecha → ver precios y FOMO → elegir **un** tipo de ticket (cantidad 1) → datos cliente → pagar con MP → volver de MP. Sin tocar create-preference ni webhook (módulo cerrado).

**Regla de negocio:** Por transacción solo se permite **un tipo de ticket, cantidad 1**. Así se reutiliza create-preference tal cual.

---

## Orden de implementación

### FASE A — Esquema y datos

**A.1 Migración: `event_days.event_id`**

- Archivo: `supabase/migrations/entradas_event_id.sql` (nuevo).
- Añadir columna `event_id UUID REFERENCES public.events(id) ON DELETE SET NULL` a `public.event_days`.
- Crear índice `idx_event_days_event_id ON public.event_days(event_id)`.
- No tocar RLS ni políticas existentes.

**A.2 Seed ampliado**

- Archivo: `supabase/seed.ts` (modificar).
- Orden de ejecución:
  1. **ticket_types** (igual que ahora: Familiar, Todo el Día, Estac. Normal, Estac. VIP).
  2. **events:** para cada fecha, get-or-create: SELECT id FROM events WHERE date >= date::date AND date < date::date + 1; si no hay fila, INSERT en events (name, date, venue) y tomar id. Guardar mapa `date → event.id`.
  3. **event_days:** upsert por `event_date` incluyendo `event_id` (del mapa); así filas existentes reciben event_id en la misma ejecución.
  4. **daily_inventory:** igual que ahora (event_day_id, ticket_type_id, nominal_stock, price, fomo_threshold, overbooking_tolerance).
  5. **inventory (tabla existente):** para cada evento creado y cada ticket_type_id, insertar una fila en `inventory` con `event_id`, `ticket_type_id`, `total_capacity = nominal_stock * (1 + overbooking_tolerance/100)` (tomar nominal y overbooking de la fila de daily_inventory correspondiente). Usar UNIQUE(event_id, ticket_type_id); upsert si existe.

- Resultado: 12 events, 12 event_days con event_id, 48 daily_inventory, 48 inventory. Órdenes futuras referencian `inventory.id`; el “vendido” por fecha/tipo se obtiene contando orders por inventory_id.

---

### FASE B — APIs

**B.1 GET /api/entradas/inventory**

- Archivo: `src/app/api/entradas/inventory/route.ts` (nuevo).
- Query: `?date=YYYY-MM-DD` (obligatorio).
- Lógica:
  1. Obtener `event_days` por `event_date = date`; si no hay fila, 404.
  2. Obtener `daily_inventory` para ese `event_day_id` con join a `ticket_types` (id, name).
  3. Para cada fila de daily_inventory, obtener el `inventory` correspondiente: `events.id = event_days.event_id` y `inventory.ticket_type_id = daily_inventory.ticket_type_id`; un solo inventory por (event_id, ticket_type_id).
  4. Para cada inventory_id, contar `orders` con status in ('pending', 'paid') → `sold`.
  5. `available_stock = total_capacity - sold`. Si `event_days.event_id` es NULL, responder 404 o 503.
  6. **occupied_pct** (FOMO): `occupied_pct = nominal_stock > 0 ? Math.min(100, Math.round((sold / nominal_stock) * 100)) : 0`. No usar (nominal_stock - available_stock)/nominal_stock (usar nominal_stock de daily_inventory; para “vendido” usar sold; si nominal_stock es 0 no dividir).
- Respuesta JSON: array de objetos `{ ticket_type_id, name, price, nominal_stock, fomo_threshold, overbooking_tolerance, available_stock, total_capacity, occupied_pct }`.
- Errores: 400 si falta date; 404 si no hay event_day; 404/503 si event_day.event_id IS NULL; 500 en error de BD.

**B.2 POST /api/entradas/create-preference**

- Archivo: `src/app/api/entradas/create-preference/route.ts` (nuevo).
- Body (Zod): `{ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ticket_type_id: z.string().uuid(), quantity: z.literal(1), customer: z.object({ email: z.string().email() }) }`.
- Lógica:
  1. Validar quantity === 1.
  2. Obtener `event_days` por `event_date = date`; si no hay, 404.
  3. Obtener `event_id = event_days.event_id`.
  4. Obtener `inventory` por `event_id` y `ticket_type_id`; si no hay o no hay stock (misma lógica que create-preference: total_capacity - count(orders pending/paid) &lt; 1), 409 o 404.
  5. Construir payload para create-preference: `{ event_id, ticket_type_id, quantity: 1, payer_email: customer.email }`.
  6. Generar Idempotency-Key estable (ej. hash de date + ticket_type_id + email + slot de tiempo o timestamp por minuto).
  7. Llamar **internamente** a la lógica de create-preference: o bien `fetch(origin + '/api/tickets/create-preference', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(payload) })` (usar `process.env.NEXT_PUBLIC_BASE_URL` o request.url para origin), o bien importar/refactorizar la lógica en un helper compartido y llamarla desde aquí (sin modificar el route de create-preference).
  8. Devolver la misma respuesta que create-preference (init_point o error).
- No modificar `src/app/api/tickets/create-preference/route.ts`.

---

### FASE C — UI

**C.1 TicketSelector**

- Archivo: `src/components/checkout/TicketSelector.tsx` (nuevo).
- Props: `inventoryData` (array del tipo devuelto por GET /api/entradas/inventory), `onCartChange: (cart: { ticket_type_id: string; name: string; price: number; quantity: number } | null) => void`. Por esta versión el carrito es un solo ítem (objeto o null).
- UI (tema oscuro):
  - Lista vertical de cards (bg-neutral-900, texto blanco).
  - Por ítem: nombre, precio (formato CLP), nominal_stock, available_stock; si `occupied_pct >= fomo_threshold` mostrar badge “¡ÚLTIMOS TICKETS!” (o texto parpadeante).
  - Controles +/- para quantity; máximo = available_stock (número que viene del API). Mínimo 0; si quantity > 0, onCartChange({ ticket_type_id, name, price, quantity: 1 }) (solo 1 permitido); si 0, onCartChange(null).
- Tipado: definir interfaz para ítem de inventario (ticket_type_id, name, price, nominal_stock, fomo_threshold, overbooking_tolerance, available_stock, total_capacity, occupied_pct).

**C.2 Página /entradas**

- Archivo: `src/app/entradas/page.tsx` (nuevo).
- Estado: `selectedDate: string | null`, `inventory: array | null`, `loading: boolean`, `cart: { ticket_type_id, name, price, quantity: 1 } | null`, `customerData` (opcional, si se quiere pre-llenar CustomerForm), `submitLoading: boolean`.
- Flujo:
  1. Renderizar DateSelector; `onSelectDate` → setSelectedDate(date).
  2. `useEffect`: si selectedDate, fetch `GET /api/entradas/inventory?date=${selectedDate}` → setInventory; setLoading true/false.
  3. Si selectedDate y inventory: renderizar TicketSelector con inventoryData={inventory}, onCartChange=setCart.
  4. Si cart no null: renderizar CustomerForm; mostrar resumen (1 ticket, precio total = cart.price); al submit del formulario: validar CustomerForm, luego POST /api/entradas/create-preference con { date: selectedDate, ticket_type_id: cart.ticket_type_id, quantity: 1, customer: { email: values.email } }; si respuesta ok con init_point, window.location.href = init_point; si error, mostrar mensaje.
  5. Tema: fondo bg-black; transiciones suaves al mostrar TicketSelector y al mostrar CustomerForm (opcional).
- No usar /api/checkout (deprecated); usar solo POST /api/entradas/create-preference.

---

### FASE D — Verificación

**D.1 Variables de entorno**

- `.env.local`: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MP_ACCESS_TOKEN (TEST-…), MP_WEBHOOK_SECRET, NEXT_PUBLIC_BASE_URL (ej. http://localhost:3000), QR_SIGNING_SECRET (para /checkout/success/[id]).
- Para POST /api/entradas/create-preference que hace fetch al mismo origen, NEXT_PUBLIC_BASE_URL debe ser la URL del servidor (en local, http://localhost:3000).

**D.2 Seed y migración**

- Aplicar migración A.1 en Supabase.
- Ejecutar seed: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed`.
- Verificar en Supabase: 12 events, 12 event_days con event_id, 48 inventory, 48 daily_inventory.

**D.3 Prueba en navegador**

- Ir a http://localhost:3000/entradas.
- Elegir 14 Feb → deben cargar precios altos (Familiar 4000, etc.).
- Elegir 06 Feb → precios estándar.
- Seleccionar 1 ticket (cantidad 1) → completar CustomerForm → Pagar → redirección a MP; tras pago, vuelta a /success (o configurar back_url para /checkout/success/[order_id] si se quiere sin tocar módulo cerrado, pasando order_id por query si MP lo permite).

---

## Resumen de archivos

| Acción | Archivo |
|--------|--------|
| Crear | `supabase/migrations/entradas_event_id.sql` |
| Modificar | `supabase/seed.ts` (events + event_days.event_id + inventory) |
| Crear | `src/app/api/entradas/inventory/route.ts` |
| Crear | `src/app/api/entradas/create-preference/route.ts` |
| Crear | `src/components/checkout/TicketSelector.tsx` |
| Crear | `src/app/entradas/page.tsx` |

**No modificar:** `src/app/api/tickets/create-preference/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`, `src/app/tickets/page.tsx`, páginas success/failure/pending (módulo cerrado).

---

## Detalle opcional: llamada interna a create-preference

En B.2, para no duplicar lógica ni tocar el route existente, la opción más simple es:

- Hacer `fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/tickets/create-preference', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ event_id, ticket_type_id, quantity: 1, payer_email: customer.email }) })` desde el route handler de entradas.
- En local, NEXT_PUBLIC_BASE_URL debe ser http://localhost:3000 para que el servidor se llame a sí mismo. Devolver al cliente la misma respuesta (init_point o error).

Alternativa: extraer la lógica de create-preference a un helper (ej. `lib/createPreference.ts`) y llamarla desde ambos routes; eso implica refactorizar el route actual (sigue siendo “sin cambiar comportamiento”, solo estructura). La opción fetch mantiene el módulo cerrado intacto.

---

Con esta solución, el módulo /entradas queda 100% operativo: fecha → inventario con precios y FOMO → un ticket → datos cliente → pago MP → vuelta de MP, usando el mismo flujo de create-preference y webhook sin modificarlos.
