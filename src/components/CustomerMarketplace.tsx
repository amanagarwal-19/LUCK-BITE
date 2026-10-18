import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { MapPin, Clock, Tag, Search, SlidersHorizontal, Package, ArrowLeft, CheckCircle2, ShoppingBag, Store, ClipboardList, User as UserIcon, LogOut, Navigation, Menu, Heart, HelpCircle, Info, ShieldCheck, FileText } from 'lucide-react';
import { useListings, useNearbyListings } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { getSessionId } from '@/lib/session';
import type { Listing } from '@/types';
import { MEAL_CATEGORIES } from '@/types';
import { Badge } from '@/components/Badge';
import Modal from '@/components/Modal';
import Logo from '@/components/Logo';
import MyReservations from '@/components/MyReservations';
import AuthModal from '@/components/AuthModal';
import AccountPage from '@/components/AccountPage';
import { useAuth } from '@/lib/AuthContext';
import { availabilityText } from '@/lib/utils';
import NearbyPanel from '@/components/NearbyPanel';
import { useNearbySettings, formatDistance, formatTimeLeft, mapUrl } from '@/lib/nearby';
import { useFavourites } from '@/hooks/useFavourites';
import { HelpSupportPage, AboutPage, FoodSafetyPage, TermsPrivacyPage } from '@/components/InfoPages';
import { cleanPhoneInput, isValidMobile, PHONE_ERROR } from '@/lib/validation';

type CustomerTab = 'marketplace' | 'reservations' | 'account' | 'favourites' | 'help' | 'about' | 'safety' | 'terms';

