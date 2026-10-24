/*
  # Sold-out, archived and expired listings

  Run AFTER the earlier migrations (including 20261021000000_qr_pickup_verification.sql).

  1. listings.archived_at  : set when a business archives an item (it leaves the active list, history is kept)
  2. listings.expires_at   : the moment the item's "available till" time passes (worked out by the database)
  3. Customers only ever see items that are active, not archived, not expired and in stock
     (the database rule, "Near me" search and the reserve function all use the same conditions)
  4. manage_listing()      : archive / restore / relist an item (owner of a verified business only)
  5. Items with reservations still cannot be deleted; the message now suggests archiving instead

  Reservations, cancellations, pickup confirmation and stock restoring are NOT changed.
*/

-- 1. New columns ---------------------------------------------------------------------------
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2. When does an item expire? -----------------------------------------------------------------
-- The next moment (Indian time) when the clock shows the "available till" time, counted from p_from.
CREATE OR REPLACE FUNCTION public.next_listing_expiry(p_available_until text, p_from timestamptz) RETURNS timestamptz
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_local timestamp;
  v_target timestamp;
BEGIN
  IF p_available_until IS NULL OR p_available_until !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN NULL;
  END IF;
  v_local := p_from AT TIME ZONE 'Asia/Kolkata';
  v_target := v_local::date + p_available_until::time;
  IF v_target <= v_local THEN
    v_target := v_target + interval '1 day';
  END IF;
  RETURN v_target AT TIME ZONE 'Asia/Kolkata';
END;
$$;

-- New items get an expiry. It is worked out again when the "available till" time changes
-- or when a hidden item is shown again.
CREATE OR REPLACE FUNCTION public.set_listing_expiry() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.expires_at := public.next_listing_expiry(NEW.available_until, now());
  ELSIF NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
        AND (NEW.available_until IS DISTINCT FROM OLD.available_until
             OR (NEW.is_active AND NOT OLD.is_active)) THEN
    NEW.expires_at := public.next_listing_expiry(NEW.available_until, now());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_listings_set_expiry ON public.listings;
CREATE TRIGGER trg_listings_set_expiry
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_listing_expiry();

-- Older items: work out when they expired (triggers are paused so this is not logged as a business edit)
ALTER TABLE public.listings DISABLE TRIGGER USER;
UPDATE public.listings
   SET expires_at = public.next_listing_expiry(available_until, created_at)
 WHERE expires_at IS NULL AND available_until IS NOT NULL;
ALTER TABLE public.listings ENABLE TRIGGER USER;

-- 3. Archive / restore / relist --------------------------------------------------------------------
-- archive: remove the item from the active list (reservations and orders are kept)
-- restore: bring an archived item back as a hidden item
-- relist : show an item again and start a new "available till" window
CREATE OR REPLACE FUNCTION public.manage_listing(p_listing_id uuid, p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;
  IF p_action NOT IN ('archive', 'restore', 'relist') THEN
    RAISE EXCEPTION 'Invalid action.';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owns_approved_business(v_listing.business_id) THEN
    RAISE EXCEPTION 'You do not have permission to change this listing.';
  END IF;

  IF p_action = 'archive' THEN
    UPDATE public.listings SET archived_at = now(), is_active = false WHERE id = p_listing_id;
  ELSIF p_action = 'restore' THEN
    UPDATE public.listings SET archived_at = NULL WHERE id = p_listing_id;
  ELSE
    IF v_listing.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Restore this item before listing it again.';
    END IF;
    UPDATE public.listings
       SET is_active = true,
           expires_at = public.next_listing_expiry(v_listing.available_until, now())
     WHERE id = p_listing_id;
  END IF;
END;
$$;

-- 4. Items with reservations are never deleted from the website: archive them instead ----------------
CREATE OR REPLACE FUNCTION public.prevent_listing_delete_with_reservations() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Only applies to people using the website (auth.uid() is empty for the Supabase SQL editor)
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.reservations r WHERE r.listing_id = OLD.id) THEN
    RAISE EXCEPTION 'This item already has reservations, so it cannot be deleted. Archive it instead.';
  END IF;
  RETURN OLD;
