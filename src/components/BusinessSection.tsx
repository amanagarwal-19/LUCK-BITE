import { useState } from 'react';
import { ArrowLeft, Store, ChevronRight, Plus, LogOut, ShieldCheck, Clock, XCircle, Ban, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useMyBusinesses } from '@/hooks/useData';
import type { Business, BusinessStatus } from '@/types';
import Logo from '@/components/Logo';
import { Badge } from '@/components/Badge';
import AuthModal from '@/components/AuthModal';
import BusinessProfileForm from '@/components/BusinessProfileForm';
import BusinessDashboard from '@/components/BusinessDashboard';

const STATUS_INFO = {
  pending: {
    label: 'Pending verification',
    variant: 'warning',
    icon: Clock,
    text: "We're reviewing your documents. You'll be able to list food as soon as your business is approved.",
  },
  approved: { label: 'Verified', variant: 'green', icon: ShieldCheck, text: '' },
  rejected: { label: 'Not approved', variant: 'error', icon: XCircle, text: 'Your registration was not approved.' },
  suspended: {
    label: 'Suspended',
    variant: 'error',
    icon: Ban,
    text: 'This business is suspended and cannot manage listings right now.',
  },
} as const;

function PortalHeader({ onBack, right }: { onBack: () => void; right?: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-ink-900/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-4">
        {!user && (
          <button onClick={onBack} className="btn-ghost -ml-2">
            <ArrowLeft size={18} /> <span className="hidden sm:inline">Home</span>
          </button>
        )}
        <Logo size="sm" />
        <div className="ml-auto flex items-center gap-2">
          <span className="badge bg-ink-900 text-white">Business</span>
          {right}
        </div>
      </div>
    </header>
  );
}


export default function BusinessSection({ onBack }: { onBack: () => void }) {
  const { user, role, loading: authLoading, signOut } = useAuth();
  const isBusinessOrAdmin = role === 'business' || role === 'admin';
  const { businesses, loading, refetch } = useMyBusinesses(user && isBusinessOrAdmin ? user.id : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const selected: Business | undefined = businesses.find((b) => b.id === selectedId);

  // 1. Checking whether the person is signed in
  if (authLoading) {
    return (
      <div className="min-h-screen bg-cream-100">
        <PortalHeader onBack={onBack} />
        <div className="text-center py-24">
          <div className="inline-block w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // 2. Not signed in: business sign in / create account
  if (!user) {
    return (
      <div className="min-h-screen bg-cream-100">
        <PortalHeader onBack={onBack} />
        <div className="max-w-md mx-auto px-5 sm:px-8 py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4 shadow-card">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-2">Business Portal</h1>
          <p className="text-ink-600 text-sm mb-6">
            Sign in to manage your listings, or create a business account to register your business. New
            businesses are verified before they can list food.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => { setAuthMode('signin'); setAuthOpen(true); }}
              className="btn-primary w-full"
            >
              Sign in as Business
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}
              className="btn-secondary w-full"
            >
              Create a business account
            </button>
          </div>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} role="business" />
      </div>
    );
  }

  // 3. Logged in, but is a Customer account: strictly block access to business dashboard
  if (user && role === 'customer') {
    return (
      <div className="min-h-screen bg-cream-100">
        <PortalHeader onBack={onBack} />
        <div className="max-w-md mx-auto px-5 sm:px-8 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 shadow-card">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 mb-2">Customer Account Detected</h1>
          <p className="text-ink-600 text-sm mb-6">
            You are signed in as <strong>{user.email}</strong>, which is registered as a Customer account.
            Business dashboards and surplus food management are only accessible to Business accounts.
          </p>
          <div className="space-y-3">
            <button
              onClick={async () => {
                await signOut();
                setAuthMode('signin');
                setAuthOpen(true);
              }}
              className="btn-primary w-full"
            >
              Sign out & sign in with Business account
            </button>
            <button onClick={onBack} className="btn-secondary w-full">
              Back to Customer Marketplace
            </button>
          </div>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} role="business" />
      </div>
    );
  }

  // 3. Verified business selected: dashboard
  if (selected && selected.status === 'approved') {
    return (
      <BusinessDashboard
        business={selected}
        onBack={() => { setSelectedId(null); refetch(); }}
        onBusinessUpdated={refetch}
      />
    );
  }

  // 4. Registering a new business
  if (showCreate) {
    return (
      <BusinessProfileForm
        onSubmitted={() => { setShowCreate(false); refetch(); }}
        onBack={() => setShowCreate(false)}
      />
    );
  }

  // 5. Signed in: my businesses
  return (
    <div className="min-h-screen bg-cream-100">
      <PortalHeader
        onBack={onBack}
        right={
          <button onClick={() => signOut()} className="btn-ghost">
            <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
          </button>
        }
      />

      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4 shadow-card">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-2">Your Businesses</h1>
          <p className="text-ink-600 text-sm">Signed in as {user.email}</p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="card p-5 w-full flex items-center gap-4 text-left hover:shadow-card-hover hover:border-orange-200 transition-all group mb-6"
        >
          <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-warm group-hover:scale-110 transition-transform">
            <Plus size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-ink-900">Register a Business</h3>
            <p className="text-sm text-ink-600">
              Submit your business details and proof of authorization for verification.
            </p>
          </div>
          <ChevronRight size={20} className="text-ink-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
        </button>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : businesses.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-ink-500 text-sm">
              You haven't registered a business yet. Register one above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {businesses.map((biz) => {
              const info = STATUS_INFO[biz.status as BusinessStatus] ?? STATUS_INFO.pending;
              const Icon = info.icon;
              const isApproved = biz.status === 'approved';
              const content = (
                <>
                  <div className="w-10 h-10 rounded-xl bg-cream-200 flex items-center justify-center text-ink-600 flex-shrink-0">
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-ink-900 truncate">{biz.name}</h3>
                      <Badge variant={info.variant}>{info.label}</Badge>
                    </div>
                    <p className="text-sm text-ink-500 truncate">
                      {biz.business_type} · {biz.location}
                    </p>
                    {!isApproved && (
                      <p className="text-sm text-ink-600 mt-2">
                        {info.text}
                        {biz.review_note ? ` Reason: ${biz.review_note}` : ''}
                      </p>
                    )}
                  </div>
                  {isApproved && <ChevronRight size={20} className="text-ink-400 flex-shrink-0" />}
                </>
              );
              return isApproved ? (
                <button
                  key={biz.id}
                  onClick={() => setSelectedId(biz.id)}
                  className="card p-4 w-full flex items-center gap-4 text-left hover:shadow-card-hover hover:border-orange-200 transition-all"
                >
                  {content}
                </button>
              ) : (
                <div key={biz.id} className="card p-4 w-full flex items-start gap-4 text-left">
                  {content}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-ink-400 mt-8">
          Only verified businesses can publish listings. Registering does not give access to any existing business.
        </p>
      </div>
    </div>
  );
}
