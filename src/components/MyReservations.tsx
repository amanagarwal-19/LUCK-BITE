import { useState } from 'react';
import { useCustomerReservations } from '@/hooks/useData';
import Modal from '@/components/Modal';
import PickupQr from '@/components/PickupQr';
import type { Reservation } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/Badge';
import { Package, Clock, CheckCircle2, XCircle, Store, Calendar, QrCode, Hash, RefreshCw, IndianRupee } from 'lucide-react';
import { availabilityText } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'warning' as const, icon: Clock },
  collected: { label: 'Collected', variant: 'green' as const, icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', variant: 'error' as const, icon: XCircle },
  expired: { label: 'Expired', variant: 'neutral' as const, icon: Clock },
};

// One labelled detail (icon, small label, value) so every reservation card lines up the same way
function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="mt-0.5 text-ink-400 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 leading-tight">{label}</p>
        <p className="text-sm font-medium text-ink-800 break-words">{children}</p>
      </div>
    </div>
  );
}

export default function MyReservations({ onSignInClick }: { onSignInClick?: () => void }) {
  const { user, loading: authLoading } = useAuth();
  // Reservations belong to the signed-in account
  const { reservations, loading, refetch } = useCustomerReservations(null, user?.id ?? null);
  const [qrFor, setQrFor] = useState<Reservation | null>(null);

  if (!authLoading && !user) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto">
        <Package size={36} className="mx-auto text-ink-400 mb-3" />
        <h2 className="text-xl font-bold text-ink-900 mb-2">Sign in to see your reservations</h2>
        <p className="text-ink-600 text-sm mb-5">
          Your reserved meals and pickup codes are saved to your customer account.
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
        Your reserved meals and their pickup codes.
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
            Browse Discover Food and reserve a meal to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r) => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const unitPrice = r.unit_price ?? r.listing?.discounted_price;
            const total = unitPrice != null ? (unitPrice * r.quantity).toFixed(2) : '—';
            // The pickup deadline only matters while the reservation is still waiting to be collected
            const isPending = r.status === 'pending';

            return (
              <div key={r.id} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
                    <Badge variant={cfg.variant}>
                      <Icon size={13} /> {cfg.label}
                    </Badge>
                    <span className="text-xs text-ink-400 flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {isPending && r.pickup_code && (
                    <div className="rounded-lg bg-cream-200/60 px-3 py-1.5 text-center flex-shrink-0">
                      <p className="text-[10px] text-ink-400 font-semibold uppercase tracking-wide">Pickup code</p>
                      <p className="font-bold text-ink-900 font-display tracking-wider">{r.pickup_code}</p>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-lg text-ink-900 mt-3 break-words">
                  {r.listing?.meal_name ?? 'Unknown meal'}
                </h3>
                <p className="text-sm text-ink-500 mt-0.5 flex items-center gap-1.5 min-w-0">
                  <Store size={14} className="text-ink-400 flex-shrink-0" />
                  <span className="truncate">{r.listing?.business?.name ?? '—'}</span>
                </p>

                <div className="mt-4 pt-4 border-t border-ink-900/5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <Detail icon={<Package size={15} />} label="Quantity">
                    {r.quantity} item{r.quantity !== 1 ? 's' : ''}
                  </Detail>
                  <Detail icon={<IndianRupee size={15} />} label="Total">
                    ₹{total}
                  </Detail>
                  <Detail icon={<Hash size={15} />} label="Reference">
                    {r.id.slice(0, 8).toUpperCase()}
                  </Detail>
                  {isPending && (
                    <Detail icon={<Clock size={15} />} label="Pickup">
                      {r.listing ? availabilityText(r.listing) : '—'}
                    </Detail>
                  )}
                </div>

                {r.status === 'cancelled' && (
                  <div className="mt-4 rounded-xl bg-error-100/60 border border-error-500/20 p-3">
                    <p className="text-xs text-error-700">
                      This reservation was cancelled. The reserved quantity has been returned to the listing.
                    </p>
                  </div>
                )}
                {isPending && r.pickup_code && (
                  <button onClick={() => setQrFor(r)} className="btn-secondary mt-4 w-full sm:w-auto">
                    <QrCode size={16} /> Show QR code for pickup
                  </button>
                )}
                {r.status === 'collected' && (
                  <div className="mt-4 rounded-xl bg-green-50 border border-green-400/30 p-3.5 flex items-start gap-3">
                    <CheckCircle2 size={22} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-green-600">Pickup confirmed</p>
                      <p className="text-xs text-ink-600 mt-0.5">
                        {r.collected_at
                          ? `${new Date(r.collected_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · `
                          : ''}
                        Thank you for helping reduce food waste!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={refetch} className="btn-ghost text-sm mx-auto flex">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}

      <Modal open={!!qrFor} onClose={() => setQrFor(null)} title="Show this at pickup" size="sm">
        {qrFor && qrFor.pickup_code && (
          <div className="text-center">
            <PickupQr code={qrFor.pickup_code} size={220} />
            <p className="text-3xl font-bold text-orange-600 font-display tracking-wider mt-4">{qrFor.pickup_code}</p>
            <p className="text-sm text-ink-700 mt-1">
              {qrFor.listing?.meal_name} × {qrFor.quantity}
            </p>
            <p className="text-xs text-ink-500 mt-3">
              The business will scan this QR code, or you can read out the code. It can only be used once.
            </p>
            <button onClick={() => setQrFor(null)} className="btn-secondary w-full mt-5">Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
