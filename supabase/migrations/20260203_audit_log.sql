-- Tabla de auditoría para fallos de firma webhook y eventos sensibles.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB,
  ip_or_origin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON public.audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access audit_log"
  ON public.audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.audit_log IS 'Log de auditoría: fallos de firma webhook MP, intentos de abuso.';
