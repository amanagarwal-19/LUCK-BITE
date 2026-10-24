export type BusinessStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

// What anyone browsing the marketplace can see about a business
export interface PublicBusiness {
  id: string;
  name: string;
  business_type: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
}

// Full business record (only returned to its owner and to administrators)
export interface Business extends PublicBusiness {
  status: BusinessStatus;
  created_at: string;
  contact_name?: string;
  email?: string | null;
  phone?: string | null;
  licence_number?: string | null;
  place_id?: string | null;
  evidence_path?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
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
  // Set when a business archives an item; archived items are never shown to customers
  archived_at?: string | null;
  // The moment the item's "available till" time passes
  expires_at?: string | null;
  business?: PublicBusiness;
  // Only present in "near me" results
  distance_km?: number;
  minutes_left?: number | null;
}

export interface Reservation {
  id: string;
  listing_id: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  // Customers see their pickup code. Businesses never receive it (they must be shown it).
  pickup_code?: string;
  status: 'pending' | 'collected' | 'cancelled' | 'expired';
  created_at: string;
  session_id?: string | null;
  unit_price?: number | null;
  original_unit_price?: number | null;
  collected_at?: string | null;
  listing?: Listing;
}

export const MEAL_CATEGORIES = [
  'Starters',
  'Main Course',
  'Rice & Biryani',
  'Breads',
  'Meals',
  'Snacks',
  'Fast Food',
  'Bakery',
  'Sweets',
  'Desserts',
  'Beverages',
  'Dairy',
  'Other',
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

export type UserRole = 'customer' | 'business' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}
