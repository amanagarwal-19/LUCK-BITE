import { useState } from 'react';
import { ArrowLeft, Store, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useBusinesses } from '@/hooks/useData';
import type { Business } from '@/types';
import Logo from '@/components/Logo';
import BusinessProfileForm from '@/components/BusinessProfileForm';
import BusinessDashboard from '@/components/BusinessDashboard';

export default function BusinessSection({ onBack }: { onBack: () => void }) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { businesses, loading, refetch } = useBusinesses();

  // If a business is selected, show the dashboard
  if (selectedBusiness) {
    return <BusinessDashboard business={selectedBusiness} onBack={() => { setSelectedBusiness(null); refetch(); }} />;
  }

  // If creating a new profile, show the form
  if (showCreate) {
    return (
      <BusinessProfileForm
        onSubmit={(biz) => { setSelectedBusiness(biz); refetch(); }}
        onBack={() => setShowCreate(false)}
      />
    );
  }

  // Otherwise show the business selection screen
  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-ink-900/5">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-4">
          <button onClick={onBack} className="btn-ghost -ml-2">
            <ArrowLeft size={18} /> <span className="hidden sm:inline">Home</span>
          </button>
          <Logo size="sm" />
          <span className="ml-auto badge bg-ink-900/5 text-ink-600">Business</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4 shadow-card">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-2">Business Portal</h1>
          <p className="text-ink-600 text-sm">
            Select an existing business profile or create a new one to get started.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="card p-5 w-full flex items-center gap-4 text-left hover:shadow-card-hover hover:border-orange-200 transition-all group mb-5"
        >
          <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-warm group-hover:scale-110 transition-transform">
            <Plus size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-ink-900">Create New Business Profile</h3>
            <p className="text-sm text-ink-600">Set up your business to start listing surplus food.</p>
          </div>
          <ChevronRight size={20} className="text-ink-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
        </button>

        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide">Existing Profiles</h2>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : businesses.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-ink-500 text-sm">No business profiles yet. Create one above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {businesses.map((biz) => (
              <button
                key={biz.id}
                onClick={() => setSelectedBusiness(biz)}
                className="card p-4 w-full flex items-center gap-4 text-left hover:shadow-card-hover hover:border-orange-200 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-cream-200 flex items-center justify-center text-ink-600 flex-shrink-0">
                  <Store size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-ink-900 truncate">{biz.name}</h3>
                  <p className="text-sm text-ink-500 truncate">
                    {biz.business_type} · {biz.location}
                  </p>
                </div>
                <ChevronRight size={20} className="text-ink-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-ink-400 mt-8">
          Demo prototype — no account or password required. All data is shared for demonstration.
        </p>
      </div>
    </div>
  );
}
