# Verificación de Datos - Checklist Completo

## Método 1: Verificación en Supabase (SQL)

### Script de Verificación Completo

Ejecuta este SQL en **Supabase SQL Editor**:

```sql
-- ============================================
-- VERIFICACIÓN COMPLETA DE DATOS
-- ============================================

-- 1. Verificar que existen las tablas
SELECT 
    'Tablas creadas' as verificacion,
    COUNT(*) as cantidad
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('events', 'ticket_types', 'inventory', 'orders');

-- 2. Verificar eventos
SELECT 
    'Eventos' as verificacion,
    COUNT(*) as cantidad,
    STRING_AGG(name, ', ') as nombres
FROM public.events;

-- 3. Verificar tipos de tickets
SELECT 
    'Tipos de Tickets' as verificacion,
    COUNT(*) as cantidad,
    STRING_AGG(name || ' ($' || price || ')', ', ') as tipos
FROM public.ticket_types;

-- 4. Verificar inventario
SELECT 
    'Inventario' as verificacion,
    COUNT(*) as cantidad,
    SUM(total_capacity) as capacidad_total
FROM public.inventory;

-- 5. Verificación completa con relaciones
SELECT 
    e.id as event_id,
    e.name as evento,
    e.date as fecha_evento,
    e.venue as lugar,
    tt.id as ticket_type_id,
    tt.name as tipo_ticket,
    tt.price as precio,
    inv.id as inventory_id,
    inv.total_capacity as capacidad_total,
    COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as tickets_vendidos,
    inv.total_capacity - COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as stock_disponible
FROM public.events e
JOIN public.inventory inv ON inv.event_id = e.id
JOIN public.ticket_types tt ON tt.id = inv.ticket_type_id
LEFT JOIN public.orders o ON o.inventory_id = inv.id
GROUP BY e.id, e.name, e.date, e.venue, tt.id, tt.name, tt.price, inv.id, inv.total_capacity
ORDER BY e.date, tt.price;
```

### ✅ Resultado Esperado

Deberías ver algo como esto:

```
event_id | evento              | tipo_ticket | precio | capacidad_total | stock_disponible
---------|---------------------|-------------|--------|-----------------|-----------------
abc...   | Festival Pucón 2026| General     | 10000  | 100             | 100
abc...   | Festival Pucón 2026| VIP         | 25000  | 50              | 50
```

**Si ves esto → ✅ Datos correctos**

---

## Método 2: Verificación desde la API

### Paso 1: Verificar que el endpoint funciona

Si ya tienes el proyecto deployado en Vercel o corriendo localmente:

```bash
# Reemplazar <URL> con tu URL de Vercel preview o localhost:3000
curl https://<URL>/api/tickets/types
```

**O desde el navegador:**
```
https://<tu-url>/api/tickets/types
```

### ✅ Respuesta Esperada

```json
{
  "ticket_types": [
    {
      "id": "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "General",
      "price": 10000
    },
    {
      "id": "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "VIP",
      "price": 25000
    }
  ],
  "events": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Festival Pucón 2026",
      "date": "2026-01-15T21:00:00.000Z",
      "venue": "Camping Pucón, Región de La Araucanía"
    }
  ],
  "inventory": [
    {
      "id": "d1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "ticket_type_id": "b1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "total_capacity": 100,
      "available_stock": 100
    },
    {
      "id": "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "ticket_type_id": "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "total_capacity": 50,
      "available_stock": 50
    }
  ]
}
```

**Si ves esto → ✅ API funciona correctamente**

---

## Método 3: Verificación Visual (Frontend)

### Si tienes el proyecto corriendo:

1. Ir a: `http://localhost:3000/tickets` (local) o `<tu-preview-url>/tickets`
2. Deberías ver:
   - ✅ Dropdown con "Festival Pucón 2026" como opción
   - ✅ Al seleccionar evento, aparecen 2 tipos de tickets (General y VIP)
   - ✅ Precios correctos ($10.000 y $25.000)
   - ✅ Stock disponible mostrado

**Si ves esto → ✅ Frontend conectado correctamente**

---

## Checklist de Verificación Rápida

### En Supabase:

- [ ] Tabla `events` tiene al menos 1 registro
- [ ] Tabla `ticket_types` tiene 2 registros (General y VIP)
- [ ] Tabla `inventory` tiene 2 registros (uno por cada tipo de ticket)
- [ ] Los precios son correctos (10000 y 25000)
- [ ] Las capacidades son correctas (100 y 50)

