-- Función RPC para actualizar daily_inventory y sincronizar inventory.total_capacity en una transacción.
-- Uso: SELECT * FROM admin_update_daily_inventory(p_id, p_nominal_stock, p_price, p_fomo_threshold, p_overbooking_tolerance);
-- Valores NULL en parámetros significan "no cambiar".

CREATE OR REPLACE FUNCTION public.admin_update_daily_inventory(
  p_id UUID,
  p_nominal_stock INT DEFAULT NULL,
  p_price INT DEFAULT NULL,
  p_fomo_threshold INT DEFAULT NULL,
  p_overbooking_tolerance INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_day_id UUID;
  v_ticket_type_id UUID;
  v_nominal INT;
  v_over INT;
  v_event_id UUID;
  v_total_capacity INT;
BEGIN
  UPDATE public.daily_inventory
  SET
    nominal_stock = COALESCE(p_nominal_stock, nominal_stock),
    price = COALESCE(p_price, price),
    fomo_threshold = COALESCE(p_fomo_threshold, fomo_threshold),
    overbooking_tolerance = COALESCE(p_overbooking_tolerance, overbooking_tolerance)
  WHERE id = p_id
  RETURNING event_day_id, ticket_type_id, nominal_stock, overbooking_tolerance
  INTO v_event_day_id, v_ticket_type_id, v_nominal, v_over;

  IF v_event_day_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Registro no encontrado');
  END IF;

  v_total_capacity := FLOOR(v_nominal * (1 + v_over::numeric / 100));

  SELECT event_id INTO v_event_id
  FROM public.event_days
  WHERE id = v_event_day_id;

  IF v_event_id IS NOT NULL THEN
    UPDATE public.inventory
    SET total_capacity = v_total_capacity
    WHERE event_id = v_event_id AND ticket_type_id = v_ticket_type_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;
