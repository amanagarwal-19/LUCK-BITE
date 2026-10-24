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
      <div className="card p-4 sm:p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center text-cream-100 shadow-warm flex-shrink-0">
              <Navigation size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-ink-900">Find meals near you</h2>
              <p className="text-sm text-ink-600 mt-0.5">
                Share your location and we'll show meals from nearby businesses. It's only used to find nearby food and
                is saved in your browser, not on your profile.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-shrink-0">
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
        {message && <p className="text-sm text-error-700 mt-3">{message}</p>}
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
            <Navigation size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-ink-900 leading-tight">Showing meals near you</h2>
            <p className="text-xs text-ink-500 mt-0.5">Within {nearby.radiusKm} km of your location</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={nearby.requestLocation}
            disabled={nearby.status === 'locating'}
            className="btn-secondary !px-3.5 !py-2 text-sm"
          >
            <LocateFixed size={16} /> {nearby.status === 'locating' ? 'Updating…' : 'Update my location'}
          </button>
          <button onClick={nearby.showAll} className="btn-ghost text-sm text-orange-600">
            Show all listings
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-ink-900/5 flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
        <div>
          <span id="nearby-radius-label" className="label-field">Search radius</span>
          <div
            role="radiogroup"
            aria-labelledby="nearby-radius-label"
            className="inline-flex rounded-xl bg-cream-200/70 p-1 gap-1"
          >
            {RADIUS_OPTIONS.map((r) => {
              const selected = nearby.radiusKm === r;
              return (
                <button
                  key={r}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => nearby.setRadiusKm(r)}
                  className={`min-h-[40px] min-w-[56px] px-3.5 rounded-lg text-sm font-semibold transition-all ${
                    selected
                      ? 'bg-orange-500 text-cream-100 shadow-sm'
                      : 'text-ink-600 hover:bg-cream-50 hover:text-ink-900'
                  }`}
                >
                  {r} km
                </button>
              );
            })}
          </div>
        </div>
        <div className="sm:w-64">
          <label htmlFor="nearby-sort" className="label-field">Sort by</label>
          <select
            id="nearby-sort"
            value={nearby.sortBy}
            onChange={(e) => nearby.setSortBy(e.target.value === 'time' ? 'time' : 'distance')}
            className="input-field !py-2.5"
          >
            <option value="distance">Nearest first</option>
            <option value="time">Collection ending soonest</option>
          </select>
        </div>
      </div>

      {message && <p className="text-sm text-error-700 mt-3">{message}</p>}
    </div>
  );
}