### Desde la API:

- [ ] Endpoint `/api/tickets/types` retorna datos
- [ ] `ticket_types` array tiene 2 elementos
- [ ] `events` array tiene al menos 1 elemento
- [ ] `inventory` array tiene 2 elementos
- [ ] `available_stock` es igual a `total_capacity` (sin ventas aún)

### Verificación de Relaciones:

- [ ] Cada `inventory` tiene un `event_id` válido
- [ ] Cada `inventory` tiene un `ticket_type_id` válido
- [ ] No hay `inventory` huérfano (sin evento o tipo de ticket)

---

## Problemas Comunes y Soluciones

### ❌ Error: "No se encontró el tipo de ticket para este evento"

**Causa:** El `inventory` no tiene registros que relacionen evento con tipo de ticket.

**Solución:**
```sql
-- Verificar que existe la relación
SELECT 
    e.name as evento,
    tt.name as tipo_ticket,
    inv.id as inventory_id
FROM public.events e
CROSS JOIN public.ticket_types tt
LEFT JOIN public.inventory inv ON inv.event_id = e.id AND inv.ticket_type_id = tt.id
WHERE inv.id IS NULL;

-- Si hay filas sin inventory_id, crear el inventario:
INSERT INTO public.inventory (event_id, ticket_type_id, total_capacity)
SELECT 
    e.id,
    tt.id,
    CASE 
        WHEN tt.name = 'General' THEN 100
        WHEN tt.name = 'VIP' THEN 50
    END
FROM public.events e
CROSS JOIN public.ticket_types tt
WHERE NOT EXISTS (
    SELECT 1 FROM public.inventory inv 
    WHERE inv.event_id = e.id AND inv.ticket_type_id = tt.id
);
```

### ❌ Error: "Supabase no está configurado"

**Causa:** Variables de entorno no configuradas en Vercel.

**Solución:**
1. Ir a Vercel → Settings → Environment Variables
2. Verificar que existen:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Verificar que están marcadas para "Preview"

### ❌ API retorna array vacío

**Causa:** Datos no insertados o variables de entorno incorrectas.

**Solución:**
1. Verificar datos en Supabase con el SQL de verificación
2. Verificar variables de entorno en Vercel
3. Verificar que el proyecto está deployado con las variables correctas

---

## Script de Verificación Rápida (Todo en Uno)

Ejecuta este SQL para ver todo de una vez:

```sql
-- Verificación completa en una sola query
WITH datos_completos AS (
    SELECT 
        e.id as event_id,
        e.name as evento,
        e.date as fecha,
        e.venue as lugar,
        tt.id as ticket_type_id,
        tt.name as tipo_ticket,
        tt.price as precio,
        inv.id as inventory_id,
        inv.total_capacity as capacidad,
        COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as vendidos,
        inv.total_capacity - COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as disponibles
    FROM public.events e
    JOIN public.inventory inv ON inv.event_id = e.id
    JOIN public.ticket_types tt ON tt.id = inv.ticket_type_id
    LEFT JOIN public.orders o ON o.inventory_id = inv.id
    GROUP BY e.id, e.name, e.date, e.venue, tt.id, tt.name, tt.price, inv.id, inv.total_capacity
)
SELECT 
    '✅ VERIFICACIÓN COMPLETA' as estado,
    COUNT(DISTINCT event_id) as eventos,
    COUNT(DISTINCT ticket_type_id) as tipos_tickets,
    COUNT(*) as combinaciones_inventario,
    SUM(capacidad) as capacidad_total,
    SUM(disponibles) as stock_disponible
FROM datos_completos

UNION ALL

SELECT 
    '📊 DETALLE' as estado,
    NULL as eventos,
    NULL as tipos_tickets,
    NULL as combinaciones_inventario,
    NULL as capacidad_total,
    NULL as stock_disponible

UNION ALL

SELECT 
    evento || ' - ' || tipo_ticket as estado,
    NULL,
    NULL,
    NULL,
    capacidad,
    disponibles
FROM datos_completos
ORDER BY estado;
```

---

## Próximo Paso

Una vez verificado que todo está correcto:

✅ **Siguiente:** Seguir con `PLAN_PRUEBAS_MP.md` → "Flujo de Prueba Completo"
