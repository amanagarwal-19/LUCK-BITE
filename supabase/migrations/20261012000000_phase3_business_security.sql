/*
  # Phase 3: business accounts, verification, ownership and audit log

  1. businesses: owner_id, status (pending/approved/rejected/suspended), verification fields
  2. admins table (only changeable from the Supabase dashboard / SQL editor)
  3. Row Level Security: only the verified OWNER of a business can change its listings
  4. Customers can no longer write directly to listings or reservations:
     reservations are made / updated through trusted database functions
  5. audit_log: records who changed prices, descriptions, availability, business status and when
  6. Private storage bucket for verification documents; meal photos limited to verified owners
*/

-- ---------------------------------------------------------------------------
-- 1. Businesses: ownership + verification columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS licence_number text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS evidence_path text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Demo businesses created before this phase have no owner: keep them visible, nobody can edit them.
UPDATE public.businesses SET status = 'approved' WHERE owner_id IS NULL AND status = 'pending';

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_status_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON public.businesses(owner_id);

-- Listings / reservations: extra columns and sanity checks
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_values_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_values_check
  CHECK (quantity_available >= 0 AND original_price >= 0 AND discounted_price >= 0 AND discounted_price <= original_price)
  NOT VALID;

ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_values_check;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_values_check
  CHECK (quantity BETWEEN 1 AND 20 AND status IN ('pending', 'collected', 'cancelled', 'expired'))
  NOT VALID;

