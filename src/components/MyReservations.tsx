import { useCustomerReservations } from '@/hooks/useData';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/Badge';
import { Package, Clock, CheckCircle2, XCircle, MapPin, Store, Calendar } from 'lucide-react';
import { availabilityText } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'warning' as const, icon: Clock },
  collected: { label: 'Collected', variant: 'green' as const, icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', variant: 'error' as const, icon: XCircle },
  expired: { label: 'Expired', variant: 'neutral' as const, icon: Clock },
};

export default function MyReservations({ onSignInClick }: { onSignInClick?: () => void }) {
  const { user, loading: authLoading } = useAuth();
  // Reservations belong to the signed-in account
  const { reservations, loading, refetch } = useCustomerReservations(null, user?.id ?? null);

  if (!authLoading && !user) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto">
        <Package size={36} className="mx-auto text-ink-400 mb-3" />
        <h2 className="text-xl font-bold text-ink-900 mb-2">Sign in to see your reservations</h2>
        <p className="text-ink-600 text-sm mb-5">
          Your reserved meal boxes and pickup codes are saved to your customer account.
        </p>
        {onSignInClick && (
          <button onClick={onSignInClick} className="btn-primary">Sign in as Customer</button>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-1">My Reservations</h1>
      <p className="text-ink-600 text-sm mb-5">
        Your reserved meal boxes and their pickup codes.
      </p>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="card p-8 text-center">
          <Package size={36} className="mx-auto text-ink-400 mb-3" />
          <p className="text-ink-600 font-medium">No reservations yet.</p>
          <p className="text-ink-400 text-sm mt-1">
            Browse Discover Food and reserve a meal box to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r) => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const total = r.listing ? (r.listing.discounted_price * r.quantity).toFixed(2) : '—';

            return (
              <div key={r.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={cfg.variant}>
                      <Icon size={13} /> {cfg.label}
                    </Badge>
                    <span className="text-xs text-ink-400 flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="rounded-lg bg-cream-200/60 px-3 py-1.5 text-center">
                    <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide">Pickup Code</p>
                    <p className="font-bold text-ink-900 font-display tracking-wider">{r.pickup_code}</p>
                  </div>
                </div>

                <h3 className="font-bold text-lg text-ink-900 mb-2">
                  {r.listing?.meal_name ?? 'Unknown meal'}
                </h3>

                <div className="grid sm:grid-cols-2 gap-2 text-sm text-ink-500">
                  <div className="flex items-center gap-2">
                    <Store size={15} className="text-ink-400" />
                    {r.listing?.business?.name ?? '—'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-ink-400" />
                  {r.listing ? availabilityText(r.listing) : '—'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Package size={15} className="text-ink-400" />
                    {r.quantity} box(es) · ₹{total}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-ink-400" />
                    Ref: {r.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>

                {r.status === 'cancelled' && (
                  <div className="mt-3 rounded-xl bg-error-100/60 border border-error-500/20 p-3">
                    <p className="text-xs text-error-700">
                      This reservation was cancelled. The reserved quantity has been returned to the listing.
                    </p>
                  </div>
                )}
                {r.status === 'collected' && (
                  <div className="mt-3 rounded-xl bg-green-100/60 border border-green-400/20 p-3">
                    <p className="text-xs text-green-600">
                      Collected — thank you for helping reduce food waste!
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={refetch} className="btn-ghost text-sm mx-auto block">
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
