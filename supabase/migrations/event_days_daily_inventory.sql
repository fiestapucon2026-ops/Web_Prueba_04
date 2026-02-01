-- event_days: one row per festival date
-- daily_inventory: per-day per ticket_type stock, price, FOMO, overbooking
-- Requires ticket_types to exist (create via seed or existing app schema).

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
