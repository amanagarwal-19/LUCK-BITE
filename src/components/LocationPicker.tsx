import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, LocateFixed } from 'lucide-react';

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
  // OpenStreetMap id of the chosen place, like "node/123456" (null if the pin was placed by hand)
  placeId: string | null;
  name?: string;
}

interface SearchResult {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

// A simple forest-green pin drawn with CSS (no image files needed)
const PIN_ICON = L.divIcon({
  className: '',
  html:
    '<div style="width:28px;height:28px;background:#173D2A;border:3px solid #FFF8EC;' +
    'border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${lat}&lon=${lng}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.display_name === 'string' ? data.display_name.slice(0, 200) : null;
  } catch {
    return null;
  }
}

// Search for the restaurant / café (OpenStreetMap), then confirm or drag the pin on the map.
export default function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const addressEditedRef = useRef(false);
  const reverseSeq = useRef(0);
  const movePinRef = useRef<(lat: number, lng: number) => void>(() => {});
  onChangeRef.current = onChange;
  valueRef.current = value;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Creates the pin, or moves it if it already exists
  const ensureMarker = (ll: L.LatLng) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng(ll);
      return;
    }
    const m = L.marker(ll, { draggable: true, icon: PIN_ICON }).addTo(map);
    m.on('dragend', () => {
      const p = m.getLatLng();
      movePinRef.current(p.lat, p.lng);
    });
    markerRef.current = m;
  };

  // Called when the owner taps the map, drags the pin, or uses their current location
  movePinRef.current = (lat, lng) => {
    ensureMarker(L.latLng(lat, lng));
    const cur = valueRef.current;
    onChangeRef.current({ lat, lng, address: cur?.address ?? '', placeId: null });
    if (!addressEditedRef.current) {
      const seq = ++reverseSeq.current;
      reverseGeocode(lat, lng).then((addr) => {
        if (seq !== reverseSeq.current || !addr || addressEditedRef.current) return;
        onChangeRef.current({ lat, lng, address: addr, placeId: null });
      });
    }
  };

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const start = valueRef.current;
    const map = L.map(mapDivRef.current, {
      center: start ? [start.lat, start.lng] : INDIA_CENTER,
      zoom: start ? 17 : 4,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    if (start) ensureMarker(L.latLng(start.lat, start.lng));
    map.on('click', (e: L.LeafletMouseEvent) => movePinRef.current(e.latlng.lat, e.latlng.lng));

    // The map may be inside a window that is still opening, so recalculate its size
    const t = window.setTimeout(() => map.invalidateSize(), 250);

    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setMessage('Type at least 3 characters to search.');
      return;
    }
    setSearching(true);
    setMessage(null);
    setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=in&accept-language=en&q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error('search failed');
      const data = (await res.json()) as SearchResult[];
      setResults(data);
      if (data.length === 0) {
        setMessage('No match found. Try the road or area name, or tap the map to drop the pin on your shop.');
      }
    } catch {
      setMessage('Search is busy right now. Please try again in a moment, or tap the map to place the pin.');
    } finally {
      setSearching(false);
    }
  };

  const chooseResult = (r: SearchResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    addressEditedRef.current = false;
    ensureMarker(L.latLng(lat, lng));
    mapRef.current?.setView([lat, lng], 17);
    onChangeRef.current({
      lat,
      lng,
      address: r.display_name.slice(0, 200),
      placeId: r.osm_type && r.osm_id ? `${r.osm_type}/${r.osm_id}` : null,
      name: r.name || undefined,
    });
    setResults([]);
    setMessage(null);
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setMessage("Your browser can't share its location. Tap the map instead.");
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 18);
        movePinRef.current(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setMessage('Could not get your location. Allow location access, or tap the map instead.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter should search, not submit the whole registration form
            if (e.key === 'Enter') {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder="Search your restaurant, café or area"
          className="input-field"
        />
        <button type="button" onClick={runSearch} disabled={searching} className="btn-secondary flex-shrink-0">
          <Search size={16} /> {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {message && <p className="text-sm text-ink-600">{message}</p>}

      {results.length > 0 && (
        <ul className="rounded-xl border border-ink-900/10 bg-cream-50 divide-y divide-ink-900/5 max-h-56 overflow-y-auto">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => chooseResult(r)}
                className="w-full text-left px-3 py-2.5 text-sm text-ink-800 hover:bg-orange-50"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        ref={mapDivRef}
        className="relative z-0 w-full h-64 sm:h-72 rounded-xl border border-ink-900/10 bg-cream-200 overflow-hidden"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={useMyLocation} disabled={locating} className="btn-secondary">
          <LocateFixed size={16} /> {locating ? 'Finding you…' : 'Use my current location'}
        </button>
        <span className="text-xs text-ink-500">Tap the map or drag the pin to the exact spot.</span>
      </div>

      {value ? (
        <div>
          <label className="label-field">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={16} className="text-orange-500" /> Address (edit if needed)
            </span>
          </label>
          <input
            type="text"
            value={value.address}
            onChange={(e) => {
              addressEditedRef.current = true;
              onChange({ ...value, address: e.target.value.slice(0, 200) });
            }}
            placeholder="Shop name, road, area, city"
            className="input-field"
          />
        </div>
      ) : (
        <p className="text-xs text-ink-500">
          Small shops are sometimes missing from OpenStreetMap. If you can't find yours, tap the map to drop the pin on
          it, or use your current location if you're at the shop.
        </p>
      )}
    </div>
  );
}
