-- ============================================
-- SCRIPT DE VERIFICACIÓN DE DATOS
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Verificar estructura de tablas
SELECT 
    '📋 ESTRUCTURA' as seccion,
    table_name as tabla,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = t.table_name) as columnas
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('events', 'ticket_types', 'inventory', 'orders')
ORDER BY table_name;

-- 2. Verificar datos insertados
SELECT 
    '📊 DATOS' as seccion,
    'events' as tabla,
    COUNT(*) as registros,
    STRING_AGG(name, ', ') as contenido
FROM public.events

UNION ALL

SELECT 
    '📊 DATOS' as seccion,
    'ticket_types' as tabla,
    COUNT(*) as registros,
    STRING_AGG(name || ' ($' || price::text || ')', ', ') as contenido
FROM public.ticket_types

UNION ALL

SELECT 
    '📊 DATOS' as seccion,
    'inventory' as tabla,
    COUNT(*) as registros,
    'Capacidad total: ' || SUM(total_capacity)::text as contenido
FROM public.inventory

UNION ALL

SELECT 
    '📊 DATOS' as seccion,
    'orders' as tabla,
    COUNT(*) as registros,
    STRING_AGG(status, ', ') as contenido
FROM public.orders;

-- 3. Verificación completa con relaciones
SELECT 
    '✅ VERIFICACIÓN COMPLETA' as tipo,
    e.name as evento,
    e.date::date as fecha,
    tt.name as tipo_ticket,
    tt.price as precio,
    inv.total_capacity as capacidad,
    COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as vendidos,
    inv.total_capacity - COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as disponibles,
    CASE 
        WHEN inv.total_capacity - COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) > 0 
        THEN '✅ Disponible'
        ELSE '❌ Agotado'
    END as estado
FROM public.events e
JOIN public.inventory inv ON inv.event_id = e.id
JOIN public.ticket_types tt ON tt.id = inv.ticket_type_id
LEFT JOIN public.orders o ON o.inventory_id = inv.id
GROUP BY e.id, e.name, e.date, tt.id, tt.name, tt.price, inv.id, inv.total_capacity
ORDER BY e.date, tt.price;

-- 4. Verificar integridad referencial
SELECT 
    '🔗 INTEGRIDAD' as tipo,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Todas las relaciones son válidas'
        ELSE '❌ Hay ' || COUNT(*)::text || ' relaciones inválidas'
    END as estado
FROM public.inventory inv
LEFT JOIN public.events e ON e.id = inv.event_id
LEFT JOIN public.ticket_types tt ON tt.id = inv.ticket_type_id
WHERE e.id IS NULL OR tt.id IS NULL;
