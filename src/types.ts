export interface Business {
  id: string;
  name: string;
  contact_name: string;
  business_type: string;
  location: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  business_id: string;
  meal_name: string;
  description: string;
  category: string;
  quantity_available: number;
  original_price: number;
  discounted_price: number;
    collection_window: string | null;
  available_until: string | null;
  photo_url: string | null;
  allergen_info: string;
  is_active: boolean;
  created_at: string;
  business?: Business;
}

export interface Reservation {
  id: string;
  listing_id: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  pickup_code: string;
  status: 'pending' | 'collected' | 'cancelled' | 'expired';
  created_at: string;
  session_id: string | null;
  listing?: Listing;
}

export const MEAL_CATEGORIES = [
  'Bakery',
  'Meals',
  'Produce',
  'Sweets',
  'Dairy',
  'Beverages',
] as const;

export const BUSINESS_TYPES = [
  'Bakery',
  'Restaurant',
  'Cafe',
  'Grocery Store',
  'Catering',
  'Food Truck',
] as const;

export type ReservationStatus = Reservation['status'];
