import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PublicBusiness } from '@/types';

export interface FavouriteBusiness extends PublicBusiness {
  saved_at: string;
}

// The signed-in customer's saved businesses
export function useFavourites(userId: string | null) {
  const [favourites, setFavourites] = useState<FavouriteBusiness[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!userId) {
      setFavourites([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('favourite_businesses')
      .select('created_at, business:businesses(id,name,business_type,location,latitude,longitude)')
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as unknown as { created_at: string; business: PublicBusiness | null }[];
    setFavourites(
      rows.filter((r) => r.business).map((r) => ({ ...(r.business as PublicBusiness), saved_at: r.created_at }))
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const isFavourite = useCallback((businessId: string) => favourites.some((f) => f.id === businessId), [favourites]);

  // Adds or removes a business. Returns an error message, or null on success.
  const toggle = useCallback(
    async (businessId: string): Promise<string | null> => {
      if (!userId) return 'Please sign in to save favourites.';
      const saved = favourites.some((f) => f.id === businessId);
      const { error } = saved
        ? await supabase.from('favourite_businesses').delete().eq('business_id', businessId)
        : await supabase.from('favourite_businesses').insert({ customer_id: userId, business_id: businessId });
      if (error) return 'Could not update your favourites. Please try again.';
      await refetch();
      return null;
    },
    [userId, favourites, refetch]
  );

  return { favourites, loading, isFavourite, toggle, refetch };
}
