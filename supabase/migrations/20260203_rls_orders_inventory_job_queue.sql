-- RLS para tablas críticas (auditoría OWASP). Solo service_role puede acceder.
-- Ejecutar en Supabase SQL Editor si las tablas orders e inventory ya existen.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access orders" ON public.orders;
    CREATE POLICY "Service role full access orders"
      ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory') THEN
    ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access inventory" ON public.inventory;
    CREATE POLICY "Service role full access inventory"
      ON public.inventory FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_queue') THEN
    ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access job_queue" ON public.job_queue;
    CREATE POLICY "Service role full access job_queue"
      ON public.job_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
