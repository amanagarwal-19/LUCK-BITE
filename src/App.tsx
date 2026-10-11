import { useState, useEffect } from 'react';
import LandingPage from '@/components/LandingPage';
import CustomerMarketplace from '@/components/CustomerMarketplace';
import BusinessSection from '@/components/BusinessSection';
import { useAuth } from '@/lib/AuthContext';

type View = 'landing' | 'customer' | 'business';

export default function App() {
  const [view, setView] = useState<View>('landing');
    const { recovering } = useAuth();

  // Customer clicked a password-reset link in their email: take them to the customer area
  useEffect(() => {
    if (recovering) setView('customer');
  }, [recovering]);

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
    </div>
  );
}
