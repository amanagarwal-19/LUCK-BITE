import { useState, useEffect } from 'react';
import LandingPage from '@/components/LandingPage';
import CustomerMarketplace from '@/components/CustomerMarketplace';
import BusinessSection from '@/components/BusinessSection';
import AdminPanel from '@/components/AdminPanel';
import { useAuth } from '@/lib/AuthContext';

type View = 'landing' | 'customer' | 'business' | 'admin';

export default function App() {
  // The admin area is opened with the web address ending in #admin
  const [view, setView] = useState<View>(window.location.hash === '#admin' ? 'admin' : 'landing');
  const { recovering } = useAuth();

  // Customer clicked a password-reset link in their email: take them to the customer area
  useEffect(() => {
    if (recovering) setView('customer');
  }, [recovering]);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#admin') setView('admin');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goHome = () => {
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
    setView('landing');
  };

  return (
    <div className="min-h-screen bg-cream-100">
      {view === 'landing' && (
        <LandingPage
          onSelectCustomer={() => setView('customer')}
          onSelectBusiness={() => setView('business')}
        />
      )}
      {view === 'customer' && <CustomerMarketplace onBack={() => setView('landing')} />}
      {view === 'business' && <BusinessSection onBack={() => setView('landing')} />}
      {view === 'admin' && <AdminPanel onBack={goHome} />}
    </div>
  );
}
