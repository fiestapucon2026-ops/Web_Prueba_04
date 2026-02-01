# Análisis crítico: solución sugerida para /entradas (100% operativa)

**Objetivo:** Dejar la solución de PASO 1 (TicketSelector) + PASO 2 (página /entradas) + PASO 3 (prueba) operativa sin ejecutar código, identificando gaps de esquema, API y flujo de pago.

---

## 1. Resumen ejecutivo

La solución propuesta tiene **varios huecos estructurales** que impiden que funcione tal cual:

1. **Dos modelos de datos no conectados:** el flujo de pago actual usa `events` + `inventory` + `orders`; el seed y la UI nueva usan `event_days` + `daily_inventory`. No hay tabla ni API que una “fecha + tipo” con `event_id` / `inventory_id` ni que calcule “vendido” por día.
2. **FOMO y stock disponible:** para “% ocupado” y “últimos tickets” se necesita un “vendido” por (fecha, tipo). Eso hoy solo existe vía `orders.inventory_id` → `inventory`. Sin `inventory` por fecha, no hay forma de calcular disponible ni FOMO desde `daily_inventory` solo.
3. **Pago:** `create-preference` (módulo cerrado) espera `event_id`, `ticket_type_id`, `quantity` (máx. 1), `payer_email`. La propuesta habla de `{ date, tickets: [{id, qty}], customer }`. No existe mapeo fecha → `event_id` ni soporte a múltiples ítems/cantidades sin tocar el módulo cerrado.
4. **API para TicketSelector:** no existe un endpoint que, dado una fecha, devuelva ítems de `daily_inventory` con precio, FOMO, stock nominal, tolerancia de overbooking y **stock disponible**. Ese “disponible” requiere órdenes asociadas a esa fecha/tipo, es decir, de nuevo el modelo `inventory` + `orders`.

Para que la solución quede **100% operativa** hay que cerrar estos puntos de forma explícita (esquema, seed, API, y/o adaptador de pago).

---

## 2. PASO 1: TicketSelector — análisis

### 2.1 Lo que pide la tarea

- **Input:** `selectedDate`, `inventoryData` (array por día desde `daily_inventory`), `onCartChange`.
- **UI:** lista vertical, cards oscuras, precio dinámico, FOMO (“% ocupado” vs `fomo_threshold`, badge “¡ÚLTIMOS TICKETS!”), controles +/- con tope por stock disponible (respetando overbooking).

### 2.2 Gaps críticos

**A) Origen de `inventoryData`**

- `daily_inventory` tiene: `event_day_id`, `ticket_type_id`, `nominal_stock`, `price`, `fomo_threshold`, `overbooking_tolerance`.
- **No tiene** `current_stock` ni “vendido”. La tarea pide:
  - `% Occupied = (nominal_stock - current_stock) / nominal_stock`
  - Comparar con `fomo_threshold` para mostrar “¡ÚLTIMOS TICKETS!”.
- “Vendido” hoy solo existe en `orders` → `inventory_id` → tabla `inventory`. Es decir, por `(event_id, ticket_type_id)` del modelo viejo, no por `(event_day_id, ticket_type_id)`.
- **Conclusión:** sin un origen para “vendido por (fecha, tipo)” no se puede calcular ni `current_stock` ni % ocupado ni FOMO. Eso exige o bien usar el modelo `events`/`inventory`/`orders` por fecha, o bien introducir algo equivalente (p. ej. `event_days.event_id` + inventario por fecha y conteo de órdenes).

**B) Stock disponible y overbooking**

- Límite de venta = `nominal_stock * (1 + overbooking_tolerance/100)` (ej. VIP 20 + 50% = 30).
- “Disponible” = ese límite menos “vendido”. De nuevo, “vendido” para ese día/tipo no existe si solo se usa `daily_inventory`.
- **Conclusión:** el mismo requisito que en (A): hay que definir cómo se cuenta “vendido” por (fecha, tipo) y exponerlo en la API que alimenta a TicketSelector.

**C) API necesaria**

