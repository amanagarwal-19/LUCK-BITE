import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Business, Listing, Reservation } from '@/types';

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('listings')
      .select('*, business:businesses(*)')
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

export function useBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
    setBusinesses((data ?? []) as Business[]);
    setLoading(false);
  }, []);

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
      .select('*, listing:listings(*, business:businesses(*))')
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

export function useCustomerReservations(sessionId: string | null) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservations = useCallback(async () => {
    if (!sessionId) {
      setReservations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select('*, listing:listings(*, business:businesses(*))')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error) {
      setReservations([]);
    } else {
      setReservations((data ?? []) as Reservation[]);
    }
    setLoading(false);
  }, [sessionId]);

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