END;
$$;

-- 5. What the public can see: active, not archived, not expired and in stock ---------------------------
DROP POLICY IF EXISTS "listings_select_public" ON public.listings;
CREATE POLICY "listings_select_public" ON public.listings
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND archived_at IS NULL
    AND quantity_available > 0
    AND (expires_at IS NULL OR expires_at > now())
    AND public.business_is_approved(business_id)
  );

-- 6. Reserving: the same rules, checked again on the server -----------------------------------------------
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

  -- The row is locked while we check and reduce the stock, so two people can never reserve the last item together
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND
     OR NOT v_listing.is_active
     OR v_listing.archived_at IS NOT NULL
     OR (v_listing.expires_at IS NOT NULL AND v_listing.expires_at <= now()) THEN
    RAISE EXCEPTION 'This listing is no longer available.';
  END IF;
  IF NOT public.business_is_approved(v_listing.business_id) THEN
    RAISE EXCEPTION 'This listing is no longer available.';
  END IF;
  IF v_listing.quantity_available <= 0 THEN
    RAISE EXCEPTION 'This item is sold out.';
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

-- 7. "Near me" search: archived and expired items are no longer shown ------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_listings(
  p_lat double precision, p_lng double precision,
  p_radius_km double precision DEFAULT 5, p_sort text DEFAULT 'distance'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_radius double precision;
  v_now_min integer;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Invalid location.';
  END IF;

  v_radius := least(greatest(coalesce(p_radius_km, 5), 0.5), 50);
  v_now_min := extract(hour FROM (now() AT TIME ZONE 'Asia/Kolkata'))::integer * 60
             + extract(minute FROM (now() AT TIME ZONE 'Asia/Kolkata'))::integer;

  RETURN coalesce((
    SELECT jsonb_agg(
      to_jsonb(x.l) || jsonb_build_object(
        'distance_km', round(x.dist::numeric, 2),
        'minutes_left', x.mins_left,
        'business', jsonb_build_object(
          'id', x.b_id, 'name', x.b_name, 'business_type', x.b_type, 'location', x.b_location,
          'latitude', x.b_lat, 'longitude', x.b_lng
        )
      )
      ORDER BY
        (x.mins_left IS NOT NULL AND x.mins_left < 0),
        CASE WHEN p_sort = 'time' THEN coalesce(x.mins_left, 100000) ELSE 0 END,
        x.dist
    )
    FROM (
      SELECT
        l,
        b.id AS b_id, b.name AS b_name, b.business_type AS b_type, b.location AS b_location,
        b.latitude AS b_lat, b.longitude AS b_lng,
        6371.0 * 2 * asin(least(1.0, sqrt(
          power(sin(radians(b.latitude - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(b.latitude)) * power(sin(radians(b.longitude - p_lng) / 2), 2)
        ))) AS dist,
        CASE
          WHEN l.available_until ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            THEN (split_part(l.available_until, ':', 1)::integer * 60 + split_part(l.available_until, ':', 2)::integer) - v_now_min
          ELSE NULL
        END AS mins_left
      FROM public.listings l
      JOIN public.businesses b ON b.id = l.business_id
      WHERE l.is_active = true
        AND l.archived_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now())
        AND l.quantity_available > 0
        AND b.status = 'approved'
        AND b.latitude IS NOT NULL
        AND b.longitude IS NOT NULL
    ) x
    WHERE x.dist <= v_radius
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.nearby_listings(double precision, double precision, double precision, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_listings(double precision, double precision, double precision, text) TO anon, authenticated;

-- 8. Who may call what ---------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.next_listing_expiry(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manage_listing(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_listing(uuid, text) TO authenticated;