- Hace falta un endpoint, por ejemplo `GET /api/entradas/inventory?date=YYYY-MM-DD`, que devuelva por cada tipo de ticket de ese día:
  - nombre, precio, `nominal_stock`, `fomo_threshold`, `overbooking_tolerance`
  - **available_stock** (o `current_stock`) y/o **max_sellable** (respetando overbooking)
- Ese endpoint no puede implementarse solo leyendo `daily_inventory`: debe combinar con la lógica de “vendido” (y por tanto con `inventory` + `orders` o con un esquema equivalente).

### 2.3 Qué hay que definir para PASO 1

1. **Modelo de “vendido” por fecha y tipo:**  
   Opciones coherentes:  
   - (1) Añadir `event_days.event_id` (FK a `events`) y que el seed cree también `events` + filas en `inventory` (una por evento/fecha y tipo, con `total_capacity` = techo con overbooking). Así `orders.inventory_id` sigue siendo la fuente de “vendido” y se puede mapear (fecha, tipo) → `inventory_id` → contar órdenes.  
   - (2) Nueva tabla tipo `daily_orders` que referencie `daily_inventory` y acumule ventas por día/tipo (y adaptar flujo de pago para escribir ahí). Más trabajo y duplicación de lógica respecto al módulo cerrado.

2. **Endpoint:**  
   - Implementar `GET /api/entradas/inventory?date=...` que:  
     - Resuelva la fecha a `event_day_id` (y si aplica, `event_id`).  
     - Para ese día, devuelva filas con datos de `daily_inventory` + nombre de tipo + **available_stock** / **max_sellable** calculados con “vendido” (vía `inventory`+`orders` o vía `daily_orders`).

3. **TicketSelector:**  
   - Recibir `inventoryData` con al menos: `ticket_type_id`, nombre, precio, `nominal_stock`, `fomo_threshold`, `overbooking_tolerance`, `available_stock` (o `max_sellable`).  
   - Calcular % ocupado y mostrar “¡ÚLTIMOS TICKETS!” cuando corresponda.  
   - Limitar cantidad máxima al disponible (respetando overbooking) usando el valor que venga del backend.

---

## 3. PASO 2: Página /entradas (orquestador) — análisis

### 3.1 Flujo propuesto

1. DateSelector → elegir fecha.  
2. Según fecha → cargar inventario del día → TicketSelector.  
3. Si hay ítems en carrito → CustomerForm + resumen total.  
4. Submit → llamar “API existente” con `{ date, tickets: [{id, qty}], customer }`.

### 3.2 Gaps críticos

**A) Contrato de la API de pago (módulo cerrado)**

- **create-preference** (y schemas) esperan:
  - `event_id` (UUID)
  - `ticket_type_id` (UUID)
  - `quantity` (número, máx. 1)
  - `payer_email`
- No acepta `date` ni `tickets[]` ni `customer` completo.
- Además, crea **una** orden por llamada (un `inventory_id`), y el webhook actual asume una orden por pago.
- **Conclusión:** no se puede “llamar al API existente” con el payload sugerido sin un adaptador que traduzca (fecha + tipo + cantidad + email) a una o varias llamadas a create-preference, y sin decidir cómo se manejan múltiples ítems o cantidades > 1 (varias órdenes, un solo pago MP, etc.).

**B) Mapeo fecha → event_id / inventory_id**

- create-preference necesita `event_id` y luego obtiene `inventory` por `(event_id, ticket_type_id)`.
- Hoy no hay en BD ni en API ningún `event_id` por “fecha” (event_days). El seed no crea `events` ni `inventory`.
- **Conclusión:** para que /entradas pueda pagar sin tocar create-preference, hace falta:
  - Que exista un `event_id` por fecha (p. ej. 12 `events`, uno por fecha del grid), y
  - Que exista `inventory` por (event_id, ticket_type_id) con `total_capacity` = techo con overbooking,
  - Y un endpoint o lógica que, dado `date`, devuelva `event_id` (y opcionalmente los `inventory_id` por tipo) para construir el body de create-preference.

