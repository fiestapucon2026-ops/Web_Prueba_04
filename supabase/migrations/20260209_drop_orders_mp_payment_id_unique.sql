-- Permite varias órdenes con el mismo mp_payment_id (un pago puede tener varias líneas: entrada + estacionamiento).
-- La restricción UNIQUE en mp_payment_id, si existe, provoca 23505 en el fallback by-reference al actualizar varias filas.
-- Ver ANALISIS_SECUENCIA_RECUPERACION_TICKETS.md.

DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
  WHERE con.conrelid = 'public.orders'::regclass
    AND con.contype = 'u'
    AND a.attname = 'mp_payment_id'
    AND array_length(con.conkey, 1) = 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Constraint % eliminada en orders.mp_payment_id', cname;
  ELSE
    RAISE NOTICE 'No existía constraint UNIQUE en orders.mp_payment_id';
  END IF;
END $$;
