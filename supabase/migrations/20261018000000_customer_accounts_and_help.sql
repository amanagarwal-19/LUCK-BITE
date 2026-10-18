/*
  # Customer accounts, login-only reservations, favourites and support requests

  Run AFTER 20261016000000_separate_customer_business_accounts.sql and 20261017000000_phase4_location.sql.

  1. user_profiles: phone, date_of_birth, gender (customers must give a valid 10-digit mobile number)
  2. Sign-up trigger: copies those details, requires a valid phone for new CUSTOMER accounts,
     and no longer accepts "admin" as a role from sign-up data (admins are only set in the admins table)
  3. update_my_profile: a signed-in user changes their own phone / date of birth / gender
  4. reserve_listing: signed-in customers only, valid 10-digit phone required
  5. favourite_businesses: customers save businesses they like
  6. support_requests: help form messages, readable only by admins
*/

-- 1. Profile columns ------------------------------------------------------------
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_phone_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_phone_check CHECK (phone IS NULL OR phone ~ '^[6-9][0-9]{9}$');

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_gender_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_gender_check
  CHECK (gender IS NULL OR gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say'));

-- 2. Sign-up trigger -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_name text;
  v_norm_email text;
  v_existing_role text;
  v_phone text;
  v_dob date;
  v_gender text;
BEGIN
  v_norm_email := lower(trim(NEW.email));
  v_role := lower(trim(coalesce(NEW.raw_user_meta_data->>'role', '')));
  v_name := trim(coalesce(NEW.raw_user_meta_data->>'full_name', ''));

  -- Sign-up data may only ask for a customer or business account. Admins are set only in the admins table.
  IF v_role NOT IN ('customer', 'business') THEN
    IF EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = NEW.id) THEN
      v_role := 'admin';
    ELSIF EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = NEW.id) THEN
      v_role := 'business';
    ELSE
      v_role := 'customer';
    END IF;
  END IF;

  -- Optional profile details
  v_phone := trim(coalesce(NEW.raw_user_meta_data->>'phone', ''));
  IF v_phone !~ '^[6-9][0-9]{9}$' THEN
    v_phone := NULL;
  END IF;

  BEGIN
    v_dob := nullif(trim(coalesce(NEW.raw_user_meta_data->>'date_of_birth', '')), '')::date;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;
  IF v_dob IS NOT NULL AND (v_dob < date '1900-01-01' OR v_dob > (current_date - interval '18 years')::date) THEN
    v_dob := NULL;
  END IF;

  v_gender := lower(trim(coalesce(NEW.raw_user_meta_data->>'gender', '')));
  IF v_gender NOT IN ('female', 'male', 'non_binary', 'prefer_not_to_say') THEN
    v_gender := NULL;
  END IF;

  -- A new customer account must have a valid mobile number
  IF TG_OP = 'INSERT' AND v_role = 'customer' AND v_phone IS NULL THEN
    RAISE EXCEPTION 'A valid 10-digit mobile number is required for customer accounts.';
  END IF;

  -- Safety check against email duplication with another role
  SELECT role INTO v_existing_role
    FROM public.user_profiles
   WHERE email_normalized = v_norm_email AND id <> NEW.id
   LIMIT 1;

  IF v_existing_role IS NOT NULL AND v_existing_role <> v_role THEN
    IF v_existing_role = 'customer' THEN
      RAISE EXCEPTION 'This email is already associated with a Customer account.';
    ELSIF v_existing_role = 'business' THEN
      RAISE EXCEPTION 'This email is already associated with a Business account.';
    ELSE
      RAISE EXCEPTION 'This email is already registered with another account type.';
    END IF;
  END IF;

  INSERT INTO public.user_profiles (id, email, role, full_name, phone, date_of_birth, gender, updated_at)
  VALUES (NEW.id, NEW.email, v_role, nullif(v_name, ''), v_phone, v_dob, v_gender, now())
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = coalesce(nullif(EXCLUDED.full_name, ''), public.user_profiles.full_name),
        phone = coalesce(public.user_profiles.phone, EXCLUDED.phone),
        date_of_birth = coalesce(public.user_profiles.date_of_birth, EXCLUDED.date_of_birth),
        gender = coalesce(public.user_profiles.gender, EXCLUDED.gender),
        updated_at = now();

  RETURN NEW;
END;
$$;

