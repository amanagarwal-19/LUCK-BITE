/*
  # QR-code pickup verification

  Run AFTER the earlier migrations (including 20261020000000_business_analytics.sql).

  1. reservations: collected_at / collected_by (who confirmed the pickup, and when)
  2. A business can only mark an item "collected" by giving the customer's pickup code.
     The server checks the code, that the reservation belongs to THAT business, and that it is still
     pending. A reservation can be confirmed only once.
  3. Businesses can no longer read pickup codes from the website (the customer has to show them),
     otherwise the check would mean nothing.
  4. The QR code only contains the pickup code. Scanning it just fills in the code, and the same
     server checks run.
*/

-- 1. Who confirmed the pickup, and when ----------------------------------------------------
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS collected_at timestamptz;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS collected_by uuid;

-- Fill in the time for items that were already collected (taken from the change log, when available)
ALTER TABLE public.reservations DISABLE TRIGGER trg_audit_reservations;
UPDATE public.reservations r
   SET collected_at = a.occurred_at
  FROM (
    SELECT DISTINCT ON (record_id) record_id, occurred_at
      FROM public.audit_log
     WHERE table_name = 'reservations' AND changes -> 'status' ->> 'new' = 'collected'
     ORDER BY record_id, occurred_at DESC
  ) a
 WHERE a.record_id = r.id AND r.status = 'collected' AND r.collected_at IS NULL;
ALTER TABLE public.reservations ENABLE TRIGGER trg_audit_reservations;

-- 2. Pickup code helpers ----------------------------------------------------------------------
-- Accepts "lb-abc123", " LB-ABC123 ", "ABC123" and returns "LB-ABC123"
CREATE OR REPLACE FUNCTION public.normalize_pickup_code(p_code text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
           WHEN c ~ '^LB-[A-Z0-9]{6}$' THEN c
           WHEN c ~ '^LB[A-Z0-9]{6}$' THEN 'LB-' || substr(c, 3)
           WHEN c ~ '^[A-Z0-9]{6}$' THEN 'LB-' || c
           ELSE c
         END
    FROM (SELECT upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) AS c) x;
$$;

-- Look a code up WITHOUT confirming it: shows who it is for, so the business can check before confirming.
-- Only works for reservations of an approved business owned by the caller.
CREATE OR REPLACE FUNCTION public.lookup_pickup(p_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_res public.reservations%ROWTYPE;
  v_listing public.listings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;

  v_code := public.normalize_pickup_code(p_code);

  SELECT r.* INTO v_res
    FROM public.reservations r
    JOIN public.listings l ON l.id = r.listing_id
    JOIN public.businesses b ON b.id = l.business_id
   WHERE r.pickup_code = v_code AND b.owner_id = auth.uid() AND b.status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No reservation with this code was found for your business.';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = v_res.listing_id;

  RETURN jsonb_build_object(
    'reservation_id', v_res.id,
    'status', v_res.status,
    'customer_name', v_res.customer_name,
    'meal_name', v_listing.meal_name,
    'quantity', v_res.quantity,
    'total', v_res.quantity * coalesce(v_res.unit_price, v_listing.discounted_price),
    'available_until', v_listing.available_until,
    'reserved_at', v_res.created_at,
    'collected_at', v_res.collected_at
  );
END;
$$;

-- Confirm the pickup. Checks everything again on the server, and works only once per reservation.
CREATE OR REPLACE FUNCTION public.confirm_pickup(p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_res public.reservations%ROWTYPE;
  v_business uuid;
  v_updated integer;
  v_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;

  v_code := public.normalize_pickup_code(p_code);

  -- Lock the reservation so two people confirming at the same moment cannot both succeed
  SELECT r.* INTO v_res FROM public.reservations r WHERE r.pickup_code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No reservation with this code was found for your business.';
  END IF;

  SELECT l.business_id INTO v_business FROM public.listings l WHERE l.id = v_res.listing_id;
  IF NOT public.owns_approved_business(v_business) THEN
    -- same message as "not found", so codes of other businesses are never revealed
    RAISE EXCEPTION 'No reservation with this code was found for your business.';
  END IF;

  IF v_res.status = 'collected' THEN
    RAISE EXCEPTION 'This pickup was already confirmed%.',
      coalesce(' on ' || to_char(v_res.collected_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH24:MI'), '');
  END IF;
  IF v_res.status = 'cancelled' THEN
    RAISE EXCEPTION 'This reservation was cancelled.';
  END IF;
  IF v_res.status <> 'pending' THEN
    RAISE EXCEPTION 'This reservation can no longer be collected.';
  END IF;

  v_at := now();
  UPDATE public.reservations
     SET status = 'collected', collected_at = v_at, collected_by = auth.uid()
   WHERE id = v_res.id AND status = 'pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'This reservation can no longer be collected.';
  END IF;

  RETURN jsonb_build_object('reservation_id', v_res.id, 'status', 'collected', 'collected_at', v_at);
END;
$$;

-- "Collected" can now only be set with the pickup code (confirm_pickup). Cancelling stays as it was.
CREATE OR REPLACE FUNCTION public.set_reservation_status(p_reservation_id uuid, p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res public.reservations%ROWTYPE;
  v_business uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;
  IF p_status = 'collected' THEN
    RAISE EXCEPTION 'To mark an item as collected, scan or enter the customer''s pickup code.';
  END IF;
  IF p_status <> 'cancelled' THEN
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

  UPDATE public.reservations SET status = 'cancelled' WHERE id = p_reservation_id;

  PERFORM set_config('luckbite.skip_audit', 'on', true);
  UPDATE public.listings SET quantity_available = quantity_available + v_res.quantity WHERE id = v_res.listing_id;
  PERFORM set_config('luckbite.skip_audit', 'off', true);
END;
$$;

-- 3. Businesses cannot read pickup codes (or session ids) through the website ---------------------
-- (column-level permissions: list every column the business MAY read)
REVOKE SELECT ON public.reservations FROM authenticated;
GRANT SELECT (id, listing_id, customer_name, customer_phone, quantity, status, created_at,
              unit_price, original_unit_price, collected_at)
  ON public.reservations TO authenticated;

-- 4. Who may call what -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.normalize_pickup_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lookup_pickup(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_pickup(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_reservation_status(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.lookup_pickup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_pickup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_reservation_status(uuid, text) TO authenticated;
