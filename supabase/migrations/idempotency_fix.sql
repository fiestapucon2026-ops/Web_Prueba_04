-- Migración: tabla idempotency_keys para create-preference (idempotencia)
-- Satisface: INSERT (key), SELECT (init_point, created_at), UPDATE (init_point, external_reference, created_at)

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  init_point TEXT,
  external_reference TEXT,
  response_body JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON public.idempotency_keys(created_at);

-- RLS: solo service_role (backend) puede acceder
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend System Access"
  ON public.idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- anon y authenticated no tienen políticas -> sin acceso
