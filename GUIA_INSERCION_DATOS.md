# Guía: Inserción de Datos para Prueba de Mercado Pago

## Arquitectura Modular

✅ **Módulo MP (Venta):**
- Independiente y funcional por sí solo
- No depende de otros módulos
- Si falla, no afecta módulos existentes

✅ **Módulo Gestión de Datos (Futuro):**
- Se conectará con MP pero será independiente
- Fracaso de uno no afecta al otro

---

## Paso 1: Acceder a Supabase

### Opción A: Si ya tienes proyecto Supabase
1. Ir a: https://app.supabase.com
2. Seleccionar tu proyecto
3. Ir a: **SQL Editor** (menú lateral izquierdo)

### Opción B: Si necesitas crear proyecto
1. Ir a: https://app.supabase.com
2. Click en "New Project"
3. Completar formulario:
   - Name: `festival-pucon` (o el que prefieras)
   - Database Password: (guardar en lugar seguro)
   - Region: Elegir más cercana (ej: South America)
4. Esperar ~2 minutos a que se cree
5. Ir a: **SQL Editor**

---

## Paso 2: Verificar/Crear Tablas

### Ejecutar este SQL en SQL Editor:

```sql
-- Verificar si las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('events', 'ticket_types', 'inventory', 'orders');
```

**Si NO aparecen todas las tablas, ejecutar:**

```sql
-- Crear tabla events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    venue TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla ticket_types
CREATE TABLE IF NOT EXISTS public.ticket_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear tabla inventory
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_type_id UUID REFERENCES public.ticket_types(id) ON DELETE CASCADE,
    total_capacity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(event_id, ticket_type_id)
);

-- Crear tabla orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_reference UUID UNIQUE NOT NULL,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
    mp_payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_orders_external_reference ON public.orders(external_reference);
CREATE INDEX IF NOT EXISTS idx_orders_mp_payment_id ON public.orders(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_inventory_id ON public.orders(inventory_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_inventory_event_ticket ON public.inventory(event_id, ticket_type_id);
```

**Click en "Run" (o F5)**

---

## Paso 3: Insertar Datos de Prueba

### ✅ Método Automático (RECOMENDADO - No requiere copiar IDs)

**Este método hace todo automáticamente sin necesidad de copiar IDs manualmente:**

```sql
-- ============================================
-- SCRIPT COMPLETO: Insertar todos los datos
-- NO necesitas copiar IDs, todo es automático
-- ============================================

-- 1. Insertar Evento
INSERT INTO public.events (name, date, venue)
VALUES (
    'Festival Pucón 2026',
    '2026-01-15 18:00:00-03:00',
    'Camping Pucón, Región de La Araucanía'
)
ON CONFLICT DO NOTHING;

-- 2. Insertar Tipos de Tickets
INSERT INTO public.ticket_types (name, price)
VALUES 
    ('General', 10000),
    ('VIP', 25000)
ON CONFLICT DO NOTHING;

-- 3. Insertar Inventario (automático - encuentra los IDs solo)
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
WHERE e.name = 'Festival Pucón 2026'
ON CONFLICT (event_id, ticket_type_id) DO UPDATE
SET total_capacity = EXCLUDED.total_capacity;
```

**✅ Ventajas de este método:**
- No necesitas copiar ningún ID
- Todo se relaciona automáticamente
- Más rápido y menos propenso a errores
- Puedes ejecutarlo múltiples veces sin problemas

**Solo copia todo el bloque SQL de arriba, pégalo en SQL Editor y ejecuta (Run o F5)**

---

### 📝 Método Manual (Alternativo - Solo si prefieres hacerlo paso a paso)

Si prefieres hacerlo manualmente paso a paso (no recomendado, pero posible):

<details>
<summary>Click para ver método manual</summary>

**3.1 Insertar Evento:**
```sql
INSERT INTO public.events (name, date, venue)
VALUES (
    'Festival Pucón 2026',
    '2026-01-15 18:00:00-03:00',
    'Camping Pucón, Región de La Araucanía'
)
RETURNING id, name;
```
*Nota: Verás el ID en el resultado, pero NO necesitas copiarlo si usas el método automático*

**3.2 Insertar Tipos de Tickets:**
```sql
INSERT INTO public.ticket_types (name, price)
VALUES 
    ('General', 10000),
    ('VIP', 25000)
RETURNING id, name, price;
```
*Nota: Verás los IDs en el resultado, pero NO necesitas copiarlos si usas el método automático*

**3.3 Insertar Inventario:**
Si hiciste los pasos manuales, aquí SÍ necesitarías los IDs, pero es más fácil usar el método automático de arriba.

</details>

---

## Paso 4: Verificar Datos Insertados

### Verificar todo junto:

