/*
  # Wording update: "box" -> "meal" / "item" in the messages customers see when reserving.
  Safe to run once. Only replaces the reserve_listing function.
*/

CREATE OR REPLACE FUNCTION public.reserve_listing(
  p_listing_id uuid, p_customer_name text, p_customer_phone text, p_quantity integer, p_session_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_code text;
  v_id uuid;
  v_role text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in to reserve a meal.';
  END IF;

  SELECT coalesce((SELECT p.role FROM public.user_profiles p WHERE p.id = auth.uid()), 'customer') INTO v_role;
  IF v_role NOT IN ('customer', 'admin') THEN
    RAISE EXCEPTION 'Only customer accounts can reserve meals.';
  END IF;

  IF length(trim(coalesce(p_customer_name, ''))) < 1 THEN
    RAISE EXCEPTION 'Please enter your name.';
  END IF;
  IF length(p_customer_name) > 100 THEN
    RAISE EXCEPTION 'Name is too long.';
  END IF;
  IF p_customer_phone IS NULL OR trim(p_customer_phone) !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Please enter a valid 10-digit mobile number.';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 20 THEN
    RAISE EXCEPTION 'Quantity must be between 1 and 20.';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR NOT v_listing.is_active THEN
    RAISE EXCEPTION 'This listing is no longer available.';
  END IF;
  IF NOT public.business_is_approved(v_listing.business_id) THEN
    RAISE EXCEPTION 'This listing is no longer available.';
  END IF;
  IF v_listing.quantity_available < p_quantity THEN
    RAISE EXCEPTION 'Only % item(s) left.', v_listing.quantity_available;
  END IF;

  LOOP
    v_code := 'LB-';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.reservations r WHERE r.pickup_code = v_code);
  END LOOP;

  INSERT INTO public.reservations (listing_id, customer_name, customer_phone, quantity, pickup_code, status, session_id, customer_id)
  VALUES (p_listing_id, trim(p_customer_name), trim(p_customer_phone), p_quantity, v_code, 'pending', p_session_id, auth.uid())
  RETURNING id INTO v_id;

  PERFORM set_config('luckbite.skip_audit', 'on', true);
  UPDATE public.listings SET quantity_available = quantity_available - p_quantity WHERE id = p_listing_id;
  PERFORM set_config('luckbite.skip_audit', 'off', true);

  RETURN jsonb_build_object('id', v_id, 'pickup_code', v_code);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_listing(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_listing(uuid, text, text, integer, text) TO authenticated;
