/*
# Add session_id to reservations for guest customer identification

## Overview
This migration adds a `session_id` column to the `reservations` table so that
guest customers (no login) can have their reservations linked to a browser
session. This enables the "My Reservations" feature where a customer can
view all reservations they've made within the same browser session.

## Changes
- Added `session_id` (text, nullable) to `reservations`.
  Nullable because existing reservation records don't have a session_id yet.
  New reservations from the customer UI will always include it.

## Security
- RLS already enabled on `reservations`. No policy changes needed —
  the existing `anon, authenticated` CRUD policies cover the new column.
- The `session_id` is a non-secret random string generated client-side.
  It allows a guest to retrieve their own reservations but is not
  authentication — anyone with the session_id could theoretically view
  those reservations. This is acceptable for a demo prototype.
*/

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS session_id text;
