import { LocateFixed, Navigation } from 'lucide-react';
import { RADIUS_OPTIONS } from '@/lib/nearby';
import type { NearbySettings } from '@/lib/nearby';

export default function NearbyPanel({ nearby }: { nearby: NearbySettings }) {
  const message =
    nearby.status === 'denied'
      ? 'Location permission was blocked. Allow location for this site in your browser settings, then try again. You can still browse all listings below.'
      : nearby.status === 'unavailable'
      ? "We couldn't find your location. Please try again."
      : nearby.status === 'unsupported'
      ? "Your browser doesn't support location sharing."
      : null;

  if (!nearby.active) {
    return (
      <div className="card p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-warm flex-shrink-0">
          <Navigation size={22} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-ink-900">Find meals near you</h2>
          <p className="text-sm text-ink-600">
            Share your location and we'll show meals from nearby businesses. It's only used to find nearby food and is
            saved in your browser, not on your profile.
          </p>
          {message && <p className="text-sm text-error-700 mt-2">{message}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            onClick={nearby.requestLocation}
            disabled={nearby.status === 'locating'}
            className="btn-primary"
          >
            <LocateFixed size={18} /> {nearby.status === 'locating' ? 'Finding you…' : 'Use my location'}
          </button>
          {nearby.coords && (
            <button onClick={nearby.showNearby} className="btn-ghost text-orange-600">
              Show nearby again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Navigation size={18} className="text-orange-500" />
        <h2 className="font-bold text-ink-900">Showing meals near you</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label-field">Search radius</label>
          <div className="flex gap-2 flex-wrap">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => nearby.setRadiusKm(r)}
                className={`badge transition-all ${
                  nearby.radiusKm === r ? 'bg-orange-500 text-white' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label-field">Sort by</label>
          <select
            value={nearby.sortBy}
            onChange={(e) => nearby.setSortBy(e.target.value === 'time' ? 'time' : 'distance')}
            className="input-field"
          >
            <option value="distance">Nearest first</option>
            <option value="time">Collection ending soonest</option>
          </select>
        </div>
      </div>

      {message && <p className="text-sm text-error-700 mt-3">{message}</p>}

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={nearby.requestLocation}
          disabled={nearby.status === 'locating'}
          className="btn-secondary"
        >
          <LocateFixed size={16} /> {nearby.status === 'locating' ? 'Updating…' : 'Update my location'}
        </button>
        <button onClick={nearby.showAll} className="btn-ghost text-orange-600">
          Show all listings
        </button>
      </div>
    </div>
  );
}
