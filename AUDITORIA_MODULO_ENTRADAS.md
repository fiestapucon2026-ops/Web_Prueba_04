# Auditoría: Módulo /entradas

**Fecha:** 2026-01-29  
**Objetivo:** Verificar que los cambios del módulo de entradas fueron realizados correctamente.

---

## Resumen ejecutivo

| Área              | Estado | Observaciones |
|-------------------|--------|----------------|
| Migraciones SQL   | ✅ OK  | 2 archivos; esquema coherente |
| Seed              | ✅ OK  | event_id en event_days; inventory poblado |
| API GET inventory | ✅ OK  | occupied_pct = sold/nominal_stock; errores en dev |
| API create-preference | ✅ OK | Adaptador a /api/tickets/create-preference |
| Página /entradas  | ✅ OK  | Flujo fecha → entrada → formulario → pago |
| Componentes UI    | ✅ OK  | DateSelector, TicketSelector, CustomerForm |
| Documentación     | ✅ OK  | OPERATIVAR_MODULO_ENTRADAS.md |
| Dependencias previas | ⚠️ Req | events, ticket_types, inventory, orders (módulo MP) |

**Conclusión:** Los cambios del módulo de entradas están implementados de forma correcta. La puesta en marcha depende de: variables de entorno (local/Vercel), aplicación de migraciones y ejecución del seed en el mismo proyecto Supabase que usa el módulo MP.

---

## 1. Migraciones

### 1.1 `supabase/migrations/event_days_daily_inventory.sql`

- **event_days:** `id`, `event_date` (UNIQUE), `name`, `created_at`. Índice en `event_date`. RLS + política `service_role`.
- **daily_inventory:** `event_day_id` → event_days, `ticket_type_id` → ticket_types, `nominal_stock`, `price`, `fomo_threshold`, `overbooking_tolerance`. UNIQUE(event_day_id, ticket_type_id). Índices y RLS correctos.
- **Dependencia:** Asume que `ticket_types` existe (creada por seed o por esquema previo del proyecto).

**Resultado:** ✅ Correcto.

### 1.2 `supabase/migrations/entradas_event_id.sql`

- Añade `event_id UUID REFERENCES public.events(id) ON DELETE SET NULL` a `event_days`.
- Índice `idx_event_days_event_id`.
- **Dependencia:** Asume que la tabla `events` existe (módulo MP).

**Resultado:** ✅ Correcto.

---

## 2. Seed (`supabase/seed.ts`)

- **Orden:** ticket_types → events (get-or-create por fecha) → event_days (con `event_id`) → daily_inventory → inventory.
- **Fechas:** 12 fechas (`EVENT_DATES_2026`) alineadas con `DATE_GRID` del DateSelector (06/02–01/03 2026).
- **event_days:** Upsert por `event_date` con `event_id` del mapa de events; idempotente.
- **inventory:** Upsert por (event_id, ticket_type_id) con `total_capacity = nominal * (1 + overbooking/100)`; 48 filas (12 eventos × 4 tipos).
- **Reglas de negocio:** VIP nominal 20, overbooking 50%; 14 feb precios diferenciados; FOMO pico 90%/85%.

