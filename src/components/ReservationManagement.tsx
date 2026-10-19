import { useRef, useState } from 'react';
import { CheckCircle2, Clock, XCircle, QrCode, Search, ScanLine } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Reservation } from '@/types';
import { Badge } from '@/components/Badge';
import Modal from '@/components/Modal';
import PickupScanner from '@/components/PickupScanner';
import { availabilityText } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'warning' as const, icon: Clock },
  collected: { label: 'Collected', variant: 'green' as const, icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', variant: 'error' as const, icon: XCircle },
  expired: { label: 'Expired', variant: 'neutral' as const, icon: Clock },
};

interface PickupInfo {
  reservation_id: string;
  status: 'pending' | 'collected' | 'cancelled' | 'expired';
  customer_name: string;
  meal_name: string;
  quantity: number;
  total: number;
  available_until: string | null;
  collected_at: string | null;
}

// Pulls the pickup code out of whatever a QR code or a person typed
function extractCode(text: string): string {
  const upper = text.toUpperCase();
  const m = upper.match(/LB-?[A-Z0-9]{6}/);
  if (m) return m[0].includes('-') ? m[0] : `LB-${m[0].slice(2)}`;
  return upper.trim();
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ReservationManagement({
  reservations,
  onRefresh,
}: {
  reservations: Reservation[];
  businessId?: string;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'collected' | 'cancelled'>('all');
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Pickup check
  const [codeInput, setCodeInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [info, setInfo] = useState<PickupInfo | null>(null);
  const [checkedCode, setCheckedCode] = useState('');
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [justCollected, setJustCollected] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = reservations.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    const q = search.toLowerCase().trim();
    if (q && !r.customer_name.toLowerCase().includes(q) && !r.customer_phone.includes(q)) return false;
    return true;
  });

  const handleCancel = async (reservation: Reservation) => {
    setActionError(null);
    // The database also returns the reserved items to the listing's stock
    const { error: rErr } = await supabase.rpc('set_reservation_status', {
      p_reservation_id: reservation.id,
      p_status: 'cancelled',
    });
    if (rErr) {
      setActionError(rErr.message || 'Could not cancel reservation.');
      return;
    }
    onRefresh();
  };

  // Step 1: the server looks the code up (only for this business's reservations)
  const checkCode = async (raw: string) => {
    const code = extractCode(raw);
    setCodeInput(code);
    setInfo(null);
    setJustCollected(false);
    setPickupError(null);
    if (code.length < 6) {
      setPickupError('Please enter the pickup code, for example LB-ABC123.');
      return;
    }
    setChecking(true);
    const { data, error } = await supabase.rpc('lookup_pickup', { p_code: code });
    setChecking(false);
    if (error) {
      setPickupError(error.message || 'Could not check this code. Please try again.');
      return;
    }
    setInfo(data as PickupInfo);
    setCheckedCode(code);
  };

  // Step 2: the server checks again and confirms the pickup, once
  const confirmPickup = async () => {
    if (!info) return;
    setConfirming(true);
    setPickupError(null);
    const { data, error } = await supabase.rpc('confirm_pickup', { p_code: checkedCode });
    setConfirming(false);
    if (error) {
      setPickupError(error.message || 'Could not confirm this pickup.');
      // show the latest state (for example "already collected")
      checkCode(checkedCode);
      return;
    }
    setInfo({ ...info, status: 'collected', collected_at: (data as { collected_at: string }).collected_at });
    setJustCollected(true);
    onRefresh();
  };

  const resetPickup = () => {
    setCodeInput('');
    setInfo(null);
    setPickupError(null);
    setJustCollected(false);
    inputRef.current?.focus();
  };

  const focusPickupPanel = () => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    inputRef.current?.focus();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-ink-900">Reservations</h2>
        {actionError && <p className="text-sm text-error-700">{actionError}</p>}
      </div>

      {/* Confirm a pickup */}
      <div ref={panelRef} className="card p-5 mb-6">
        <h3 className="font-bold text-ink-900 mb-1">Confirm a pickup</h3>
        <p className="text-sm text-ink-600 mb-4">
          Scan the customer's QR code, or type the pickup code they show you.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => setScanning(true)} className="btn-primary sm:w-auto">
            <ScanLine size={18} /> Scan QR code
          </button>
          <div className="flex gap-2 flex-1">
            <input
              ref={inputRef}
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') checkCode(codeInput);
              }}
              placeholder="Or enter code: LB-XXXXXX"
              className="input-field uppercase tracking-wider"
              maxLength={20}
            />
            <button onClick={() => checkCode(codeInput)} disabled={checking} className="btn-secondary flex-shrink-0">
              {checking ? 'Checking…' : 'Check'}
            </button>
          </div>
        </div>

        {pickupError && (
          <div className="mt-4 rounded-xl bg-error-100 border border-error-500/20 p-3">
            <p className="text-sm text-error-700">{pickupError}</p>
          </div>
        )}

        {info && (
          <div className="mt-4 rounded-xl border border-ink-900/10 p-4">
            {justCollected ? (
              <div className="text-center">
                <CheckCircle2 size={34} className="mx-auto text-green-600 mb-1" />
                <p className="font-bold text-green-600">Pickup confirmed</p>
                <p className="text-sm text-ink-600 mt-0.5">
                  {info.customer_name} · {info.meal_name} × {info.quantity}
                </p>
                <button onClick={resetPickup} className="btn-secondary mt-4">Scan next</button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink-900">{info.customer_name}</p>
                    <p className="text-sm text-ink-600">{info.meal_name} × {info.quantity}</p>
                    <p className="text-sm text-ink-500 mt-0.5">
                      Total ₹{Number(info.total).toFixed(2)}
                      {info.available_until ? ` · Available till ${info.available_until}` : ''}
                    </p>
                  </div>
                  <Badge variant={(STATUS_CONFIG[info.status] ?? STATUS_CONFIG.pending).variant}>
                    {(STATUS_CONFIG[info.status] ?? STATUS_CONFIG.pending).label}
                  </Badge>
                </div>

                {info.status === 'pending' && (
                  <div className="flex gap-3 mt-4">
                    <button onClick={resetPickup} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={confirmPickup} disabled={confirming} className="btn-primary flex-1">
                      <CheckCircle2 size={18} /> {confirming ? 'Confirming…' : 'Confirm collection'}
                    </button>
                  </div>
                )}
                {info.status === 'collected' && (
                  <p className="mt-3 text-sm text-warning-700">
                    This pickup was already confirmed{info.collected_at ? ` on ${timeOf(info.collected_at)}` : ''}. It
                    cannot be confirmed again.
                  </p>
                )}
                {info.status === 'cancelled' && (
                  <p className="mt-3 text-sm text-error-700">This reservation was cancelled.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search by customer name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            When customers reserve your items, they'll appear here.
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
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant={cfg.variant}>
                        <Icon size={13} /> {cfg.label}
                      </Badge>
                      <span className="text-xs text-ink-400">
                        {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {r.status === 'collected' && r.collected_at && (
                        <span className="text-xs text-green-600">Collected {timeOf(r.collected_at)}</span>
                      )}
                    </div>
                    <p className="font-semibold text-ink-900">
                      {r.listing?.meal_name ?? 'Unknown meal'}
                    </p>
                    <div className="text-sm text-ink-500 mt-1 space-y-0.5">
                      <p>{r.customer_name} · {r.customer_phone}</p>
                      <p>Qty: {r.quantity} · Pickup: {r.listing ? availabilityText(r.listing) : '—'}</p>
                    </div>
                  </div>

                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={focusPickupPanel} className="btn-secondary text-sm py-2 px-3">
                        <QrCode size={15} /> Verify pickup
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
            );
          })}
        </div>
      )}

      {/* Camera scanner */}
      <Modal open={scanning} onClose={() => setScanning(false)} title="Scan pickup QR code" size="sm">
        {scanning && (
          <PickupScanner
            onDetected={(text) => {
              setScanning(false);
              checkCode(text);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
