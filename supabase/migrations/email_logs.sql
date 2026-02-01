-- Auditing table for send-ticket-email Edge Function (success/failure)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('SENT', 'FAILED')),
  error_message TEXT,
  to_email TEXT,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON public.email_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend System Access"
  ON public.email_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
