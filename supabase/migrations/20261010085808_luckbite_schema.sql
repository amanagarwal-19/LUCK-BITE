/*
# Luck Bite — Surplus Food Marketplace Schema

## Overview
Creates the core data model for Luck Bite, a surplus-food marketplace demo.
No authentication is used — this is a prototype, so all tables are accessible
to both the anon and authenticated roles (single-tenant, public/shared data).

## New Tables

### businesses
Stores business profiles created through the business section.
- id (uuid, PK)
- name (text) — business name
- contact_name (text) — person representing the business
- business_type (text) — e.g. bakery, restaurant, cafe
- location (text) — pickup address / area
- email (text) — contact email
- phone (text) — contact phone
- created_at (timestamptz)

### listings
Meal-box listings published by businesses; appear in the customer marketplace.
- id (uuid, PK)
- business_id (uuid, FK → businesses)
- meal_name (text)
- description (text)
- category (text) — e.g. Bakery, Meals, Produce, Sweets
- quantity_available (int) — remaining boxes
- original_price (numeric)
- discounted_price (numeric)
- collection_window (text) — human-readable pickup time window
- allergen_info (text) — allergen / storage notes
- is_active (boolean, default true)
- created_at (timestamptz)

### reservations
Reservation records created when a customer reserves a box.
- id (uuid, PK)
- listing_id (uuid, FK → listings)
- customer_name (text)
- customer_phone (text)
- quantity (int, default 1)
- pickup_code (text, unique) — generated unique code
- status (text) — 'pending', 'collected', 'cancelled', 'expired'
- created_at (timestamptz)

## Security
- RLS enabled on all tables.
- All policies scoped TO anon, authenticated (no-auth prototype).
- Full CRUD allowed for anon + authenticated since data is intentionally shared.

## Important Notes
1. No user_id / auth integration — this is a demo prototype.
2. Reservation quantity logic is enforced in the application layer.
3. Sample data is seeded for demonstration.
*/

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text NOT NULL,
  business_type text NOT NULL DEFAULT 'Restaurant',
  location text NOT NULL,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lb_read_businesses" ON businesses;
CREATE POLICY "lb_read_businesses" ON businesses
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "lb_insert_businesses" ON businesses;
CREATE POLICY "lb_insert_businesses" ON businesses
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lb_update_businesses" ON businesses;
CREATE POLICY "lb_update_businesses" ON businesses
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lb_delete_businesses" ON businesses;
CREATE POLICY "lb_delete_businesses" ON businesses
  FOR DELETE TO anon, authenticated USING (true);

-- Listings
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  meal_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Meals',
  quantity_available integer NOT NULL DEFAULT 0,
  original_price numeric(10,2) NOT NULL DEFAULT 0,
  discounted_price numeric(10,2) NOT NULL DEFAULT 0,
  collection_window text NOT NULL,
  allergen_info text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lb_read_listings" ON listings;
CREATE POLICY "lb_read_listings" ON listings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "lb_insert_listings" ON listings;
CREATE POLICY "lb_insert_listings" ON listings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lb_update_listings" ON listings;
CREATE POLICY "lb_update_listings" ON listings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lb_delete_listings" ON listings;
CREATE POLICY "lb_delete_listings" ON listings
  FOR DELETE TO anon, authenticated USING (true);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  pickup_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lb_read_reservations" ON reservations;
CREATE POLICY "lb_read_reservations" ON reservations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "lb_insert_reservations" ON reservations;
CREATE POLICY "lb_insert_reservations" ON reservations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lb_update_reservations" ON reservations;
CREATE POLICY "lb_update_reservations" ON reservations
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lb_delete_reservations" ON reservations;
CREATE POLICY "lb_delete_reservations" ON reservations
  FOR DELETE TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_listings_business ON listings(business_id);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active);
CREATE INDEX IF NOT EXISTS idx_reservations_listing ON reservations(listing_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