export default function CustomerMarketplace({ onBack }: { onBack: () => void }) {
  const nearby = useNearbySettings();
  const allListings = useListings();
  const nearbyListings = useNearbyListings(nearby.active ? nearby.coords : null, nearby.radiusKm, nearby.sortBy);
  const { listings, loading, error, refetch: refetchListings } = nearby.active ? nearbyListings : allListings;
  const [tab, setTab] = useState<CustomerTab>('marketplace');
  const [category, setCategory] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [reservationCount, setReservationCount] = useState(0);
  const { user, role, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const favs = useFavourites(user ? user.id : null);
  const [supportTopic, setSupportTopic] = useState('reservation');

  const openPage = (t: CustomerTab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

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
          {!user && (
            <button onClick={onBack} className="btn-ghost -ml-2">
              <ArrowLeft size={18} /> <span className="hidden sm:inline">Home</span>
            </button>
          )}
          <Logo size="sm" />
          <div className="ml-auto flex items-center gap-2">
            <span className={`hidden sm:inline badge ${role === 'business' ? 'bg-ink-900 text-white' : 'bg-orange-100 text-orange-700'}`}>
              {role === 'business' ? 'Business' : 'Customer'}
            </span>
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button onClick={() => setTab('account')} className="btn-ghost">
                  <UserIcon size={18} />
                  <span className="max-w-[8rem] truncate">
                    {(user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'Account'}
                  </span>
                </button>
                <button
                  onClick={() => signOut()}
                  className="btn-ghost text-ink-500 hover:text-ink-900"
                  title="Sign out"
                >
                  <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="btn-primary !px-4 !py-2">
                Sign in
              </button>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex gap-1 border-t border-ink-900/5">
          <TabButton active={tab === 'marketplace'} onClick={() => setTab('marketplace')} icon={<Package size={16} />}>
            Discover Food
          </TabButton>
          <TabButton active={tab === 'reservations'} onClick={() => setTab('reservations')} icon={<ClipboardList size={16} />}>
            My Reservations
            {reservationCount > 0 && (
              <span className="ml-1.5 badge bg-orange-500 text-white px-1.5 py-0.5 text-[10px]">{reservationCount}</span>
            )}
          </TabButton>
                    <TabButton active={tab === 'account'} onClick={() => setTab('account')} icon={<UserIcon size={16} />}>
            My Account
          </TabButton>
          <MoreMenu active={tab} onSelect={openPage} />
        </div>
      </header>

         {tab === 'marketplace' && (
         <>
      {/* Search + Filters */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-6 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-1">Discover Food</h1>
        <p className="text-ink-600 text-sm mb-5">
          Browse surplus meal boxes from local businesses and reserve yours for pickup.
        </p>

        <NearbyPanel nearby={nearby} />

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
            <p className="text-ink-600 font-medium">
              {nearby.active ? `No meal boxes within ${nearby.radiusKm} km right now.` : 'No meal boxes match your filters.'}
            </p>
            <p className="text-ink-400 text-sm mt-1">
              {nearby.active
                ? 'Try a larger search radius, or show all listings.'
                : 'Try adjusting your search or clearing filters.'}
            </p>
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
         
           </>
         )}
    
      {/* Detail + Reservation modal */}
      <ListingDetailModal
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onReserved={handleReservationComplete}
        onRequireLogin={() => {
          setSelectedListing(null);
          setAuthOpen(true);
        }}
        isFavourite={selectedListing ? favs.isFavourite(selectedListing.business_id) : false}
        onToggleFavourite={() => {
          if (!selectedListing) return;
          if (!user) {
            setSelectedListing(null);
            setAuthOpen(true);
            return;
          }
          favs.toggle(selectedListing.business_id);
        }}
      />
      {tab === 'reservations' && (
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
          <MyReservations onSignInClick={() => setAuthOpen(true)} />
        </div>
      )}
            {tab === 'account' && (
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6">
          <AccountPage onSignInClick={() => setAuthOpen(true)} />
        </div>
      )}
      {tab === 'favourites' && (
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
          <FavouritesPage
            signedIn={!!user}
            favs={favs}
            listings={allListings.listings}
            onOpenListing={setSelectedListing}
            onSignInClick={() => setAuthOpen(true)}
          />
        </div>
      )}
      {tab === 'help' && <HelpSupportPage key={supportTopic} initialTopic={supportTopic} />}
      {tab === 'about' && <AboutPage />}
      {tab === 'safety' && (
        <FoodSafetyPage
          onReportConcern={() => {
            setSupportTopic('food_safety');
            openPage('help');
          }}
        />
      )}
      {tab === 'terms' && <TermsPrivacyPage />}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        role="customer"
        onOpenTerms={() => {
          setAuthOpen(false);
          openPage('terms');
        }}
      />
    </div>
  );
}

const MENU_ITEMS: { tab: CustomerTab; label: string; icon: React.ReactNode }[] = [
  { tab: 'favourites', label: 'Favourites', icon: <Heart size={16} /> },
  { tab: 'help', label: 'Help & Support', icon: <HelpCircle size={16} /> },
  { tab: 'about', label: 'About Luck Bite', icon: <Info size={16} /> },
  { tab: 'safety', label: 'Food Safety & Trust', icon: <ShieldCheck size={16} /> },
  { tab: 'terms', label: 'Terms & Privacy', icon: <FileText size={16} /> },
];

// The menu button at the far right of the tab bar
function MoreMenu({ active, onSelect }: { active: CustomerTab; onSelect: (t: CustomerTab) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMenuPage = MENU_ITEMS.some((m) => m.tab === active);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="ml-auto relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        aria-expanded={open}
        className={`p-2.5 rounded-xl transition-colors ${
          isMenuPage || open ? 'bg-orange-100 text-orange-600' : 'text-ink-500 hover:bg-cream-200 hover:text-ink-900'
        }`}
      >
        <Menu size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 card p-1.5 z-40 shadow-card-hover">
          {MENU_ITEMS.map((m) => (
            <button
              key={m.tab}
              onClick={() => {
                setOpen(false);
                onSelect(m.tab);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                active === m.tab ? 'bg-orange-50 text-orange-700' : 'text-ink-800 hover:bg-cream-200'
              }`}
            >
              <span className="text-ink-500">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FavouritesPage({
  signedIn,
  favs,
  listings,
  onOpenListing,
  onSignInClick,
}: {
  signedIn: boolean;
  favs: ReturnType<typeof useFavourites>;
  listings: Listing[];
  onOpenListing: (l: Listing) => void;
  onSignInClick: () => void;
}) {
  if (!signedIn) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto">
        <Heart size={36} className="mx-auto text-ink-400 mb-3" />
        <h2 className="text-xl font-bold text-ink-900 mb-2">Sign in to see your favourites</h2>
        <p className="text-ink-600 text-sm mb-5">
          Save businesses you like and quickly find their new meal boxes here.
        </p>
        <button onClick={onSignInClick} className="btn-primary">Sign in as Customer</button>
      </div>
    );
  }

  const savedIds = new Set(favs.favourites.map((f) => f.id));
  const fromFavourites = listings.filter((l) => savedIds.has(l.business_id));

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-1">Favourites</h1>
      <p className="text-ink-600 text-sm mb-6">Businesses you saved, and their latest meal boxes.</p>

      {favs.loading && favs.favourites.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : favs.favourites.length === 0 ? (
        <div className="card p-8 text-center">
          <Heart size={36} className="mx-auto text-ink-400 mb-3" />
          <p className="text-ink-600 font-medium">No favourites yet.</p>
          <p className="text-ink-400 text-sm mt-1">
            Open a meal box and tap "Save this business" to add it here.
          </p>
        </div>
      ) : (
        <>
          <h2 className="font-bold text-ink-900 mb-3">New from your favourites</h2>
          {fromFavourites.length === 0 ? (
            <p className="text-sm text-ink-500 mb-8">None of your favourite businesses has meal boxes right now.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {fromFavourites.map((l) => (
                <ListingCard key={l.id} listing={l} onClick={() => onOpenListing(l)} />
              ))}
            </div>
          )}

          <h2 className="font-bold text-ink-900 mb-3">Your saved businesses</h2>
          <div className="space-y-3">
            {favs.favourites.map((b) => (
              <div key={b.id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-cream-200 flex items-center justify-center text-ink-600 flex-shrink-0">
                  <Store size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink-900 truncate">{b.name}</p>
                  <p className="text-sm text-ink-500 truncate">{b.business_type} · {b.location}</p>
                </div>
                <button onClick={() => favs.toggle(b.id)} className="btn-ghost text-orange-600">
                  <Heart size={16} className="fill-orange-500" /> Remove
                </button>
              </div>
            ))}
          </div>
        </>
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
        {listing.distance_km != null && (
          <div className="flex items-center gap-2">
            <Navigation size={15} className="text-orange-500 flex-shrink-0" />
            <span className="font-semibold text-orange-600">{formatDistance(listing.distance_km)} away</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-ink-400 flex-shrink-0" />
          <span>
            {availabilityText(listing)}
            {formatTimeLeft(listing.minutes_left) ? ` · ${formatTimeLeft(listing.minutes_left)}` : ''}
          </span>
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
  onRequireLogin,
  isFavourite,
  onToggleFavourite,
}: {
  listing: Listing | null;
  onClose: () => void;
  onReserved: () => void;
  onRequireLogin: () => void;
  isFavourite: boolean;
  onToggleFavourite: () => void;
}) {
  const { user } = useAuth();
  const [profilePhone, setProfilePhone] = useState('');

  // The phone number saved on the customer's account (used to pre-fill the form)
  useEffect(() => {
    if (!user) {
      setProfilePhone('');
      return;
    }
    supabase
      .from('user_profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfilePhone(data?.phone ?? ''));
  }, [user]);
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
    if (!user) {
      onRequireLogin();
      return;
    }
    if (!name.trim()) {
      setSubmitError('Please enter your name.');
      return;
    }
    if (!isValidMobile(phone)) {
      setSubmitError(PHONE_ERROR);
      return;
    }
    if (quantity < 1 || quantity > listing.quantity_available) {
      setSubmitError(`Quantity must be between 1 and ${listing.quantity_available}.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = await supabase.rpc('reserve_listing', {
      p_listing_id: listing.id,
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
      p_quantity: quantity,
      p_session_id: getSessionId(),
    });

    if (error || !data) {
      setSubmitError(error?.message || 'Something went wrong creating your reservation. Please try again.');
      setSubmitting(false);
      return;
    }

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
          <button
            onClick={onToggleFavourite}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:underline mb-4"
          >
            <Heart size={15} className={isFavourite ? 'fill-orange-500 text-orange-500' : ''} />
            {isFavourite ? 'Saved to favourites' : 'Save this business'}
          </button>

          <p className="text-ink-600 leading-relaxed mb-5">{listing.description}</p>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <InfoRow icon={<MapPin size={16} />} label="Location" value={listing.business?.location ?? '—'} />
                        <InfoRow icon={<Clock size={16} />} label="Pickup" value={availabilityText(listing)} />
            <InfoRow icon={<Store size={16} />} label="Business type" value={listing.business?.business_type ?? '—'} />
            <InfoRow icon={<Package size={16} />} label="Available" value={`${listing.quantity_available} box(es)`} />
          </div>
          {listing.business?.latitude != null && listing.business?.longitude != null && (
            <a
              href={mapUrl(listing.business.latitude!, listing.business.longitude!)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:underline mb-5 -mt-2"
            >
              <Navigation size={15} /> View on map
            </a>
          )}

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
            onClick={() => {
              if (!user) {
                onRequireLogin();
                return;
              }
              setName((n) => n || ((user.user_metadata?.full_name as string | undefined) ?? ''));
              setPhone((p) => p || profilePhone);
              setStep('form');
              setSubmitError(null);
            }}
            disabled={soldOut}
            className="btn-primary w-full"
          >
            <ShoppingBag size={20} />
            {soldOut ? 'Sold Out' : user ? 'Reserve This Box' : 'Sign in to reserve'}
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
              <div className="flex items-center gap-2">
                <span className="text-ink-600 font-medium">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
                  placeholder="9876543210"
                  className="input-field"
                />
              </div>
              <p className="text-xs text-ink-400 mt-1">
                10 digits, numbers only. The business may call you about your pickup. No SMS is sent in this demo.
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