-- ---------------------------------------------------------------------------
-- 2. Admins (no policies at all: nobody can read or write this table from the website)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admins FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Audit log (written only by triggers; nobody can edit or delete entries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_role text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  business_id uuid,
  action text NOT NULL,
  changes jsonb,
  old_data jsonb,
  new_data jsonb
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON public.audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_business ON public.audit_log(business_id);

CREATE OR REPLACE FUNCTION public.audit_log_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The audit log cannot be edited or deleted.';
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

-- ---------------------------------------------------------------------------
-- 4. Helper functions used by the security policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id AND b.owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.owns_approved_business(p_business_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = auth.uid() AND b.status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.business_is_approved(p_business_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id AND b.status = 'approved');
$$;

CREATE OR REPLACE FUNCTION public.listing_owned_by_me(p_listing_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings l
    JOIN public.businesses b ON b.id = l.business_id
    WHERE l.id = p_listing_id AND b.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

-- BUSINESSES: nobody can insert/update/delete from the website (only the functions below can).
-- Public visitors see only a few safe columns of approved businesses.
DROP POLICY IF EXISTS "lb_read_businesses" ON public.businesses;
DROP POLICY IF EXISTS "lb_insert_businesses" ON public.businesses;
DROP POLICY IF EXISTS "lb_update_businesses" ON public.businesses;
DROP POLICY IF EXISTS "lb_delete_businesses" ON public.businesses;
DROP POLICY IF EXISTS "businesses_select" ON public.businesses;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "businesses_select" ON public.businesses
  FOR SELECT TO anon, authenticated
  USING (status = 'approved' OR public.is_business_owner(id) OR public.is_admin());

REVOKE ALL ON public.businesses FROM anon, authenticated;
GRANT SELECT (id, name, business_type, location, status, created_at) ON public.businesses TO anon, authenticated;

-- LISTINGS: public can read active listings of approved businesses; only the verified owner can change them.
DROP POLICY IF EXISTS "lb_read_listings" ON public.listings;
DROP POLICY IF EXISTS "lb_insert_listings" ON public.listings;
DROP POLICY IF EXISTS "lb_update_listings" ON public.listings;
DROP POLICY IF EXISTS "lb_delete_listings" ON public.listings;
DROP POLICY IF EXISTS "listings_select_public" ON public.listings;
DROP POLICY IF EXISTS "listings_select_owner" ON public.listings;
DROP POLICY IF EXISTS "listings_insert_owner" ON public.listings;
DROP POLICY IF EXISTS "listings_update_owner" ON public.listings;
DROP POLICY IF EXISTS "listings_delete_owner" ON public.listings;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings_select_public" ON public.listings
  FOR SELECT TO anon, authenticated
  USING (is_active = true AND public.business_is_approved(business_id));
CREATE POLICY "listings_select_owner" ON public.listings
  FOR SELECT TO authenticated
  USING (public.is_business_owner(business_id) OR public.is_admin());
CREATE POLICY "listings_insert_owner" ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_approved_business(business_id));
CREATE POLICY "listings_update_owner" ON public.listings
  FOR UPDATE TO authenticated
  USING (public.owns_approved_business(business_id))
  WITH CHECK (public.owns_approved_business(business_id));
CREATE POLICY "listings_delete_owner" ON public.listings
  FOR DELETE TO authenticated
  USING (public.owns_approved_business(business_id));

REVOKE ALL ON public.listings FROM anon, authenticated;
GRANT SELECT ON public.listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.listings TO authenticated;

-- RESERVATIONS: only the business that owns the listing (or an admin) can read them directly.
-- Customers create / view reservations through functions (see below). Nobody writes directly.
DROP POLICY IF EXISTS "lb_read_reservations" ON public.reservations;
DROP POLICY IF EXISTS "lb_insert_reservations" ON public.reservations;
DROP POLICY IF EXISTS "lb_update_reservations" ON public.reservations;
DROP POLICY IF EXISTS "lb_delete_reservations" ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_owner" ON public.reservations;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_select_owner" ON public.reservations
  FOR SELECT TO authenticated
  USING (public.listing_owned_by_me(listing_id) OR public.is_admin());

REVOKE ALL ON public.reservations FROM anon, authenticated;
GRANT SELECT ON public.reservations TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Triggers: protect listing identity + write the audit log
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_listing_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'A listing cannot be moved to another business.';
  END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_listings_protect ON public.listings;
CREATE TRIGGER trg_listings_protect
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.protect_listing_columns();

CREATE OR REPLACE FUNCTION public.audit_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_record uuid;
  v_business uuid;
  v_role text;
BEGIN
  -- Stock changes caused by reservations are skipped (the reservation itself is the record)
  IF current_setting('luckbite.skip_audit', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_record := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_record := OLD.id;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record := NEW.id;
    SELECT jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
      INTO v_changes
      FROM jsonb_each(v_new) n
      LEFT JOIN jsonb_each(v_old) o ON o.key = n.key
      WHERE n.value IS DISTINCT FROM o.value AND n.key <> 'updated_at';
    IF v_changes IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'businesses' THEN
    v_business := v_record;
  ELSIF TG_TABLE_NAME = 'listings' THEN
    v_business := (COALESCE(v_new, v_old) ->> 'business_id')::uuid;
  ELSE
    SELECT l.business_id INTO v_business
      FROM public.listings l
      WHERE l.id = (COALESCE(v_new, v_old) ->> 'listing_id')::uuid;
  END IF;

  v_role := CASE
    WHEN auth.uid() IS NULL THEN 'system'
    WHEN public.is_admin() THEN 'admin'
    ELSE 'user'
  END;

  INSERT INTO public.audit_log (actor_id, actor_role, table_name, record_id, business_id, action, changes, old_data, new_data)
  VALUES (auth.uid(), v_role, TG_TABLE_NAME, v_record, v_business, TG_OP, v_changes, v_old, CASE WHEN TG_OP = 'INSERT' THEN v_new ELSE NULL END);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_listings ON public.listings;
CREATE TRIGGER trg_audit_listings
  AFTER INSERT OR UPDATE OR DELETE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_businesses ON public.businesses;
CREATE TRIGGER trg_audit_businesses
  AFTER INSERT OR UPDATE OR DELETE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_reservations ON public.reservations;
CREATE TRIGGER trg_audit_reservations
  AFTER UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------------
-- 7. Trusted functions (the ONLY way to register a business, approve one, or reserve food)
-- ---------------------------------------------------------------------------

-- A signed-in user registers a NEW business. It always starts as 'pending' and is owned by the caller.
CREATE OR REPLACE FUNCTION public.register_business(
  p_name text, p_contact_name text, p_business_type text, p_location text,
  p_email text, p_phone text, p_licence_number text, p_evidence_path text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;
  IF length(trim(coalesce(p_name, ''))) < 2 OR length(p_name) > 100 THEN
    RAISE EXCEPTION 'Please enter a valid business name.';
  END IF;
  IF length(trim(coalesce(p_contact_name, ''))) < 2 OR length(p_contact_name) > 100 THEN
    RAISE EXCEPTION 'Please enter a valid contact name.';
  END IF;
  IF length(trim(coalesce(p_location, ''))) < 3 OR length(p_location) > 200 THEN
    RAISE EXCEPTION 'Please enter a valid location.';
  END IF;
  IF p_email IS NULL OR trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address.';
  END IF;
  IF p_phone IS NULL OR trim(p_phone) !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Please enter a valid 10-digit mobile number.';
  END IF;
  -- FSSAI number and certificate are optional
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
    (owner_id, name, contact_name, business_type, location, email, phone, licence_number, evidence_path, status)
  VALUES
    (auth.uid(), trim(p_name), trim(p_contact_name),
     coalesce(nullif(trim(coalesce(p_business_type, '')), ''), 'Restaurant'),
     trim(p_location),
     nullif(trim(coalesce(p_email, '')), ''),
     nullif(trim(coalesce(p_phone, '')), ''),
     nullif(trim(coalesce(p_licence_number, '')), ''), p_evidence_path, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- The signed-in owner's own businesses (all details)
CREATE OR REPLACE FUNCTION public.my_businesses() RETURNS SETOF public.businesses
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.businesses b WHERE b.owner_id = auth.uid() ORDER BY b.created_at DESC;
$$;

-- Admin only: approve / reject / suspend
CREATE OR REPLACE FUNCTION public.admin_set_business_status(p_business_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can do this.';
  END IF;
  IF p_status NOT IN ('pending', 'approved', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status.';
  END IF;
  IF p_status IN ('rejected', 'suspended') AND length(trim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Please give a reason.';
  END IF;

  UPDATE public.businesses
     SET status = p_status,
         review_note = nullif(trim(coalesce(p_note, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found.';
  END IF;
END;
$$;

-- Admin only: list businesses with owner email and a duplicate warning
CREATE OR REPLACE FUNCTION public.admin_list_businesses(p_status text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can do this.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(
      to_jsonb(b) || jsonb_build_object(
        'owner_email', u.email,
        'similar_count', (
          SELECT count(*) FROM public.businesses o
          WHERE o.id <> b.id
            AND lower(trim(o.name)) = lower(trim(b.name))
            AND lower(trim(o.location)) = lower(trim(b.location))
        )
      )
      ORDER BY b.created_at DESC
    )
    FROM public.businesses b
    LEFT JOIN auth.users u ON u.id = b.owner_id
    WHERE p_status IS NULL OR b.status = p_status
  ), '[]'::jsonb);
END;
$$;

-- Admin only: audit log with who / what / when
CREATE OR REPLACE FUNCTION public.admin_audit_log(p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can do this.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x.occurred_at DESC, x.log_id DESC)
    FROM (
      SELECT a.id AS log_id, a.occurred_at, u.email AS actor_email, a.actor_role,
             a.table_name, a.record_id, b.name AS business_name, a.action, a.changes
      FROM public.audit_log a
      LEFT JOIN auth.users u ON u.id = a.actor_id
      LEFT JOIN public.businesses b ON b.id = a.business_id
      ORDER BY a.occurred_at DESC, a.id DESC
      LIMIT least(greatest(coalesce(p_limit, 100), 1), 500)
    ) x
  ), '[]'::jsonb);
END;
$$;

-- Customers (guests or signed in) reserve a box. Stock is checked and reduced safely in one step.
CREATE OR REPLACE FUNCTION public.reserve_listing(
  p_listing_id uuid, p_customer_name text, p_customer_phone text, p_quantity integer, p_session_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_code text;
  v_id uuid;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
BEGIN
  IF length(trim(coalesce(p_customer_name, ''))) < 1 OR length(trim(coalesce(p_customer_phone, ''))) < 1 THEN
    RAISE EXCEPTION 'Please enter your name and phone number.';
  END IF;
  IF length(p_customer_name) > 100 OR length(p_customer_phone) > 30 THEN
    RAISE EXCEPTION 'Name or phone number is too long.';
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
    RAISE EXCEPTION 'Only % box(es) left.', v_listing.quantity_available;
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

-- A customer's own reservations (found by their browser session id and/or their account)
CREATE OR REPLACE FUNCTION public.get_my_reservations(p_session_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (p_session_id IS NULL OR length(p_session_id) < 8) AND auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(
      (to_jsonb(r) - 'customer_id') || jsonb_build_object(
        'listing', to_jsonb(l) || jsonb_build_object(
          'business', jsonb_build_object('id', b.id, 'name', b.name, 'business_type', b.business_type, 'location', b.location)
        )
      )
      ORDER BY r.created_at DESC
    )
    FROM public.reservations r
    JOIN public.listings l ON l.id = r.listing_id
    JOIN public.businesses b ON b.id = l.business_id
    WHERE (p_session_id IS NOT NULL AND length(p_session_id) >= 8 AND r.session_id = p_session_id)
       OR (auth.uid() IS NOT NULL AND r.customer_id = auth.uid())
  ), '[]'::jsonb);
END;
$$;

-- The verified owner marks a reservation collected or cancelled (cancelling returns the box to stock)
CREATE OR REPLACE FUNCTION public.set_reservation_status(p_reservation_id uuid, p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res public.reservations%ROWTYPE;
  v_business uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;
  IF p_status NOT IN ('collected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status.';
  END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found.';
  END IF;

  SELECT l.business_id INTO v_business FROM public.listings l WHERE l.id = v_res.listing_id;
  IF NOT public.owns_approved_business(v_business) THEN
    RAISE EXCEPTION 'You do not have permission to manage this reservation.';
  END IF;
  IF v_res.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending reservations can be changed.';
  END IF;

  UPDATE public.reservations SET status = p_status WHERE id = p_reservation_id;

  IF p_status = 'cancelled' THEN
    PERFORM set_config('luckbite.skip_audit', 'on', true);
    UPDATE public.listings SET quantity_available = quantity_available + v_res.quantity WHERE id = v_res.listing_id;
    PERFORM set_config('luckbite.skip_audit', 'off', true);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Who may call which function (Supabase allows everyone by default, so we restrict explicitly)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_business_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owns_approved_business(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_is_approved(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listing_owned_by_me(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_business(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_businesses() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_business_status(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_businesses(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_audit_log(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_listing(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_reservations(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_reservation_status(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owns_approved_business(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_is_approved(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listing_owned_by_me(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_listing(uuid, text, text, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_reservations(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_business(text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_businesses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_reservation_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_business_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_businesses(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit_log(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Storage
-- ---------------------------------------------------------------------------

-- Private bucket for verification documents (each user can only upload into a folder named after their user id)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('verification-docs', 'verification-docs', false, 5242880,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lb_docs_insert_own" ON storage.objects;
CREATE POLICY "lb_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "lb_docs_read_own_or_admin" ON storage.objects;
CREATE POLICY "lb_docs_read_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

-- Meal photos: only the verified owner of a business can upload into that business's folder
DROP POLICY IF EXISTS "lb_meal_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "lb_meal_photos_insert_owner" ON storage.objects;
CREATE POLICY "lb_meal_photos_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meal-photos'
    AND CASE
      WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        THEN public.owns_approved_business(((storage.foldername(name))[1])::uuid)
      ELSE false
    END
  );