**Resultado:** ✅ Correcto. Ejecución: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed`.

---

## 3. APIs

### 3.1 GET `/api/entradas/inventory?date=YYYY-MM-DD`

- Validación de `date` (regex YYYY-MM-DD); 400 si falta o inválido.
- Consulta `event_days` por `event_date`; 404 si no hay fila; 503 si `event_id` es null.
- Obtiene `daily_inventory` con join a `ticket_types`; `inventory` por `event_id`; cuenta `orders` (pending/paid) por `inventory_id`.
- `occupied_pct = nominal_stock > 0 ? min(100, round((sold/nominal_stock)*100)) : 0`.
- Respuesta: array con `ticket_type_id`, `name`, `price`, `nominal_stock`, `fomo_threshold`, `overbooking_tolerance`, `available_stock`, `total_capacity`, `occupied_pct`.
- En desarrollo, el catch devuelve el mensaje real del error (p. ej. Supabase no configurado).

**Resultado:** ✅ Correcto.

### 3.2 POST `/api/entradas/create-preference`

- Body validado con Zod: `date`, `ticket_type_id` (UUID), `quantity: 1`, `customer.email`.
- Resolución de `event_id` vía `event_days` por `event_date`; 404/503 si no hay evento o event_id.
- Comprueba `inventory` por (event_id, ticket_type_id) y stock (total_capacity - orders pending/paid); 409 si sin stock.
- Idempotency-Key: hash de date + ticket_type_id + email + slot de 1 min.
- Llama por fetch a `NEXT_PUBLIC_BASE_URL/api/tickets/create-preference` con `event_id`, `ticket_type_id`, `quantity: 1`, `payer_email`. No modifica el route original.

**Resultado:** ✅ Correcto.

---

## 4. Frontend

### 4.1 Página `src/app/entradas/page.tsx`

- Estado: `selectedDate`, `cart`, `inventory`, `inventoryLoading`, `inventoryError`, `purchaseLoading`, `purchaseError`, `soldOutDates`.
- Al cambiar `selectedDate` se hace GET `/api/entradas/inventory?date=...` y se resetea `cart`.
- Render: DateSelector → (si hay fecha) carga inventario → TicketSelector → (si hay cart) CustomerForm.
- Al enviar formulario: POST create-preference con date, cart.ticket_type_id, quantity 1, customer.email; redirección a `init_point` si viene en la respuesta.

**Resultado:** ✅ Correcto.

### 4.2 DateSelector

- Grilla de fechas (2026-02-06 … 2026-03-01) igual que seed; tema oscuro; acento verde en seleccionado; soporte soldOutDates.

**Resultado:** ✅ Correcto.

### 4.3 TicketSelector

- Recibe `inventoryData` (tipo EntradasInventoryItem), `onCartChange`, `disabled`. Cantidad máxima 1 por tipo; FOMO cuando `occupied_pct >= fomo_threshold`; +/- y estado agotado.

**Resultado:** ✅ Correcto.

### 4.4 CustomerForm

- Validación Zod (nombre, email, confirmación email, teléfono 9 dígitos, RUT Módulo 11); persistencia en localStorage; usado en /entradas con `onSubmit` que dispara create-preference.

**Resultado:** ✅ Correcto (ya existía; integrado en la página).

---

## 5. Dependencias y requisitos operativos

- **Supabase:** Debe existir el mismo proyecto que usa el módulo MP, con tablas `events`, `ticket_types`, `inventory`, `orders` (y esquema esperado por `/api/tickets/create-preference`). Luego aplicar migraciones de entradas y ejecutar seed.
- **Variables de entorno (local):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; para pago también `NEXT_PUBLIC_BASE_URL`, `MP_ACCESS_TOKEN` (y opcionales MP_WEBHOOK_SECRET, QR_SIGNING_SECRET).
- **Vercel:** Variables ya configuradas; tras deploy, /entradas funcionará si en Supabase están aplicadas migraciones y seed.

---

## 6. Documentación

- **OPERATIVAR_MODULO_ENTRADAS.md:** Pasos para variables, migraciones, seed, pruebas local y Vercel. ✅ Coherente con la implementación.
- **SOLUCION_MODULO_ENTRADAS.md:** Especificación de fases (esquema, APIs, UI). ✅ Implementación alineada.

---

## Checklist de verificación post-despliegue

- [ ] Migraciones aplicadas en Supabase (event_days_daily_inventory.sql, entradas_event_id.sql).
- [ ] Seed ejecutado (`npm run db:seed` con env de Supabase).
- [ ] Local: `.env.local` con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY; `npm run dev` → http://localhost:3000/entradas.
- [ ] Elegir fecha → cargan tipos de entrada y precios (sin error 500).
- [ ] Elegir entrada (+) → rellenar formulario → Continuar → redirección a Mercado Pago (si MP_ACCESS_TOKEN configurado).
- [ ] Vercel: deploy del branch → abrir /entradas en la URL de preview/producción.
