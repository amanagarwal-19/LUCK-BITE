import { useState } from 'react';
import { CheckCircle2, Clock, XCircle, QrCode, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Reservation } from '@/types';
import { Badge } from '@/components/Badge';
import Modal from '@/components/Modal';

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'warning' as const, icon: Clock },
  collected: { label: 'Collected', variant: 'green' as const, icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', variant: 'error' as const, icon: XCircle },
  expired: { label: 'Expired', variant: 'neutral' as const, icon: Clock },
};

export default function ReservationManagement({
  reservations,
  businessId,
  onRefresh,
}: {
  reservations: Reservation[];
  businessId: string;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'collected' | 'cancelled'>('all');
  const [codeSearch, setCodeSearch] = useState('');
  const [verifying, setVerifying] = useState<Reservation | null>(null);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<'idle' | 'match' | 'nomatch'>('idle');
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = reservations.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (codeSearch && !r.pickup_code.toLowerCase().includes(codeSearch.toLowerCase().trim())) return false;
    return true;
  });

  const handleMarkCollected = async (reservation: Reservation) => {
    setActionError(null);
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'collected' })
      .eq('id', reservation.id);
    if (error) {
      setActionError('Could not update reservation status.');
      return;
    }
    onRefresh();
  };

  const handleCancel = async (reservation: Reservation) => {
    setActionError(null);
    const { error: rErr } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservation.id);
    if (rErr) {
      setActionError('Could not cancel reservation.');
      return;
    }
    // Release the reserved quantity back to the listing
    if (reservation.listing) {
      const restored = reservation.listing.quantity_available + reservation.quantity;
      await supabase
        .from('listings')
        .update({ quantity_available: restored })
        .eq('id', reservation.listing_id);
    }
    onRefresh();
  };

  const openVerify = (r: Reservation) => {
    setVerifying(r);
    setVerifyInput('');
    setVerifyResult('idle');
  };

  const handleVerify = () => {
    if (!verifying) return;
    if (verifyInput.trim().toUpperCase() === verifying.pickup_code.toUpperCase()) {
      setVerifyResult('match');
    } else {
      setVerifyResult('nomatch');
    }
  };

  const handleVerifyAndCollect = async () => {
    if (!verifying) return;
    await handleMarkCollected(verifying);
    setVerifying(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-ink-900">Reservations</h2>
        {actionError && <p className="text-sm text-error-700">{actionError}</p>}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search by pickup code…"
            value={codeSearch}
            onChange={(e) => setCodeSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'collected', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`badge capitalize transition-all ${filter === f ? 'bg-orange-500 text-white' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <Clock size={32} className="mx-auto text-ink-400 mb-2" />
          <p className="text-ink-600 font-medium">No reservations yet.</p>
          <p className="text-ink-400 text-sm mt-1">
            When customers reserve your boxes, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div key={r.id} className="card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant={cfg.variant}>
                        <Icon size={13} /> {cfg.label}
                      </Badge>
                      <span className="text-xs text-ink-400">
                        {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-semibold text-ink-900">
                      {r.listing?.meal_name ?? 'Unknown meal'}
                    </p>
                    <div className="text-sm text-ink-500 mt-1 space-y-0.5">
                      <p>{r.customer_name} · {r.customer_phone}</p>
                      <p>Qty: {r.quantity} · Collection: {r.listing?.collection_window ?? '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                    <div className="rounded-lg bg-cream-200/60 px-3 py-1.5">
                      <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide">Code</p>
                      <p className="font-bold text-ink-900 font-display tracking-wider">{r.pickup_code}</p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openVerify(r)}
                          className="btn-secondary text-sm py-2 px-3"
                        >
                          <QrCode size={15} /> Verify
                        </button>
                        <button
                          onClick={() => handleCancel(r)}
                          className="btn-ghost text-sm text-error-700 hover:bg-error-100"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verify modal */}
      <Modal
        open={!!verifying}
        onClose={() => setVerifying(null)}
        title="Verify Pickup Code"
        size="sm"
      >
        {verifying && (
          <div>
            <div className="rounded-xl bg-cream-200/60 p-4 mb-5 text-center">
              <p className="text-xs text-ink-500 font-semibold uppercase tracking-wide mb-1">Customer</p>
              <p className="font-bold text-ink-900">{verifying.customer_name}</p>
              <p className="text-sm text-ink-600">{verifying.listing?.meal_name} × {verifying.quantity}</p>
            </div>

            <label className="label-field">Enter the pickup code shown by the customer</label>
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => { setVerifyInput(e.target.value); setVerifyResult('idle'); }}
              placeholder="LB-XXXXXX"
              className="input-field text-center font-display tracking-widest text-lg uppercase"
              autoFocus
            />

            {verifyResult === 'match' && (
              <div className="mt-4 rounded-xl bg-green-100 border border-green-400/30 p-4 text-center animate-scale-in">
                <CheckCircle2 size={28} className="mx-auto text-green-600 mb-1" />
                <p className="font-semibold text-green-600">Code matches!</p>
                <p className="text-sm text-ink-600 mt-0.5">Mark this reservation as collected?</p>
              </div>
            )}
            {verifyResult === 'nomatch' && (
              <div className="mt-4 rounded-xl bg-error-100 border border-error-500/20 p-4 text-center animate-scale-in">
                <XCircle size={28} className="mx-auto text-error-500 mb-1" />
                <p className="font-semibold text-error-700">Code does not match</p>
                <p className="text-sm text-ink-600 mt-0.5">Please ask the customer to check their confirmation.</p>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setVerifying(null)} className="btn-secondary flex-1">Close</button>
              {verifyResult === 'match' ? (
                <button onClick={handleVerifyAndCollect} className="btn-primary flex-1">
                  <CheckCircle2 size={18} /> Mark Collected
                </button>
              ) : (
                <button onClick={handleVerify} className="btn-primary flex-1">
                  Verify Code
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
