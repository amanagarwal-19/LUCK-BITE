/*
  # Business analytics ("Impact & Performance")

  Run AFTER the earlier migrations (including 20261019000000_item_wording.sql).

  1. reservations remember the price at the time of booking (unit_price, original_unit_price),
     so revenue stays correct even if the business changes a price later
  2. Items that already have reservations can no longer be deleted from the website
     (turn them off instead), so history and analytics are never lost
  3. business_analytics(): totals, rates and weekly / monthly series for ONE business,
     only for its owner (or an admin)
*/

-- 1. Price snapshots on reservations -------------------------------------------------
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS original_unit_price numeric;

-- Fill in older reservations from their listing's current prices (the audit trigger is paused so this is not logged)
ALTER TABLE public.reservations DISABLE TRIGGER trg_audit_reservations;
UPDATE public.reservations r
   SET unit_price = l.discounted_price,
       original_unit_price = l.original_price
  FROM public.listings l
 WHERE l.id = r.listing_id
   AND (r.unit_price IS NULL OR r.original_unit_price IS NULL);
ALTER TABLE public.reservations ENABLE TRIGGER trg_audit_reservations;

-- New reservations store the prices at booking time
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

  INSERT INTO public.reservations (listing_id, customer_name, customer_phone, quantity, pickup_code, status, session_id, customer_id, unit_price, original_unit_price)
  VALUES (p_listing_id, trim(p_customer_name), trim(p_customer_phone), p_quantity, v_code, 'pending', p_session_id, auth.uid(), v_listing.discounted_price, v_listing.original_price)
  RETURNING id INTO v_id;

  PERFORM set_config('luckbite.skip_audit', 'on', true);
  UPDATE public.listings SET quantity_available = quantity_available - p_quantity WHERE id = p_listing_id;
  PERFORM set_config('luckbite.skip_audit', 'off', true);

  RETURN jsonb_build_object('id', v_id, 'pickup_code', v_code);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_listing(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_listing(uuid, text, text, integer, text) TO authenticated;

-- 2. Keep history: items with reservations cannot be deleted from the website ----------------
CREATE OR REPLACE FUNCTION public.prevent_listing_delete_with_reservations() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Only applies to people using the website (auth.uid() is empty for the Supabase SQL editor)
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.reservations r WHERE r.listing_id = OLD.id) THEN
    RAISE EXCEPTION 'This item already has reservations, so it cannot be deleted. Turn it off instead.';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_listings_keep_history ON public.listings;
CREATE TRIGGER trg_listings_keep_history
  BEFORE DELETE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_listing_delete_with_reservations();

