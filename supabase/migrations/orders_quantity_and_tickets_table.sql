-- 1. Agregar quantity a orders (cantidad de unidades por ítem de compra)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN quantity INT NOT NULL DEFAULT 1;
  END IF;
END $$;

-- 2. Tabla tickets: una fila por ticket físico (estado + descuento opcional)
-- Condiciones: disponible para venta (no hay fila), vendido no utilizado (sold_unused), utilizado (used)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sold_unused', 'used')) DEFAULT 'sold_unused',
  discount_amount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_inventory_status ON public.tickets(inventory_id, status);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access tickets"
  ON public.tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