```sql
-- Ver todos los datos relacionados
SELECT 
    e.id as event_id,
    e.name as event_name,
    e.date as event_date,
    e.venue,
    tt.id as ticket_type_id,
    tt.name as ticket_type_name,
    tt.price,
    inv.id as inventory_id,
    inv.total_capacity,
    COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as sold_tickets,
    inv.total_capacity - COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as available_stock
FROM public.events e
JOIN public.inventory inv ON inv.event_id = e.id
JOIN public.ticket_types tt ON tt.id = inv.ticket_type_id
LEFT JOIN public.orders o ON o.inventory_id = inv.id
GROUP BY e.id, e.name, e.date, e.venue, tt.id, tt.name, tt.price, inv.id, inv.total_capacity
ORDER BY e.date, tt.price;
```

**Deberías ver algo como:**
```
event_id | event_name          | ticket_type_name | price  | total_capacity | available_stock
---------|---------------------|------------------|--------|----------------|----------------
abc...   | Festival Pucón 2026| General          | 10000  | 100            | 100
abc...   | Festival Pucón 2026| VIP              | 25000  | 50             | 50
```

---

## Paso 5: Obtener Credenciales de Supabase

### En Supabase Dashboard:

1. Ir a: **Settings** (⚙️) → **API**
2. API**

2. Copiar:
   - **Project URL** → Esta es tu `SUPABASE_URL`
   - **anon public** key → Esta es tu `SUPABASE_ANON_KEY`

**Ejemplo:**
```
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Paso 6: Configurar Variables de Entorno en Vercel

### 6.1 Acceder a Vercel

1. Ir a: https://vercel.com
2. Iniciar sesión (con GitHub si es necesario)
3. Seleccionar proyecto `web_oficial_festival`

### 6.2 Agregar Variables de Entorno

1. Ir a: **Settings** → **Environment Variables**
2. Agregar cada variable:

**Supabase:**
```
Name: SUPABASE_URL
Value: <tu-project-url-de-supabase>
Environment: Production, Preview, Development (marcar todos)
```

```
Name: SUPABASE_ANON_KEY
Value: <tu-anon-key-de-supabase>
Environment: Production, Preview, Development (marcar todos)
```

**Mercado Pago:**
```
Name: MP_ACCESS_TOKEN
Value: <tu-access-token-de-mp>
Environment: Production, Preview, Development (marcar todos)
```

**Resend (Email):**
```
Name: RESEND_API_KEY
Value: <tu-api-key-de-resend>
Environment: Production, Preview, Development (marcar todos)
```

**URL Base (para preview):**
```
Name: NEXT_PUBLIC_BASE_URL
Value: https://www.festivalpucon.cl
Environment: Production

Name: NEXT_PUBLIC_BASE_URL
Value: https://feature-mercado-pago-payment-xxx.vercel.app
Environment: Preview
```

3. Click en **Save** para cada variable

---

## Paso 7: Obtener Access Token de Mercado Pago

### Si ya tienes credenciales:
1. Ir a: https://www.mercadopago.cl/developers/panel
2. Seleccionar tu aplicación
3. Ir a: **Credenciales**
4. Copiar **Access Token** (Test o Production según necesites)

### Si necesitas crear aplicación:
1. Ir a: https://www.mercadopago.cl/developers/panel
2. Click en "Crear aplicación"
3. Completar formulario
4. Copiar **Access Token de Test** (recomendado para primera prueba)

---

## Paso 8: Verificar que Todo Funciona

### 8.1 Verificar Endpoint de Tipos

Una vez deployado en Vercel, probar:

```bash
curl https://<tu-preview-url>/api/tickets/types
```

**Debería retornar:**
```json
{
  "ticket_types": [
    {"id": "...", "name": "General", "price": 10000},
    {"id": "...", "name": "VIP", "price": 25000}
  ],
  "events": [
    {"id": "...", "name": "Festival Pucón 2026", "date": "...", "venue": "..."}
  ],
  "inventory": [
    {"id": "...", "event_id": "...", "ticket_type_id": "...", "total_capacity": 100, "available_stock": 100}
  ]
}
```

---

## Checklist Final

Antes de probar el flujo completo:

- [ ] Tablas creadas en Supabase
- [ ] Evento insertado
- [ ] Tipos de tickets insertados
- [ ] Inventario configurado
- [ ] Credenciales de Supabase obtenidas
- [ ] Variables de entorno configuradas en Vercel
- [ ] Access Token de MP obtenido
- [ ] Branch `feature/mercado-pago-payment` pusheado a GitHub
- [ ] Preview URL de Vercel disponible
- [ ] Endpoint `/api/tickets/types` retorna datos correctos

---

## Siguiente Paso: Primera Prueba

Una vez completado este checklist, seguir con:
- `PLAN_PRUEBAS_MP.md` → Sección "Flujo de Prueba Completo"

---

## Troubleshooting

### Error: "No se encontró el tipo de ticket para este evento"
**Solución:** Verificar que el `inventory` tiene registros con el `event_id` y `ticket_type_id` correctos

### Error: "Supabase no está configurado"
**Solución:** Verificar variables de entorno en Vercel, especialmente que estén marcadas para "Preview"

### Endpoint retorna vacío
**Solución:** Verificar que los datos estén insertados correctamente con el SQL de verificación