-- 3. Analytics -----------------------------------------------------------------------------
-- p_days: look-back window for the headline numbers (NULL = all time).
-- The weekly (last 12 weeks) and monthly (last 12 months) series are always returned.
-- Weeks and months follow Indian Standard Time and are counted by RESERVATION date.
-- "items_listed" = items put up for sale = stock still left + items reserved and not cancelled.
CREATE OR REPLACE FUNCTION public.business_analytics(p_business_id uuid, p_days integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since timestamptz;
  v_now_ist timestamp := now() AT TIME ZONE 'Asia/Kolkata';
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_business_owner(p_business_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'You do not have access to this business.';
  END IF;
  IF p_days IS NOT NULL AND (p_days < 1 OR p_days > 3650) THEN
    RAISE EXCEPTION 'Invalid period.';
  END IF;

  v_since := CASE WHEN p_days IS NULL THEN NULL ELSE now() - make_interval(days => p_days) END;

  RETURN (
    WITH supply AS (
      SELECT l.id, l.created_at,
             l.quantity_available + coalesce((
               SELECT sum(r.quantity) FROM public.reservations r
                WHERE r.listing_id = l.id AND r.status IN ('pending', 'collected')
             ), 0) AS supplied
        FROM public.listings l
       WHERE l.business_id = p_business_id
    ),
    res_all AS (
      SELECT r.created_at, r.quantity, r.status,
             coalesce(r.unit_price, l.discounted_price) AS price,
             coalesce(r.original_unit_price, l.original_price) AS orig_price
        FROM public.reservations r
        JOIN public.listings l ON l.id = r.listing_id
       WHERE l.business_id = p_business_id
    ),
    res AS (
      SELECT * FROM res_all WHERE v_since IS NULL OR created_at >= v_since
    ),
    agg AS (
      SELECT
        coalesce(sum(quantity), 0) AS items_reserved,
        coalesce(sum(quantity) FILTER (WHERE status = 'collected'), 0) AS items_collected,
        coalesce(sum(quantity) FILTER (WHERE status = 'cancelled'), 0) AS items_cancelled,
        coalesce(sum(quantity) FILTER (WHERE status = 'pending'), 0) AS items_pending,
        count(*) AS reservations_total,
        count(*) FILTER (WHERE status = 'collected') AS reservations_collected,
        count(*) FILTER (WHERE status = 'cancelled') AS reservations_cancelled,
        count(*) FILTER (WHERE status = 'pending') AS reservations_pending,
        coalesce(sum(quantity * price) FILTER (WHERE status = 'collected'), 0) AS revenue_recovered,
        coalesce(sum(quantity * (orig_price - price)) FILTER (WHERE status = 'collected'), 0) AS customer_savings,
        coalesce(sum(quantity * price) FILTER (WHERE status = 'pending'), 0) AS pending_value
      FROM res
    )
    SELECT jsonb_build_object(
      'summary', (
        SELECT to_jsonb(agg) || jsonb_build_object(
          'listings_count', (SELECT count(*) FROM supply s WHERE v_since IS NULL OR s.created_at >= v_since),
          'items_listed', coalesce((SELECT sum(s.supplied) FROM supply s WHERE v_since IS NULL OR s.created_at >= v_since), 0)
        ) FROM agg
      ),
      'weekly', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'period', to_char(w.period, 'YYYY-MM-DD'),
                 'listed', coalesce((SELECT sum(s.supplied) FROM supply s
                                      WHERE date_trunc('week', s.created_at AT TIME ZONE 'Asia/Kolkata') = w.period), 0),
                 'reserved', coalesce((SELECT sum(r.quantity) FROM res_all r
                                      WHERE date_trunc('week', r.created_at AT TIME ZONE 'Asia/Kolkata') = w.period), 0),
                 'collected', coalesce((SELECT sum(r.quantity) FROM res_all r
                                      WHERE r.status = 'collected'
                                        AND date_trunc('week', r.created_at AT TIME ZONE 'Asia/Kolkata') = w.period), 0),
                 'revenue', coalesce((SELECT sum(r.quantity * r.price) FROM res_all r
                                      WHERE r.status = 'collected'
                                        AND date_trunc('week', r.created_at AT TIME ZONE 'Asia/Kolkata') = w.period), 0)
               ) ORDER BY w.period)
          FROM generate_series(date_trunc('week', v_now_ist) - interval '11 weeks', date_trunc('week', v_now_ist), interval '1 week') AS w(period)
      ), '[]'::jsonb),
      'monthly', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'period', to_char(m.period, 'YYYY-MM-DD'),
                 'listed', coalesce((SELECT sum(s.supplied) FROM supply s
                                      WHERE date_trunc('month', s.created_at AT TIME ZONE 'Asia/Kolkata') = m.period), 0),
                 'reserved', coalesce((SELECT sum(r.quantity) FROM res_all r
                                      WHERE date_trunc('month', r.created_at AT TIME ZONE 'Asia/Kolkata') = m.period), 0),
                 'collected', coalesce((SELECT sum(r.quantity) FROM res_all r
                                      WHERE r.status = 'collected'
                                        AND date_trunc('month', r.created_at AT TIME ZONE 'Asia/Kolkata') = m.period), 0),
                 'revenue', coalesce((SELECT sum(r.quantity * r.price) FROM res_all r
                                      WHERE r.status = 'collected'
                                        AND date_trunc('month', r.created_at AT TIME ZONE 'Asia/Kolkata') = m.period), 0)
               ) ORDER BY m.period)
          FROM generate_series(date_trunc('month', v_now_ist) - interval '11 months', date_trunc('month', v_now_ist), interval '1 month') AS m(period)
      ), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.business_analytics(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_analytics(uuid, integer) TO authenticated;
