-- Cola de trabajo (Transactional Outbox) + columnas tickets para QR/Storage/validación.
-- Ejecutar en Supabase SQL Editor antes o en el mismo release que el código que usa job_queue y qr_uuid.

-- 1. Tabla de cola de trabajo
CREATE TABLE IF NOT EXISTS public.job_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_queue_pending ON public.job_queue(created_at) WHERE status = 'pending';

COMMENT ON TABLE public.job_queue IS 'Cola de trabajos; el worker procesa type=generate_ticket_pdf.';

-- 2. Columnas en tickets para QR (validación Online A), PDF en Storage y scan
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS qr_uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scanned_by UUID;

COMMENT ON COLUMN public.tickets.qr_uuid IS 'UUID del QR para validación en puerta (Online A).';
COMMENT ON COLUMN public.tickets.pdf_url IS 'URL del PDF en Storage (si se usa bucket tickets).';

-- 3. Bucket Storage (opcional: crear desde Dashboard si falla)
-- En Supabase, el bucket se puede crear vía API o Dashboard. Si tu proyecto permite INSERT en storage.buckets:
INSERT INTO storage.buckets (id, name, public)
VALUES ('tickets', 'tickets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas: solo service_role puede subir; lectura pública (o restringir con RLS)
DROP POLICY IF EXISTS "Public read tickets" ON storage.objects;
CREATE POLICY "Public read tickets" ON storage.objects FOR SELECT USING (bucket_id = 'tickets');

DROP POLICY IF EXISTS "Service upload tickets" ON storage.objects;
CREATE POLICY "Service upload tickets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tickets');
