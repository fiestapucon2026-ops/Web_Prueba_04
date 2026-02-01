# Pasos en Supabase para que /entradas muestre eventos

El mensaje **"No hay evento para esa fecha"** significa que la tabla `event_days` no tiene filas (o no existe). Hay que aplicar las migraciones y luego ejecutar el seed.

---

## 1. Aplicar migraciones en Supabase

Entra en **Supabase** → tu proyecto → **SQL Editor** → **New query**.

### Paso 1.1 — Crear tablas

Pega y ejecuta **todo** el contenido de `supabase/migrations/event_days_daily_inventory.sql`:

```sql
-- event_days: one row per festival date
-- daily_inventory: per-day per ticket_type stock, price, FOMO, overbooking
CREATE TABLE IF NOT EXISTS public.event_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_day_id UUID NOT NULL REFERENCES public.event_days(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  nominal_stock INT NOT NULL,
  price INT NOT NULL,
  fomo_threshold INT NOT NULL,
  overbooking_tolerance INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_day_id, ticket_type_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_inventory_event_day ON public.daily_inventory(event_day_id);
CREATE INDEX IF NOT EXISTS idx_daily_inventory_ticket_type ON public.daily_inventory(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_event_days_date ON public.event_days(event_date);

ALTER TABLE public.event_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access event_days"
  ON public.event_days FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access daily_inventory"
  ON public.daily_inventory FOR ALL TO service_role USING (true) WITH CHECK (true);
```

Pulsa **Run**. Debe terminar sin error.

### Paso 1.2 — Añadir event_id a event_days

En una **nueva query**, pega y ejecuta el contenido de `supabase/migrations/entradas_event_id.sql`:

```sql
ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_days_event_id ON public.event_days(event_id);
```

**Run**. Si falla con "relation events does not exist", primero necesitas tener la tabla `events` (del módulo MP / tickets). Si ya usas `/tickets` en ese proyecto, `events` existe.

---

## 2. Ejecutar el seed desde tu máquina

Desde la raíz del proyecto, con las variables de Supabase en el entorno (tu `.env.local` ya las tiene):

```bash
cd /home/lvc/web_oficial_festival
source .env.local 2>/dev/null || export $(grep -v '^#' .env.local | xargs)
npm run db:seed
```

En Windows (PowerShell) o si lo anterior falla, pon las variables a mano:

```bash
set -a
source .env.local
set +a
npm run db:seed
```

O en una sola línea (sustituye por tus valores reales):

```bash
SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run db:seed
```

Si el seed termina bien, verás algo como:

- `Seeding ticket_types...`
- `Seeding events...`
- `Seeding event_days...`
- `Seeding daily_inventory...`
- `Seeding inventory...`
- `Done. daily_inventory: 48 rows; inventory: 48 rows.`

---

## 3. Probar de nuevo

Abre http://localhost:3000/entradas, elige cualquier fecha (por ejemplo 07 FEB). Deberían aparecer los tipos de entrada (Familiar, Todo el Día, Estac. Normal, Estac. VIP) con precios y disponibilidad.
