-- Migración: Añadir columna external_reference a email_logs y hacer order_id nullable
-- Fecha: 2026-02-08
-- Propósito: Mejorar idempotencia de emails usando external_reference en lugar de to_email+subject

-- 1. Hacer order_id nullable (permite emails sin orden específica, ej: compra con múltiples órdenes)
ALTER TABLE public.email_logs ALTER COLUMN order_id DROP NOT NULL;

-- 2. Añadir columna external_reference (nullable para registros previos)
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS external_reference TEXT NULL;

COMMENT ON COLUMN public.email_logs.external_reference IS 'UUID del external_reference de la compra (para idempotencia basada en compra, no en usuario)';

-- 3. Crear índice para queries de idempotencia por external_reference
CREATE INDEX IF NOT EXISTS idx_email_logs_external_reference
  ON public.email_logs(external_reference)
  WHERE external_reference IS NOT NULL;

COMMENT ON INDEX idx_email_logs_external_reference IS 'Idempotencia: permite verificar rápidamente si ya se envió email para un external_reference específico';
