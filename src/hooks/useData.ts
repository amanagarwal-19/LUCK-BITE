import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Business, Listing, Reservation } from '@/types';

// Only these business columns are public. Contact details and verification data stay private.
const PUBLIC_BUSINESS_COLUMNS = 'id,name,business_type,location,latitude,longitude';

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('listings')
      .select(`*, business:businesses(${PUBLIC_BUSINESS_COLUMNS})`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setListings((data ?? []) as Listing[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
}

export function useBusinessListings(businessId: string | null) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    if (!businessId) {
      setListings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setListings((data ?? []) as Listing[]);
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
}

// Meals near the customer (sorted by distance, or by collection time)
export function useNearbyListings(
  coords: { lat: number; lng: number } | null,
  radiusKm: number,
  sortBy: 'distance' | 'time'
) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lat = coords?.lat ?? null;
  const lng = coords?.lng ?? null;

  const fetchListings = useCallback(async () => {
    if (lat === null || lng === null) {
      setListings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('nearby_listings', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
      p_sort: sortBy,
    });
    if (error) {
      setError(error.message);
      setListings([]);
    } else {
      setListings((data ?? []) as Listing[]);
    }
    setLoading(false);
  }, [lat, lng, radiusKm, sortBy]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
}

// The signed-in user's own businesses (with their verification status)
export function useMyBusinesses(userId: string | null) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = useCallback(async () => {
    if (!userId) {
      setBusinesses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.rpc('my_businesses');
    setBusinesses((data ?? []) as Business[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  return { businesses, loading, refetch: fetchBusinesses };
}

export function useBusinessReservations(businessId: string | null) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservations = useCallback(async () => {
    if (!businessId) {
      setReservations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select(`id,listing_id,customer_name,customer_phone,quantity,status,created_at,unit_price,original_unit_price,collected_at, listing:listings(*, business:businesses(${PUBLIC_BUSINESS_COLUMNS}))`)
      .in('listing_id', (
        await supabase.from('listings').select('id').eq('business_id', businessId)
      ).data?.map((l) => l.id) ?? [])
      .order('created_at', { ascending: false });
    if (error) {
      setReservations([]);
    } else {
      setReservations((data ?? []) as Reservation[]);
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  return { reservations, loading, refetch: fetchReservations };
}

// A customer's own reservations, found by their browser session (and their account if signed in)
export function useCustomerReservations(sessionId: string | null, userId: string | null = null) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservations = useCallback(async () => {
    if (!sessionId && !userId) {
      setReservations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('get_my_reservations', { p_session_id: sessionId ?? '' });
    if (error) {
      setReservations([]);
    } else {
      setReservations((data ?? []) as Reservation[]);
    }
    setLoading(false);
  }, [sessionId, userId]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  return { reservations, loading, refetch: fetchReservations };
}

export function generatePickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LB-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
