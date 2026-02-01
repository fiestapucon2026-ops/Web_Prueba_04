-- Permite varias órdenes con el mismo external_reference (flujo entradas: entrada + estacionamiento).
-- Si existe UNIQUE(external_reference), la segunda inserción fallaba con "Error al registrar la orden".

DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
  WHERE con.conrelid = 'public.orders'::regclass
    AND con.contype = 'u'
    AND a.attname = 'external_reference'
    AND array_length(con.conkey, 1) = 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', cname);
  END IF;
END $$;