**C) Cantidad y múltiples ítems**

- create-preference hoy: `quantity` máx. 1; una orden por preferencia.
- La propuesta: `tickets: [{id, qty}]` (varios tipos y/o cantidades).
- Opciones sin tocar el módulo cerrado:
  - Restringir a **1 ticket por transacción** (un tipo, qty 1) y que el adaptador envíe `event_id`, `ticket_type_id`, `quantity: 1`, `payer_email`; o
  - Implementar un “orquestador” que por cada ítem llame create-preference (varias órdenes, varios redirects o varios pagos) y definir UX y flujo (complejidad alta).
- **Conclusión:** para una primera versión operativa, hay que fijar regla: por ejemplo “una transacción = un tipo de ticket, cantidad 1” y que el payload de /entradas se traduzca a exactamente una llamada a create-preference con ese contrato.

**D) Dónde se hace la traducción**

- Lo más limpio: **nuevo endpoint** (p. ej. `POST /api/entradas/create-preference`) que:
  - Reciba: `date`, `ticket_type_id`, `quantity` (1), `customer: { email, ... }`.
  - Resuelva `date` → `event_id` (y valide que exista inventario para ese evento + tipo).
  - Llame internamente a la misma lógica que usa create-preference (o al propio create-preference con `event_id`, `ticket_type_id`, `quantity`, `payer_email`) **sin cambiar** el código del módulo cerrado.
- Así /entradas no conoce `event_id`; solo envía fecha + tipo + email (y datos de cliente si se usan en otro módulo).

### 3.3 Qué hay que definir para PASO 2

1. **Seed ampliado:**  
   - Crear 12 `events` (uno por fecha del grid, mismo venue/nombre).  
   - Añadir `event_days.event_id` (FK a `events`) y rellenarlo en el seed.  
   - Crear filas en `inventory`: una por (event_id, ticket_type_id), con `total_capacity` = `nominal_stock * (1 + overbooking_tolerance/100)` (tomando nominal y overbooking de `daily_inventory`).  
   - Mantener creación de `event_days` y `daily_inventory` como hoy (precios, FOMO, etc.).

2. **API de inventario por fecha:**  
   - `GET /api/entradas/inventory?date=YYYY-MM-DD` como en la sección 2.

3. **API de pago adaptada:**  
   - `POST /api/entradas/create-preference` (o nombre equivalente) con body por ejemplo:  
     `{ date, ticket_type_id, quantity: 1, customer: { email } }`  
   - Internamente: date → event_id; validar stock (usando `inventory` + órdenes); llamar a create-preference con `event_id`, `ticket_type_id`, `quantity`, `payer_email`.  
   - Idempotency-Key y manejo de errores igual que el actual (sin tocar el route de create-preference).

4. **Estado y flujo en /entradas:**  
   - `selectedDate` → fetch a `/api/entradas/inventory?date=...` → pasar datos a TicketSelector.  
   - Carrito: por ahora puede ser “un solo tipo, cantidad 1” para alinear con create-preference.  
   - Al enviar el formulario: validar CustomerForm, luego `POST /api/entradas/create-preference` con fecha, tipo elegido, 1, email; recibir `init_point` y redirigir a MP.  
   - Tras pago, MP redirige a `/success` (o, si se quiere, a `/checkout/success/[order_id]` pasando order_id por query/estado; eso puede requerir cambios en back_urls o en la página de success, que está en módulo cerrado — mejor no asumir cambios ahí sin definirlo).

5. **Visuales y transiciones:**  
   - Mantener bg-black y pasos (fecha → tickets → formulario) con transiciones es independiente de lo anterior; se puede implementar una vez cerrado el flujo de datos y pago.

---

## 4. PASO 3: Checklist de ejecución de prueba

### 4.1 Lo que está bien

