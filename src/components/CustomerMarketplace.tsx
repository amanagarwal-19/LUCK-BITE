import { useMemo, useState, useCallback } from 'react';
import { MapPin, Clock, Tag, Search, SlidersHorizontal, Package, ArrowLeft, CheckCircle2, ShoppingBag, Store, ClipboardList } from 'lucide-react';
import { useListings, generatePickupCode } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { getSessionId } from '@/lib/session';
import type { Listing } from '@/types';
import { MEAL_CATEGORIES } from '@/types';
import { Badge } from '@/components/Badge';
import Modal from '@/components/Modal';
import Logo from '@/components/Logo';
import MyReservations from '@/components/MyReservations';
import { availabilityText } from '@/lib/utils';

type CustomerTab = 'marketplace' | 'reservations';

export default function CustomerMarketplace({ onBack }: { onBack: () => void }) {
  const { listings, loading, error, refetch: refetchListings } = useListings();
  const [tab, setTab] = useState<CustomerTab>('marketplace');
  const [category, setCategory] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [reservationCount, setReservationCount] = useState(0);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (category !== 'all' && l.category !== category) return false;
      if (maxPrice && l.discounted_price > parseFloat(maxPrice)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.meal_name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          (l.business?.name.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [listings, category, maxPrice, search]);

  const refreshListings = useCallback(() => {
    refetchListings();
  }, [refetchListings]);

  const handleReservationComplete = () => {
    setReservationCount((c) => c + 1);
    refreshListings();
  };

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-ink-900/5">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-4">
          <button onClick={onBack} className="btn-ghost -ml-2">
            <ArrowLeft size={18} /> <span className="hidden sm:inline">Home</span>
          </button>
          <Logo size="sm" />
          <span className="ml-auto badge bg-orange-100 text-orange-700">Customer</span>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex gap-1 border-t border-ink-900/5">
          <TabButton active={tab === 'marketplace'} onClick={() => setTab('marketplace')} icon={<Package size={16} />}>
            Marketplace
          </TabButton>
          <TabButton active={tab === 'reservations'} onClick={() => setTab('reservations')} icon={<ClipboardList size={16} />}>
            My Reservations
            {reservationCount > 0 && (
              <span className="ml-1.5 badge bg-orange-500 text-white px-1.5 py-0.5 text-[10px]">{reservationCount}</span>
            )}
          </TabButton>
        </div>
      </header>

      {/* Search + Filters */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-6 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-1">Marketplace</h1>
        <p className="text-ink-600 text-sm mb-5">
          Browse surplus meal boxes from local businesses and reserve yours for pickup.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search meals, businesses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="btn-secondary sm:w-auto"
          >
            <SlidersHorizontal size={18} /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 card p-5 animate-fade-in">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label-field">Meal Category</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCategory('all')}
                    className={`badge transition-all ${category === 'all' ? 'bg-orange-500 text-white' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'}`}
                  >
                    All
                  </button>
                  {MEAL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`badge transition-all ${category === cat ? 'bg-orange-500 text-white' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label-field">Maximum Discounted Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="No limit"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
            {(category !== 'all' || maxPrice) && (
              <button
                onClick={() => { setCategory('all'); setMaxPrice(''); }}
                className="btn-ghost mt-3 text-orange-600"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Listings grid */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-20">
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-ink-500 mt-3 text-sm">Loading meal boxes…</p>
          </div>
        )}

        {error && (
          <div className="card p-6 text-center">
            <p className="text-error-700 font-medium">Couldn't load listings.</p>
            <p className="text-ink-500 text-sm mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto text-ink-400 mb-3" />
            <p className="text-ink-600 font-medium">No meal boxes match your filters.</p>
            <p className="text-ink-400 text-sm mt-1">Try adjusting your search or clearing filters.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onClick={() => setSelectedListing(listing)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail + Reservation modal */}
      <ListingDetailModal
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onReserved={handleReservationComplete}
      />
      {tab === 'reservations' && (
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
          <MyReservations />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode; }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition-colors -mb-px ${
        active
          ? 'border-orange-500 text-orange-600'
          : 'border-transparent text-ink-500 hover:text-ink-900'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ListingCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const discount = listing.original_price > 0
    ? Math.round((1 - listing.discounted_price / listing.original_price) * 100)
    : 0;
  const soldOut = listing.quantity_available <= 0;

  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:shadow-card-hover hover:border-orange-200 transition-all group"
    >
            {listing.photo_url && (
        <img
          src={listing.photo_url}
          alt={listing.meal_name}
          loading="lazy"
          className="w-full h-40 object-cover rounded-xl mb-4"
        />
      )}
      <div className="flex items-start justify-between gap-3 mb-3">
        <Badge variant="orange">{listing.category}</Badge>
        {soldOut ? (
          <Badge variant="error">Sold out</Badge>
        ) : discount > 0 ? (
          <Badge variant="green">-{discount}%</Badge>
        ) : null}
      </div>

      <h3 className="font-bold text-lg text-ink-900 mb-1 group-hover:text-orange-600 transition-colors">
        {listing.meal_name}
      </h3>
      <p className="text-sm text-ink-600 leading-relaxed mb-3 line-clamp-2">
        {listing.description}
      </p>

      <div className="space-y-1.5 text-sm text-ink-500 mb-4">
        <div className="flex items-center gap-2">
          <Store size={15} className="text-ink-400 flex-shrink-0" />
          <span>{listing.business?.name ?? 'Business'}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-ink-400 flex-shrink-0" />
          <span className="truncate">{listing.business?.location ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-ink-400 flex-shrink-0" />
                    <span>{availabilityText(listing)}</span>
        </div>
      </div>

      <div className="flex items-end justify-between pt-3 border-t border-ink-900/5">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-500">
              ₹{listing.discounted_price.toFixed(2)}
            </span>
            <span className="text-sm text-ink-400 line-through">
              ₹{listing.original_price.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-ink-500 mt-0.5">
            {soldOut ? 'Unavailable' : `${listing.quantity_available} box${listing.quantity_available !== 1 ? 'es' : ''} left`}
          </p>
        </div>
        <span className="text-orange-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
          View →
        </span>
      </div>
    </button>
  );
}

function ListingDetailModal({
  listing,
  onClose,
  onReserved,
}: {
  listing: Listing | null;
  onClose: () => void;
  onReserved: () => void;
}) {
  const [step, setStep] = useState<'detail' | 'form' | 'confirm'>('detail');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<{ id: string; code: string } | null>(null);

  const reset = () => {
    setStep('detail');
    setName('');
    setPhone('');
    setQuantity(1);
    setSubmitError(null);
    setReservation(null);
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const handleReserve = async () => {
    if (!listing) return;
    if (!name.trim() || !phone.trim()) {
      setSubmitError('Please enter your name and phone number.');
      return;
    }
    if (quantity < 1 || quantity > listing.quantity_available) {
      setSubmitError(`Quantity must be between 1 and ${listing.quantity_available}.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const code = generatePickupCode();

    const { data, error } = await supabase
      .from('reservations')
      .insert({
        listing_id: listing.id,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        quantity,
        pickup_code: code,
        status: 'pending',
        session_id: getSessionId(),
      })
      .select('id, pickup_code')
      .single();

    if (error) {
      setSubmitError('Something went wrong creating your reservation. Please try again.');
      setSubmitting(false);
      return;
    }

    // Decrement available quantity
    const newQty = Math.max(0, listing.quantity_available - quantity);
    await supabase
      .from('listings')
      .update({ quantity_available: newQty })
      .eq('id', listing.id);

    setReservation({ id: data.id, code: data.pickup_code });
    setStep('confirm');
    setSubmitting(false);
    onReserved();
  };

  if (!listing) return null;

  const discount = listing.original_price > 0
    ? Math.round((1 - listing.discounted_price / listing.original_price) * 100)
    : 0;
  const soldOut = listing.quantity_available <= 0;
  const total = (listing.discounted_price * quantity).toFixed(2);

  return (
    <Modal open={!!listing} onClose={handleClose} size="md">
      {step === 'detail' && (
        <div>
                    {listing.photo_url && (
            <img
              src={listing.photo_url}
              alt={listing.meal_name}
              className="w-full h-52 object-cover rounded-xl mb-4"
            />
          )}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="orange">{listing.category}</Badge>
              {discount > 0 && <Badge variant="green">-{discount}% off</Badge>}
              <Badge variant="neutral">{listing.quantity_available} available</Badge>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-ink-900 mb-2">{listing.meal_name}</h2>
          <p className="text-ink-700 font-medium text-sm mb-3">
            by {listing.business?.name ?? 'Business'}
          </p>

          <p className="text-ink-600 leading-relaxed mb-5">{listing.description}</p>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <InfoRow icon={<MapPin size={16} />} label="Location" value={listing.business?.location ?? '—'} />
                        <InfoRow icon={<Clock size={16} />} label="Pickup" value={availabilityText(listing)} />
            <InfoRow icon={<Store size={16} />} label="Business type" value={listing.business?.business_type ?? '—'} />
            <InfoRow icon={<Package size={16} />} label="Available" value={`${listing.quantity_available} box(es)`} />
          </div>

          {listing.allergen_info && (
            <div className="rounded-xl bg-warning-100/60 border border-warning-500/20 p-4 mb-5">
              <p className="text-sm font-semibold text-warning-700 mb-1">Allergen & Storage Info</p>
              <p className="text-sm text-ink-600 leading-relaxed">{listing.allergen_info}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-ink-900/5 mb-5">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-orange-500">
                  ₹{listing.discounted_price.toFixed(2)}
                </span>
                <span className="text-base text-ink-400 line-through">
                  ₹{listing.original_price.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">per box</p>
            </div>
          </div>

          <button
            onClick={() => { setStep('form'); setSubmitError(null); }}
            disabled={soldOut}
            className="btn-primary w-full"
          >
            <ShoppingBag size={20} />
            {soldOut ? 'Sold Out' : 'Reserve This Box'}
          </button>
          <p className="text-center text-xs text-ink-400 mt-3">
            Demo only — no real payment or phone verification will occur.
          </p>
        </div>
      )}

      {step === 'form' && (
        <div>
          <button onClick={() => setStep('detail')} className="btn-ghost -ml-2 mb-4">
            <ArrowLeft size={16} /> Back to details
          </button>

          <h2 className="text-xl font-bold text-ink-900 mb-1">Reserve your box</h2>
          <p className="text-sm text-ink-600 mb-5">
            {listing.meal_name} — ₹{listing.discounted_price.toFixed(2)} per box
          </p>

          <div className="space-y-4">
            <div>
              <label className="label-field">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07700 900000"
                className="input-field"
              />
              <p className="text-xs text-ink-400 mt-1">
                For demo purposes only — no SMS will be sent.
              </p>
            </div>
            <div>
              <label className="label-field">Quantity (max {listing.quantity_available})</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl border border-ink-900/10 bg-white font-bold text-ink-700 hover:bg-cream-200 transition-colors"
                >
                  −
                </button>
                <span className="text-xl font-bold text-ink-900 w-8 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(listing.quantity_available, q + 1))}
                  className="w-10 h-10 rounded-xl border border-ink-900/10 bg-white font-bold text-ink-700 hover:bg-cream-200 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {submitError && (
            <div className="mt-4 rounded-xl bg-error-100 border border-error-500/20 p-3">
              <p className="text-sm text-error-700">{submitError}</p>
            </div>
          )}

          <div className="mt-6 rounded-xl bg-cream-200/60 p-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-ink-600">{quantity} × ₹{listing.discounted_price.toFixed(2)}</span>
              <span className="font-semibold text-ink-900">₹{total}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-400">Original: {quantity} × ₹{listing.original_price.toFixed(2)}</span>
              <span className="text-green-600 font-medium">You save ₹{((listing.original_price - listing.discounted_price) * quantity).toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleReserve}
            disabled={submitting}
            className="btn-primary w-full mt-5"
          >
            {submitting ? 'Reserving…' : 'Confirm Reservation'}
          </button>
        </div>
      )}

      {step === 'confirm' && reservation && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-scale-in">
            <CheckCircle2 size={36} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-ink-900 mb-1">Reservation Confirmed!</h2>
          <p className="text-sm text-ink-600 mb-6">
            Your box has been reserved. Show your pickup code at collection.
          </p>

          <div className="rounded-2xl bg-cream-200/60 border border-orange-200 p-5 mb-5">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1">Pickup Code</p>
            <p className="text-3xl font-bold text-orange-600 font-display tracking-wider mb-4">{reservation.code}</p>

            <div className="text-left space-y-2 text-sm border-t border-ink-900/10 pt-4">
              <ConfirmRow label="Reference" value={reservation.id.slice(0, 8).toUpperCase()} />
              <ConfirmRow label="Meal" value={listing.meal_name} />
              <ConfirmRow label="Business" value={listing.business?.name ?? '—'} />
              <ConfirmRow label="Quantity" value={`${quantity} box(es)`} />
              <ConfirmRow label="Total" value={`₹${total}`} />
                            <ConfirmRow label="Pickup" value={availabilityText(listing)} />
              <ConfirmRow label="Location" value={listing.business?.location ?? '—'} />
            </div>
          </div>

          <div className="rounded-xl bg-warning-100/60 border border-warning-500/20 p-3 mb-5">
            <p className="text-xs text-warning-700 leading-relaxed">
              This is a demonstration reservation. No payment has been processed and no SMS
              verification has been sent. The pickup code is for demo purposes only.
            </p>
          </div>

          <button onClick={handleClose} className="btn-primary w-full">
            Done — Back to Marketplace
          </button>
        </div>
      )}
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-ink-400">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-sm text-ink-700">{value}</span>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold text-ink-900 text-right">{value}</span>
    </div>
  );
}
