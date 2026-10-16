import { useState, useEffect, useRef } from 'react';
import LandingPage from '@/components/LandingPage';
import CustomerMarketplace from '@/components/CustomerMarketplace';
import BusinessSection from '@/components/BusinessSection';
import AdminPanel from '@/components/AdminPanel';
import { useAuth } from '@/lib/AuthContext';
import type { UserRole } from '@/types';

type View = 'landing' | 'customer' | 'business' | 'admin';

export default function App() {
  const { user, role, loading, recovering } = useAuth();
  const [view, setView] = useState<View>(window.location.hash === '#admin' ? 'admin' : 'landing');
  const prevUserRef = useRef(user);

  // Customer clicked a password-reset link in their email: take them to the customer area
  useEffect(() => {
    if (recovering) setView('customer');
  }, [recovering]);

  // Admin area hash listener
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#admin') setView('admin');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // When user logs out -> immediately redirect to the landing homepage
  useEffect(() => {
    if (prevUserRef.current && !user) {
      if (window.location.hash) history.replaceState(null, '', window.location.pathname);
      setView('landing');
    }
    prevUserRef.current = user;
  }, [user]);

  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLoadTimedOut(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // STRICT PORTAL LOCKOUT:
  // - If signed in as Business: locked to 'business' view. Cannot access homepage or customer portal.
  // - If signed in as Customer: locked to 'customer' view. Cannot access homepage or business portal.
  // - Leaving or switching is only possible after explicitly logging out.
  useEffect(() => {
    if (loading && !loadTimedOut) return;
    if (window.location.hash === '#admin') return;

    if (user) {
      const activeRole = role || (user.user_metadata?.role as UserRole) || 'customer';
      if (activeRole === 'business') {
        if (view !== 'business') {
          setView('business');
        }
      } else if (activeRole === 'customer') {
        if (view !== 'customer') {
          setView('customer');
        }
      }
    }
  }, [user, role, loading, loadTimedOut, view]);

  const goHome = () => {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
    const activeRole = role || (user?.user_metadata?.role as UserRole) || 'customer';
    // Logged-in users are locked into their respective portal until they sign out
    if (user && activeRole === 'business') {
      setView('business');
    } else if (user && activeRole === 'customer') {
      setView('customer');
    } else {
      setView('landing');
    }
  };

  if (loading && !loadTimedOut) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      {view === 'landing' && (
        <LandingPage
          onSelectCustomer={() => setView('customer')}
          onSelectBusiness={() => setView('business')}
        />
      )}
      {view === 'customer' && <CustomerMarketplace onBack={goHome} />}
      {view === 'business' && <BusinessSection onBack={goHome} />}
      {view === 'admin' && <AdminPanel onBack={goHome} />}
    </div>
  );
}

