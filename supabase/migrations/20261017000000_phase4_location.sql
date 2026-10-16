/*
  # Phase 4: business location + nearby discovery

  1. businesses: latitude, longitude, place_id (the exact map pin the owner confirmed)
  2. register_business now requires the map location
  3. update_business_location: the owner can change their pin later (the change is written to the audit log)
  4. nearby_listings: finds eligible meal boxes within a radius of the customer, sorted by distance or by collection time

  Run AFTER 20261016000000_separate_customer_business_accounts.sql (this file keeps its business-account check).
*/

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS place_id text;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_coords_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_coords_check
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  );

CREATE INDEX IF NOT EXISTS idx_businesses_coords ON public.businesses(latitude, longitude);

-- A restaurant's pin is public (like on any food app); everything else stays private
GRANT SELECT (latitude, longitude) ON public.businesses TO anon, authenticated;

-- 2. Registration now needs the map location ------------------------------------
DROP FUNCTION IF EXISTS public.register_business(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.register_business(
  p_name text, p_contact_name text, p_business_type text, p_location text,
  p_email text, p_phone text, p_licence_number text, p_evidence_path text,
  p_latitude double precision, p_longitude double precision, p_place_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;

  -- Only business accounts can register a business
  SELECT coalesce(
    (SELECT p.role FROM public.user_profiles p WHERE p.id = auth.uid()),
    (SELECT nullif(u.raw_user_meta_data->>'role', '') FROM auth.users u WHERE u.id = auth.uid())
  ) INTO v_role;
  IF coalesce(v_role, 'customer') NOT IN ('business', 'admin') THEN
    RAISE EXCEPTION 'Only business accounts can register a business.';
  END IF;

  IF length(trim(coalesce(p_name, ''))) < 2 OR length(p_name) > 100 THEN
    RAISE EXCEPTION 'Please enter a valid business name.';
  END IF;
  IF length(trim(coalesce(p_contact_name, ''))) < 2 OR length(p_contact_name) > 100 THEN
    RAISE EXCEPTION 'Please enter a valid contact name.';
  END IF;
  IF length(trim(coalesce(p_location, ''))) < 3 OR length(p_location) > 200 THEN
    RAISE EXCEPTION 'Please choose your business location on the map.';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Please choose your business location on the map.';
  END IF;
  IF p_email IS NULL OR trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address.';
  END IF;
  IF p_phone IS NULL OR trim(p_phone) !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Please enter a valid 10-digit mobile number.';
  END IF;
  IF p_licence_number IS NOT NULL AND length(p_licence_number) > 60 THEN
    RAISE EXCEPTION 'The licence number is too long.';
  END IF;
  IF p_evidence_path IS NOT NULL AND split_part(p_evidence_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Invalid verification document.';
  END IF;
  IF (SELECT count(*) FROM public.businesses b WHERE b.owner_id = auth.uid()) >= 5 THEN
    RAISE EXCEPTION 'You have reached the limit of 5 business registrations.';
  END IF;

  INSERT INTO public.businesses
    (owner_id, name, contact_name, business_type, location, latitude, longitude, place_id,
     email, phone, licence_number, evidence_path, status)
  VALUES
    (auth.uid(), trim(p_name), trim(p_contact_name),
     coalesce(nullif(trim(coalesce(p_business_type, '')), ''), 'Restaurant'),
     trim(p_location), p_latitude, p_longitude, nullif(trim(coalesce(p_place_id, '')), ''),
     trim(p_email), trim(p_phone),
     nullif(trim(coalesce(p_licence_number, '')), ''), p_evidence_path, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3. The owner can correct their pin (recorded in the audit log automatically) ------
CREATE OR REPLACE FUNCTION public.update_business_location(
  p_business_id uuid, p_location text, p_latitude double precision, p_longitude double precision, p_place_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;
  IF length(trim(coalesce(p_location, ''))) < 3 OR length(p_location) > 200 THEN
    RAISE EXCEPTION 'Please choose your business location on the map.';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Please choose your business location on the map.';
  END IF;

  UPDATE public.businesses
     SET location = trim(p_location),
         latitude = p_latitude,
         longitude = p_longitude,
         place_id = nullif(trim(coalesce(p_place_id, '')), '')
   WHERE id = p_business_id
     AND owner_id = auth.uid()
     AND status IN ('pending', 'approved');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You cannot change the location of this business.';
  END IF;
END;
$$;

-- 4. Nearby discovery ---------------------------------------------------------
-- Returns eligible listings (active, in stock, from approved businesses that have a map pin)
-- within p_radius_km of the customer. p_sort: 'distance' or 'time' (collection ending soonest).
-- Closed-for-today listings (their "available till" time has passed) are shown last.
-- Times are compared in Indian Standard Time.
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
        AND l.quantity_available > 0
        AND b.status = 'approved'
        AND b.latitude IS NOT NULL
        AND b.longitude IS NOT NULL
    ) x
    WHERE x.dist <= v_radius
  ), '[]'::jsonb);
END;
$$;

-- 5. Who may call what ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.register_business(text, text, text, text, text, text, text, text, double precision, double precision, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_business_location(uuid, text, double precision, double precision, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nearby_listings(double precision, double precision, double precision, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_business(text, text, text, text, text, text, text, text, double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_location(uuid, text, double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_listings(double precision, double precision, double precision, text) TO anon, authenticated;
