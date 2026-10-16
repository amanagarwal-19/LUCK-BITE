import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import LocationPicker from '@/components/LocationPicker';
import type { PickedLocation } from '@/components/LocationPicker';
import { ArrowLeft, Plus, Package, ClipboardList, Store, MapPin, Mail, Phone, Clock, Tag, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useBusinessListings, useBusinessReservations } from '@/hooks/useData';
import { useAuth } from '@/lib/AuthContext';
import type { Business, Listing } from '@/types';
import { Badge } from '@/components/Badge';
import Logo from '@/components/Logo';
import { ListingFormModal, ListingCard } from '@/components/ListingForms';
import ReservationManagement from '@/components/ReservationManagement';

type Tab = 'listings' | 'reservations';

export default function BusinessDashboard({
  business,
  onBack,
  onBusinessUpdated,
}: {
  business: Business;
  onBack: () => void;
  onBusinessUpdated?: () => void;
}) {
  const [editLocation, setEditLocation] = useState(false);
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('listings');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const { listings, loading, refetch: refetchListings } = useBusinessListings(business.id);
  const { reservations, refetch: refetchReservations } = useBusinessReservations(business.id);

  const openAdd = () => { setEditing(null); setShowForm(true); };
  const openEdit = (l: Listing) => { setEditing(l); setShowForm(true); };

  const handleToggleActive = async (l: Listing) => {
    const { error } = await supabase.from('listings').update({ is_active: !l.is_active }).eq('id', l.id);
    if (error) {
      alert('Could not update this listing. Your business may not be verified or you may not have permission.');
      return;
    }
    refetchListings();
  };

  const handleDelete = async (l: Listing) => {
    if (!confirm(`Delete "${l.meal_name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('listings').delete().eq('id', l.id);
    if (error) {
      alert('Could not delete this listing. Your business may not be verified or you may not have permission.');
      return;
    }
    refetchListings();
  };

  const activeListings = listings.filter((l) => l.is_active).length;
  const pendingReservations = reservations.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-ink-900/5">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-4">
          <button onClick={onBack} className="btn-ghost -ml-2">
            <ArrowLeft size={18} /> <span className="hidden sm:inline">My Businesses</span>
          </button>
          <Logo size="sm" />
          <div className="ml-auto flex items-center gap-2">
            <span className="badge bg-ink-900 text-white">Business</span>
            <button
              onClick={() => signOut()}
              className="btn-ghost text-ink-500 hover:text-ink-900"
              title="Sign out"
            >
              <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
        {/* Business info banner */}
        <div className="card p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ink-900 flex items-center justify-center flex-shrink-0">
              <Store size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-ink-900">{business.name}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500 mt-1">
                <span className="flex items-center gap-1.5"><Tag size={14} /> {business.business_type}</span>
                <span className="flex items-center gap-1.5"><MapPin size={14} /> {business.location}</span>
                <button onClick={() => setEditLocation(true)} className="text-orange-600 font-semibold hover:underline">
                  {business.latitude != null ? 'Edit map location' : 'Add map location'}
                </button>
                {business.email && <span className="flex items-center gap-1.5"><Mail size={14} /> {business.email}</span>}
                {business.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {business.phone}</span>}
              </div>
            </div>
          </div>
        </div>

        {business.latitude == null && (
          <div className="rounded-xl bg-warning-100 border border-warning-500/20 p-3 mb-4 text-sm text-warning-700">
            Customers nearby can't find your listings yet. Click "Add map location" above to set your exact location.
          </div>
        )}

        <EditLocationModal
          business={business}
          open={editLocation}
          onClose={() => setEditLocation(false)}
          onSaved={() => { setEditLocation(false); onBusinessUpdated?.(); }}
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <StatCard icon={<Package size={20} />} label="Active Listings" value={activeListings} />
          <StatCard icon={<ClipboardList size={20} />} label="Total Reservations" value={reservations.length} />
          <StatCard icon={<Clock size={20} />} label="Pending Pickup" value={pendingReservations} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-ink-900/5">
          <TabButton active={tab === 'listings'} onClick={() => setTab('listings')} icon={<Package size={17} />}>
            Listings
          </TabButton>
          <TabButton active={tab === 'reservations'} onClick={() => setTab('reservations')} icon={<ClipboardList size={17} />}>
            Reservations
            {pendingReservations > 0 && (
              <span className="ml-1.5 badge bg-orange-500 text-white px-1.5 py-0.5 text-[10px]">{pendingReservations}</span>
            )}
          </TabButton>
        </div>

        {/* Tab content */}
        {tab === 'listings' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-ink-900">Meal Box Listings</h2>
              <button onClick={openAdd} className="btn-primary">
                <Plus size={18} /> Add Listing
              </button>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : listings.length === 0 ? (
              <div className="card p-8 text-center">
                <Package size={36} className="mx-auto text-ink-400 mb-3" />
                <p className="text-ink-600 font-medium">No listings yet.</p>
                <p className="text-ink-400 text-sm mt-1 mb-4">
                  Add your first surplus meal box to start selling.
                </p>
                <button onClick={openAdd} className="btn-primary">
                  <Plus size={18} /> Add Your First Listing
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {listings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    onEdit={() => openEdit(l)}
                    onToggle={() => handleToggleActive(l)}
                    onDelete={() => handleDelete(l)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'reservations' && (
          <ReservationManagement
            reservations={reservations}
            businessId={business.id}
            onRefresh={refetchReservations}
          />
        )}
      </div>

      {/* Listing form modal */}
      <ListingFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        businessId={business.id}
        editing={editing}
        onSaved={() => refetchListings()}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-2 text-orange-600">
        {icon}
      </div>
      <p className="text-2xl font-bold text-ink-900">{value}</p>
      <p className="text-xs text-ink-500 mt-0.5">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
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

function EditLocationModal({
  business,
  open,
  onClose,
  onSaved,
}: {
  business: Business;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const startingPoint = (): PickedLocation | null =>
    business.latitude != null && business.longitude != null
      ? { lat: business.latitude, lng: business.longitude, address: business.location, placeId: business.place_id ?? null }
      : null;
  const [picked, setPicked] = useState<PickedLocation | null>(startingPoint);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the saved location every time the window is opened
  useEffect(() => {
    if (open) {
      setPicked(startingPoint());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    if (!picked) {
      setError('Please search for your business or tap the map to place the pin first.');
      return;
    }
    if (picked.address.trim().length < 3) {
      setError('Please add your business address under the map.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('update_business_location', {
      p_business_id: business.id,
      p_location: picked.address,
      p_latitude: picked.lat,
      p_longitude: picked.lng,
      p_place_id: picked.placeId,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message || 'Could not save the location. Please try again.');
      return;
    }
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Business location" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Search for your restaurant or café, pick it from the list, and confirm the pin. You can also tap the map to
          place it yourself. Customers nearby will find your listings using this location.
        </p>
        <LocationPicker value={picked} onChange={setPicked} />
        {error && (
          <div className="rounded-xl bg-error-100 border border-error-500/20 p-3">
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Save location'}
        </button>
      </div>
    </Modal>
  );
}
