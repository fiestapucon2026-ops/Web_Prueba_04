# Análisis: discrepancia total UI ($4.000) vs Mercado Pago (sin cambiar código)

## Síntoma

- **Día con ticket a $4.000:** La ventana de tickets muestra el total correcto (ej. 8 × $4.000 = $32.000), pero en Mercado Pago el total mostrado es distinto (ej. $40.000).
- **Día con ticket a $5.000:** El total en la ventana de tickets y el total en MP coinciden (ej. $98.000).

## Origen de los precios en el código

### 1. Ventana de tickets (lo que ve el usuario)

- **Fuente:** `GET /api/entradas/inventory?date=YYYY-MM-DD`
- **Archivo:** `src/app/api/entradas/inventory/route.ts`
- **Datos:** Lee **`daily_inventory`** para el `event_day_id` correspondiente a esa fecha:
  - `daily_inventory` tiene una fila por (event_day_id, ticket_type_id) con **`price`** (precio del día), nominal_stock, etc.
  - La respuesta incluye `price: Number(row.price) || 0` → **precio por día**.

Por tanto, el total que se muestra en la UI (Familiar, Todo el Día, estacionamiento, promo) se calcula con **precios de `daily_inventory`** para la fecha elegida (ej. Viernes 6 → $4.000, Sábado 28 → $5.000).

### 2. Creación de la preferencia de Mercado Pago (lo que paga el usuario)

- **Fuente:** `POST /api/entradas/create-preference` (multi-ítem) o, con un solo ítem, delegado a `POST /api/tickets/create-preference`.
- **Archivos:**  
  - `src/app/api/entradas/create-preference/route.ts`  
  - `src/app/api/tickets/create-preference/route.ts`

En ambos casos el precio que se envía a MP se obtiene así:

- Se consulta la tabla **`inventory`** con:
  - `event_id` (y opcionalmente `ticket_type_id`),
  - y un join a **`ticket_types`** para nombre y **precio**.
- El precio usado es **`ticket_types.price`**, no `daily_inventory.price`.

Código relevante:

- **entradas/create-preference** (multi-ítem), aprox. líneas 114–137:
  - `from('inventory').select('id, total_capacity, ticket_types!inner(id, name, price), ...')`
  - `unitPrice = Math.round(Number(ticketType?.price ?? 0))`
- **tickets/create-preference**, aprox. líneas 78–105:
  - Misma idea: `from('inventory').select(..., ticket_types!inner(id, name, price), ...)`
  - `unitPrice = Math.round(Number(ticketType.price))`

Es decir, **MP siempre recibe el precio de `ticket_types`**, que es una tabla maestra (un precio por tipo de ticket), no por día.

## Conclusión (causa raíz)

| Dónde se muestra | Tabla de la que sale el precio |
|------------------|---------------------------------|
| Ventana de tickets (total en UI) | **daily_inventory** (precio por fecha/día) |
| Mercado Pago (total a pagar)     | **ticket_types** (precio fijo del tipo)     |

- Cuando el **precio del día** en `daily_inventory` es **distinto** al de `ticket_types` (ej. día a $4.000 vs tipo a $5.000), el total de la UI y el de MP no coinciden.
- Cuando el día tiene el **mismo** precio que `ticket_types` (ej. ambos $5.000), los totales coinciden.

Por eso:
- Con ticket a **$4.000** el día: UI bien, MP mal (usa el precio de `ticket_types`).
- Con ticket a **$5.000** el día: UI y MP cuadran.

## Resumen técnico

- **UI:** Precio por día → **daily_inventory.price** (por event_day + ticket_type).
- **MP:** Precio por tipo → **ticket_types.price** (sin considerar la fecha).
- La corrección consistiría en que, al crear la preferencia (entradas y/o tickets), el **precio enviado a MP** se tome de **daily_inventory** para la **fecha seleccionada** (y mismo event_day/ticket_type), no de `ticket_types`.

---

## Corrección aplicada (2026-02-03)

- **entradas/create-preference (multi-ítem):** El precio se obtiene de `daily_inventory` para la fecha (`event_day_id` + `ticket_type_id`). Validación: `dailyPrice > 0` en servidor; rechazo 400 si no hay precio para esa fecha.
- **entradas/create-preference (un ítem):** Se delega a `tickets/create-preference` pasando `event_date: date` en el payload.
- **tickets/create-preference:** Si llega `event_date`, el precio se toma de `daily_inventory` (event_day + ticket_type); si no, de `ticket_types` (flujo /tickets). En ambos casos el precio se valida en servidor (> 0).
- **Seguridad:** El cliente nunca envía el precio; solo `date`, `ticket_type_id`, `quantity`. El monto a cobrar se calcula siempre en backend desde BD.