-- 3. A user edits their own profile details ---------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_profile(p_phone text, p_date_of_birth date, p_gender text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;

  SELECT p.role INTO v_role FROM public.user_profiles p WHERE p.id = auth.uid();

  IF v_role = 'customer' AND (p_phone IS NULL OR trim(p_phone) !~ '^[6-9][0-9]{9}$') THEN
    RAISE EXCEPTION 'Please enter a valid 10-digit mobile number.';
  END IF;
  IF p_phone IS NOT NULL AND trim(p_phone) <> '' AND trim(p_phone) !~ '^[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Please enter a valid 10-digit mobile number.';
  END IF;
  IF p_date_of_birth IS NOT NULL AND (p_date_of_birth < date '1900-01-01' OR p_date_of_birth > (current_date - interval '18 years')::date) THEN
    RAISE EXCEPTION 'You must be at least 18 years old to use Luck Bite.';
  END IF;
  IF p_gender IS NOT NULL AND p_gender NOT IN ('female', 'male', 'non_binary', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'Invalid gender option.';
  END IF;

  UPDATE public.user_profiles
     SET phone = nullif(trim(coalesce(p_phone, '')), ''),
         date_of_birth = p_date_of_birth,
         gender = p_gender,
         updated_at = now()
   WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;
END;
$$;

-- 4. Reservations: signed-in customers only, with a real phone number -------------------
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
    RAISE EXCEPTION 'Please sign in to reserve a meal box.';
  END IF;

  SELECT coalesce((SELECT p.role FROM public.user_profiles p WHERE p.id = auth.uid()), 'customer') INTO v_role;
  IF v_role NOT IN ('customer', 'admin') THEN
    RAISE EXCEPTION 'Only customer accounts can reserve meal boxes.';
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

REVOKE ALL ON FUNCTION public.reserve_listing(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_listing(uuid, text, text, integer, text) TO authenticated;

-- 5. Favourite businesses ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favourite_businesses (
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, business_id)
);
ALTER TABLE public.favourite_businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favourites_select_own" ON public.favourite_businesses;
DROP POLICY IF EXISTS "favourites_insert_own" ON public.favourite_businesses;
DROP POLICY IF EXISTS "favourites_delete_own" ON public.favourite_businesses;
CREATE POLICY "favourites_select_own" ON public.favourite_businesses
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "favourites_insert_own" ON public.favourite_businesses
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() AND public.business_is_approved(business_id));
CREATE POLICY "favourites_delete_own" ON public.favourite_businesses
  FOR DELETE TO authenticated USING (customer_id = auth.uid());

REVOKE ALL ON public.favourite_businesses FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.favourite_businesses TO authenticated;

-- 6. Support requests --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  topic text NOT NULL,
  message text NOT NULL,
  pickup_code text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by uuid,
  resolved_at timestamptz
);
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_requests FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON public.support_requests(status, created_at DESC);

-- Anyone (signed in or not, so people with login problems can still ask for help) can send a request
CREATE OR REPLACE FUNCTION public.submit_support_request(
  p_name text, p_email text, p_topic text, p_message text, p_pickup_code text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_recent integer;
BEGIN
  IF length(trim(coalesce(p_name, ''))) < 2 OR length(p_name) > 100 THEN
    RAISE EXCEPTION 'Please enter your name.';
  END IF;
  IF p_email IS NULL OR length(p_email) > 200 OR trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Please enter a valid email address.';
  END IF;
  IF p_topic NOT IN ('reservation', 'collection', 'cancellation', 'food_safety', 'account', 'business', 'feedback', 'other') THEN
    RAISE EXCEPTION 'Please choose a topic.';
  END IF;
  IF length(trim(coalesce(p_message, ''))) < 10 OR length(p_message) > 2000 THEN
    RAISE EXCEPTION 'Please write a message of at least 10 characters (up to 2000).';
  END IF;
  IF p_pickup_code IS NOT NULL AND length(p_pickup_code) > 20 THEN
    RAISE EXCEPTION 'The pickup code is too long.';
  END IF;

  -- Simple spam protection
  SELECT count(*) INTO v_recent
    FROM public.support_requests s
   WHERE s.created_at > now() - interval '1 hour'
     AND (lower(s.email) = lower(trim(p_email)) OR (auth.uid() IS NOT NULL AND s.user_id = auth.uid()));
  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'You have sent several requests recently. Please wait a little before sending another.';
  END IF;

  INSERT INTO public.support_requests (user_id, name, email, topic, message, pickup_code)
  VALUES (auth.uid(), trim(p_name), trim(p_email), p_topic, trim(p_message), nullif(trim(coalesce(p_pickup_code, '')), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_support_requests(p_status text DEFAULT 'open') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can do this.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(s) - 'user_id' - 'resolved_by' ORDER BY s.created_at DESC)
    FROM public.support_requests s
    WHERE p_status IS NULL OR s.status = p_status
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_support_request(p_id uuid, p_resolved boolean DEFAULT true) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can do this.';
  END IF;
  UPDATE public.support_requests
     SET status = CASE WHEN p_resolved THEN 'resolved' ELSE 'open' END,
         resolved_by = CASE WHEN p_resolved THEN auth.uid() ELSE NULL END,
         resolved_at = CASE WHEN p_resolved THEN now() ELSE NULL END
   WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(text, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_support_request(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_support_requests(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_resolve_support_request(uuid, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_my_profile(text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_support_request(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_support_requests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_support_request(uuid, boolean) TO authenticated;