- Crear `QR_SIGNING_SECRET` (ej. `openssl rand -hex 32`) en `.env.local`.  
- Usar `MP_ACCESS_TOKEN` de test (TEST-…).  
- Ejecutar `npm run db:seed` (tras haber extendido el seed como arriba).  
- Verificar en Supabase que `daily_inventory` tenga precios distintos el 14 Feb.  
- Entrar a `http://localhost:3000/entradas`, elegir 14 Feb vs 06 Feb y comprobar precios.

### 4.2 Lo que falta para que la prueba sea end-to-end

1. **Seed que también cree `events` e `inventory`:**  
   - Sin esto, no hay `event_id` por fecha ni stock “vendido” por (fecha, tipo), y create-preference no puede usarse desde /entradas.

2. **`GET /api/entradas/inventory?date=...`:**  
   - Sin esto, TicketSelector no tiene datos con precio, FOMO y disponible.

3. **`POST /api/entradas/create-preference` (adaptador):**  
   - Sin esto, el submit del formulario no puede llamar al flujo MP con solo fecha + tipo + email.

4. **Decisión de “una orden = un ticket”:**  
   - Documentar que, en esta versión, “Pagar” = 1 tipo, cantidad 1, y que el carrito/UI debe reflejarlo (o deshabilitar múltiples ítems/cantidades hasta que se diseñe un flujo multi-orden).

5. **Redirección post-pago:**  
   - Hoy MP devuelve a `/success`. Si se quiere que el usuario termine en `/checkout/success/[order_id]`, hay que definir cómo se obtiene ese `order_id` (p. ej. en back_urls con query) y si se puede hacer sin tocar el módulo cerrado (solo config) o no.

---

## 5. Esquema mínimo para que la solución sea operativa

Resumen de cambios necesarios:

| Área | Cambio |
|------|--------|
| **BD** | Añadir `event_days.event_id` (FK a `events`). Opcional: migración que cree la columna. |
| **Seed** | 1) Crear 12 `events` (uno por fecha). 2) Al crear `event_days`, asignar `event_id`. 3) Crear 48 filas en `inventory` (event_id, ticket_type_id, total_capacity con overbooking). |
| **API** | `GET /api/entradas/inventory?date=...`: devuelve por cada tipo del día: nombre, precio, fomo_threshold, nominal_stock, overbooking_tolerance, available_stock (vía inventory + count(orders)). |
| **API** | `POST /api/entradas/create-preference`: body `{ date, ticket_type_id, quantity: 1, customer: { email } }`; resuelve date → event_id; llama lógica create-preference (o el mismo route) con event_id, ticket_type_id, quantity, payer_email. |
| **UI** | TicketSelector: consumir `inventoryData` del nuevo GET; calcular % ocupado y “ÚLTIMOS TICKETS”; límite por available_stock. |
| **UI** | /entradas: flujo en 3 pasos; al submit, llamar al nuevo POST con fecha + un solo tipo (qty 1) + email; redirigir a init_point. |
| **Módulo cerrado** | No modificar create-preference ni webhook; el adaptador solo traduce (date, tipo, email) → (event_id, ticket_type_id, payer_email) y delega. |

Con esto, la solución sugerida (PASO 1 + 2 + 3) queda definida de forma que se pueda implementar y dejar **100% operativa** para una prueba de “elegir fecha → ver precios y FOMO → elegir 1 ticket → datos cliente → pagar → volver de MP”.

---

## 6. Riesgos y consideraciones

- **Idempotencia:** el adaptador debe generar Idempotency-Key estable (por ejemplo por usuario/fecha/tipo/slot de tiempo) y pasarlo a create-preference para no duplicar órdenes en doble clic.  
- **Concurrencia:** el “available_stock” se calcula en el GET; entre el GET y el POST otro usuario puede comprar. create-preference ya valida stock al crear la preferencia; si se agotó, devolverá error y la UI puede refrescar inventario.  
- **Nombres de tipos:** el seed usa “Todo el Día”, “Estac. VIP”, etc. El resto del sistema (create-preference, /tickets) puede usar otros nombres en `ticket_types`; asegurar que los IDs de tipo sean los mismos (seed por nombre) o que el mapeo sea explícito.
