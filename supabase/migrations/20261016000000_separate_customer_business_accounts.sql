/*
  # Separate Customer and Business Accounts Migration

  1. New Table: `public.user_profiles`
     - `id` (uuid, primary key, references auth.users(id) on delete cascade)
     - `email` (text, not null)
     - `email_normalized` (stored generated column: lower(trim(email)))
     - `role` (text, check in ('customer', 'business', 'admin'))
     - `full_name` (text)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)
     - Unique index on `email_normalized` ensures no email can exist across account types.

  2. Triggers:
     - `trg_auth_user_change` synchronizes auth.users inserts/updates to `public.user_profiles`
       and prevents conflicting role registrations for the same email.

  3. Security & Validation RPCs:
     - `check_account_registration(p_email, p_target_role)`: Validates email availability & prevents duplicate/cross-role registration.
     - `validate_login_role(p_expected_role)`: Verifies that signed-in user matches the expected login flow role.
     - `get_user_account_role()`: Retrieves the current user's role securely.

  4. Updated Business & Reservation Functions:
     - `register_business`: Ensures caller has role = 'business' or 'admin'.
     - `my_businesses`: Ensures caller has role = 'business' or 'admin'.
     - `get_my_reservations`: Restricts customer reservation account association to customer accounts.
*/

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  role text NOT NULL CHECK (role IN ('customer', 'business', 'admin')),
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email_normalized ON public.user_profiles(email_normalized);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.user_profiles;
CREATE POLICY "profiles_select_own" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.user_profiles;
CREATE POLICY "profiles_update_own" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT p.role FROM public.user_profiles p WHERE p.id = auth.uid()));

REVOKE ALL ON public.user_profiles FROM anon, authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;

-- 2. Backfill existing users
INSERT INTO public.user_profiles (id, email, role, full_name)
SELECT
  u.id,
  u.email,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = u.id) THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = u.id) THEN 'business'
    ELSE coalesce(nullif(u.raw_user_meta_data->>'role', ''), 'customer')
  END AS role,
  nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), '') AS full_name
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 3. Trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_auth_user_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_name text;
  v_norm_email text;
  v_existing_role text;
BEGIN
  v_norm_email := lower(trim(NEW.email));
  v_role := lower(trim(coalesce(NEW.raw_user_meta_data->>'role', '')));
  v_name := trim(coalesce(NEW.raw_user_meta_data->>'full_name', ''));

  IF v_role NOT IN ('customer', 'business', 'admin') THEN
    IF EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = NEW.id) THEN
      v_role := 'admin';
    ELSIF EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = NEW.id) THEN
      v_role := 'business';
    ELSE
      v_role := 'customer';
    END IF;
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

  INSERT INTO public.user_profiles (id, email, role, full_name, updated_at)
  VALUES (NEW.id, NEW.email, v_role, nullif(v_name, ''), now())
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = coalesce(nullif(EXCLUDED.full_name, ''), public.user_profiles.full_name),
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_change ON auth.users;
CREATE TRIGGER trg_auth_user_change
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_change();

-- 4. Secure Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_account_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT p.role FROM public.user_profiles p WHERE p.id = auth.uid()),
    (SELECT nullif(u.raw_user_meta_data->>'role', '') FROM auth.users u WHERE u.id = auth.uid()),
    'customer'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_account_registration(p_email text, p_target_role text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_norm_email text;
  v_role text;
BEGIN
  v_norm_email := lower(trim(coalesce(p_email, '')));
  IF v_norm_email = '' OR v_norm_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_email', 'message', 'Please enter a valid email address.');
  END IF;

  IF p_target_role NOT IN ('customer', 'business') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_role', 'message', 'Invalid account type specified.');
  END IF;

  SELECT p.role INTO v_role FROM public.user_profiles p WHERE p.email_normalized = v_norm_email LIMIT 1;

  IF v_role IS NULL THEN
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = u.id) THEN 'admin'
      WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = u.id) THEN 'business'
      ELSE coalesce(nullif(u.raw_user_meta_data->>'role', ''), 'customer')
    END INTO v_role
    FROM auth.users u
    WHERE lower(trim(u.email)) = v_norm_email
    LIMIT 1;
  END IF;

  IF v_role IS NOT NULL THEN
    IF v_role = 'customer' AND p_target_role = 'business' THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'role_conflict',
        'message', 'This email is already associated with a Customer account. Please use the Customer login or use a different email for your Business.'
      );
    ELSIF v_role = 'business' AND p_target_role = 'customer' THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'role_conflict',
        'message', 'This email is already associated with a Business account. Please sign in via the Business portal or use a different email.'
      );
    ELSE
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'already_exists',
        'message', 'An account with this email already exists. Please sign in instead.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_login_role(p_expected_role text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Not signed in.');
  END IF;

  SELECT p.role INTO v_role FROM public.user_profiles p WHERE p.id = auth.uid();

  IF v_role IS NULL THEN
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = u.id) THEN 'admin'
      WHEN EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = u.id) THEN 'business'
      ELSE coalesce(nullif(u.raw_user_meta_data->>'role', ''), 'customer')
    END INTO v_role
    FROM auth.users u
    WHERE u.id = auth.uid();
  END IF;

  IF v_role IS NULL THEN
    v_role := 'customer';
  END IF;

  IF v_role = 'admin' THEN
    RETURN jsonb_build_object('valid', true, 'role', 'admin');
  END IF;

  IF v_role <> p_expected_role THEN
    IF v_role = 'customer' AND p_expected_role = 'business' THEN
      RETURN jsonb_build_object(
        'valid', false,
        'role', v_role,
        'error', 'This account is registered as a Customer. Please use the Customer login.'
      );
    ELSIF v_role = 'business' AND p_expected_role = 'customer' THEN
      RETURN jsonb_build_object(
        'valid', false,
        'role', v_role,
        'error', 'This account is registered as a Business. Please use the Business portal to sign in.'
      );
    ELSE
      RETURN jsonb_build_object(
        'valid', false,
        'role', v_role,
        'error', 'Account type mismatch. Please sign in through the correct portal.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('valid', true, 'role', v_role);
END;
$$;

-- 5. Update register_business with role check
CREATE OR REPLACE FUNCTION public.register_business(
  p_name text, p_contact_name text, p_business_type text, p_location text,
  p_email text, p_phone text, p_licence_number text, p_evidence_path text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;

  -- Verify user has a business account
  SELECT coalesce(
    (SELECT p.role FROM public.user_profiles p WHERE p.id = auth.uid()),
    (SELECT nullif(u.raw_user_meta_data->>'role', '') FROM auth.users u WHERE u.id = auth.uid())
  ) INTO v_role;

  IF v_role NOT IN ('business', 'admin') THEN
    RAISE EXCEPTION 'Only business accounts can register a business.';
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

-- 6. Update my_businesses to enforce business role
CREATE OR REPLACE FUNCTION public.my_businesses() RETURNS SETOF public.businesses
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.* FROM public.businesses b
  WHERE b.owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.role IN ('business', 'admin')
    )
  ORDER BY b.created_at DESC;
$$;

-- 7. Update get_my_reservations
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
       OR (auth.uid() IS NOT NULL AND r.customer_id = auth.uid() AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'business'
       ))
  ), '[]'::jsonb);
END;
$$;

-- 8. Grants
REVOKE ALL ON FUNCTION public.get_user_account_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_account_registration(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_login_role(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_account_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_account_registration(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_login_role(text) TO authenticated;
