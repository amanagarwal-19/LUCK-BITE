/*
  # Fix: businesses could not save listings after 20261023000000_listing_archive_and_expiry.sql

  Cause: the trigger function set_listing_expiry() ran with the permissions of the logged-in business
  user, who is not allowed to call its helper next_listing_expiry() (that permission was removed on purpose).
  Every new listing therefore failed with "permission denied for function next_listing_expiry".

  Fix: the trigger function now runs with the function owner's permissions. It only works out a date from the
  row being saved and does not read or change any other table, and the helper stays locked for everyone else.
  RLS, ownership checks and verification are not changed.

  Safe to run more than once.
*/

CREATE OR REPLACE FUNCTION public.set_listing_expiry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
