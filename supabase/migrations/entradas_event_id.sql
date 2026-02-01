-- Añade event_id a event_days para conectar con events/inventory (flujo /entradas).
ALTER TABLE public.event_days
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_days_event_id ON public.event_days(event_id);
