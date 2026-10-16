import { useCallback, useEffect, useState } from 'react';

export type NearbySort = 'distance' | 'time';
export const RADIUS_OPTIONS = [1, 5, 10, 20] as const;
export type LocateStatus = 'idle' | 'locating' | 'denied' | 'unavailable' | 'unsupported';

const STORAGE_KEY = 'luckbite.nearby.v1';

interface Stored {
  lat: number;
  lng: number;
  radiusKm: number;
  sortBy: NearbySort;
  enabled: boolean;
}

function loadStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v.lat === 'number' && typeof v.lng === 'number') {
      return {
        lat: v.lat,
        lng: v.lng,
        radiusKm: RADIUS_OPTIONS.includes(v.radiusKm) ? v.radiusKm : 5,
        sortBy: v.sortBy === 'time' ? 'time' : 'distance',
        enabled: v.enabled !== false,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

// Remembers the customer's location, radius and sort choice in their browser only.
export function useNearbySettings() {
  const [initial] = useState(loadStored);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial ? { lat: initial.lat, lng: initial.lng } : null
  );
  const [radiusKm, setRadiusKm] = useState<number>(initial?.radiusKm ?? 5);
  const [sortBy, setSortBy] = useState<NearbySort>(initial?.sortBy ?? 'distance');
  const [enabled, setEnabled] = useState<boolean>(initial?.enabled ?? false);
  const [status, setStatus] = useState<LocateStatus>('idle');

  useEffect(() => {
    if (!coords) return;
    try {
      const data: Stored = { lat: coords.lat, lng: coords.lng, radiusKm, sortBy, enabled };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [coords, radiusKm, sortBy, enabled]);

  // Asks the browser for permission and reads the customer's position
  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setEnabled(true);
        setStatus('idle');
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  return {
    coords,
    radiusKm,
    sortBy,
    enabled,
    status,
    active: enabled && coords !== null,
    requestLocation,
    setRadiusKm,
    setSortBy,
    showAll: () => setEnabled(false),
    showNearby: () => setEnabled(true),
  };
}

export type NearbySettings = ReturnType<typeof useNearbySettings>;

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatTimeLeft(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 0) return 'Collection time ended';
  if (minutes < 60) return `${minutes} min left`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
}

// Opens the spot on OpenStreetMap (people can tap "Directions" there)
export function mapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}
