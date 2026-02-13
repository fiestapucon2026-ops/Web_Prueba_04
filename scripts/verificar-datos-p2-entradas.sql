-- ============================================
-- VERIFICACIÓN P2: flujo /entradas (precio por fecha)
-- Ejecutar en Supabase → SQL Editor
-- Requiere: event_days.event_id, daily_inventory( event_day_id, ticket_type_id, price ), inventory, ticket_types, events
-- ============================================

-- 1. Columnas existentes por tabla
SELECT '1. ESTRUCTURA' AS seccion, table_name AS tabla, column_name AS columna, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('event_days', 'daily_inventory', 'ticket_types', 'inventory', 'events')
ORDER BY table_name, ordinal_position;

-- 2. event_days: debe tener event_date y event_id (event_id NOT NULL para que la API no devuelva 503)
SELECT '2. EVENT_DAYS' AS seccion, COUNT(*) AS total,
       COUNT(event_id) AS con_event_id,
       COUNT(*) - COUNT(event_id) AS sin_event_id
FROM public.event_days;

SELECT id, event_date, event_id FROM public.event_days ORDER BY event_date;

-- 3. daily_inventory: debe tener event_day_id, ticket_type_id, price (price NOT NULL y >= 0 para no "Precio no configurado")
SELECT '3. DAILY_INVENTORY' AS seccion, COUNT(*) AS total,
       COUNT(price) AS con_price,
       COUNT(*) FILTER (WHERE price IS NULL OR price < 0) AS invalidos_price
FROM public.daily_inventory;

SELECT ed.event_date, tt.name AS tipo, di.price, di.nominal_stock
FROM public.daily_inventory di
JOIN public.event_days ed ON ed.id = di.event_day_id
JOIN public.ticket_types tt ON tt.id = di.ticket_type_id
ORDER BY ed.event_date, tt.name;

-- 4. Combinaciones esperadas: 12 fechas × 5 tipos = 60 filas en daily_inventory (si aplica tu config)
WITH fechas_esperadas AS (
  SELECT unnest(ARRAY['2026-02-06','2026-02-07','2026-02-08','2026-02-13','2026-02-14','2026-02-15',
                      '2026-02-20','2026-02-21','2026-02-22','2026-02-27','2026-02-28','2026-03-01']) AS event_date
),
tipos_esperados AS (
  SELECT name FROM public.ticket_types
  WHERE name IN (
    'Familiar', 'Todo el día', 'Estacionamiento Familiar', 'Estacionamiento Todo el día',
    'Promo 2x1 Cerveza Artesanal (2 x 500 cc)'
  )
)
SELECT '4. FALTANTES' AS seccion, ed.event_date, tt.name AS tipo
FROM fechas_esperadas ed
CROSS JOIN tipos_esperados tt
WHERE NOT EXISTS (
  SELECT 1 FROM public.daily_inventory di
  JOIN public.event_days e ON e.id = di.event_day_id AND e.event_date = ed.event_date
  JOIN public.ticket_types t ON t.id = di.ticket_type_id AND t.name = tt.name
)
ORDER BY ed.event_date, tt.name;

-- 5. ticket_types: nombres que usa /entradas
SELECT '5. TICKET_TYPES' AS seccion, id, name, price FROM public.ticket_types ORDER BY name;

-- 6. inventory: debe existir por event_id y ticket_type_id (para cada evento y tipo)
SELECT '6. INVENTORY' AS seccion, COUNT(*) AS filas, COUNT(DISTINCT event_id) AS eventos, COUNT(DISTINCT ticket_type_id) AS tipos
FROM public.inventory;
