import { ShoppingBag, Store, ArrowRight, Sparkles, Leaf, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';

export default function LandingPage({
  onSelectCustomer,
  onSelectBusiness,
}: {
  onSelectCustomer: () => void;
  onSelectBusiness: () => void;
}) {
  return (
    <div className="min-h-screen bg-cream-100">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-10 right-[-60px] w-80 h-80 bg-orange-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-40px] left-[-40px] w-72 h-72 bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-16 sm:pt-16 sm:pb-24">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-10 sm:mb-16">
            <Logo size="lg" />
          </nav>

          {/* Hero content */}
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-orange-700 mb-6 animate-fade-in">
              <Sparkles size={16} />
              Food Is Sacred; Sharing Is Dharma.
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] text-ink-900 mb-5 animate-slide-up">
              Safe surplus.<br />
              <span className="text-orange-500">Affordable meals.</span>
            </h1>
            <p className="text-lg text-ink-600 leading-relaxed mb-10 max-w-xl mx-auto animate-slide-up">
              Luck Bite connects local bakeries, cafes, and restaurants with customers to rescue
              perfectly good surplus food — at a fraction of the original price.
            </p>
          </div>

          {/* Choice cards */}
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto mt-2">
            <button
              onClick={onSelectCustomer}
              className="group card flex h-full flex-col p-6 sm:p-7 text-left hover:shadow-card-hover hover:border-orange-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 transition-all duration-300 animate-slide-up"
            >
              <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center mb-5 shadow-warm group-hover:scale-110 transition-transform">
                <ShoppingBag size={28} className="text-white" strokeWidth={2.2} />
              </div>
              <h2 className="text-xl font-bold text-ink-900 mb-2">I'm a Customer</h2>
              <p className="text-ink-600 text-sm leading-relaxed mb-4">
                Browse affordable meals from local businesses and reserve yours for pickup.
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-orange-600 font-semibold text-sm group-hover:gap-2.5 transition-all">
                Discover food <ArrowRight size={16} />
              </span>
            </button>

            <button
              onClick={onSelectBusiness}
              className="group card flex h-full flex-col p-6 sm:p-7 text-left hover:shadow-card-hover hover:border-orange-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 transition-all duration-300 animate-slide-up"
            >
              <div className="w-14 h-14 rounded-2xl bg-ink-900 flex items-center justify-center mb-5 shadow-card group-hover:scale-110 transition-transform">
                <Store size={28} className="text-white" strokeWidth={2.2} />
              </div>
              <h2 className="text-xl font-bold text-ink-900 mb-2">I'm a Business</h2>
              <p className="text-ink-600 text-sm leading-relaxed mb-4">
                List your surplus food, manage reservations, and track pickups from one dashboard.
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-orange-600 font-semibold text-sm group-hover:gap-2.5 transition-all">
                Go to dashboard <ArrowRight size={16} />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-16 sm:pb-20">
        <h2 className="text-center text-2xl font-bold text-ink-900 mb-8">Why Luck Bite</h2>
        <div className="grid sm:grid-cols-3 gap-5">
          <div className="card p-6">
            <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
              <Leaf size={22} className="text-orange-600" />
            </div>
            <h3 className="font-bold text-ink-900 mb-1.5">Reduce food waste</h3>
            <p className="text-sm text-ink-600 leading-relaxed">
              Surplus food finds a home instead of going to waste. Every meal rescued makes a difference.
            </p>
          </div>
          <div className="card p-6">
            <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
              <ShoppingBag size={22} className="text-orange-600" />
            </div>
            <h3 className="font-bold text-ink-900 mb-1.5">Affordable meals</h3>
            <p className="text-sm text-ink-600 leading-relaxed">
              Customers get quality food at a fraction of the original price — meals are typically 50–70% off.
            </p>
          </div>
          <div className="card p-6">
            <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
              <ShieldCheck size={22} className="text-orange-600" />
            </div>
            <h3 className="font-bold text-ink-900 mb-1.5">Simple & safe</h3>
            <p className="text-sm text-ink-600 leading-relaxed">
              Browse, reserve with a pickup code, and collect. Businesses verify codes at pickup.
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-ink-900/5 py-8">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <p className="text-sm text-ink-500">
              Demo prototype for Eureka Junior — no real payments or SMS verification.
            </p>
            <a href="#admin" className="text-xs text-ink-400 hover:text-ink-700 hover:underline transition-colors">
              Admin Portal
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
