import { useEffect, useState } from 'react';
import { Package, ClipboardList, CheckCircle2, IndianRupee, TrendingUp, XCircle, Leaf, PiggyBank } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/Badge';
import { AVG_ITEM_WEIGHT_KG } from '@/lib/config';

interface Summary {
  listings_count: number;
  items_listed: number;
  items_reserved: number;
  items_collected: number;
  items_cancelled: number;
  items_pending: number;
  reservations_total: number;
  reservations_collected: number;
  reservations_cancelled: number;
  reservations_pending: number;
  revenue_recovered: number;
  customer_savings: number;
  pending_value: number;
}

interface Point {
  period: string;
  listed: number;
  reserved: number;
  collected: number;
  revenue: number;
}

interface Analytics {
  summary: Summary;
  weekly: Point[];
  monthly: Point[];
}

const PERIODS: { label: string; days: number | null }[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'All time', days: null },
];

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

export default function BusinessAnalytics({ businessId }: { businessId: string }) {
  const [days, setDays] = useState<number | null>(30);
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.rpc('business_analytics', { p_business_id: businessId, p_days: days }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error.message || 'Could not load your performance data.');
      else setData(data as Analytics);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [businessId, days]);

  if (error) {
    return (
      <div className="rounded-xl bg-error-100 border border-error-500/20 p-4 text-sm text-error-700">{error}</div>
    );
  }
  if (!data) {
    return <p className="text-center text-ink-500 py-16 text-sm">Loading your performance…</p>;
  }

  const s = data.summary;
  const resolved = s.reservations_collected + s.reservations_cancelled;
  const collectionRate = resolved > 0 ? s.reservations_collected / resolved : null;
  const cancellationRate = resolved > 0 ? s.reservations_cancelled / resolved : null;
  const foodSavedKg = s.items_collected * AVG_ITEM_WEIGHT_KG;

  const points = view === 'weekly' ? data.weekly : data.monthly;
  const labelOf = (p: Point) => {
    const d = new Date(`${p.period}T00:00:00`);
    return view === 'weekly'
      ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : d.toLocaleDateString('en-IN', { month: 'short' });
  };
  const longLabelOf = (p: Point) => {
    const d = new Date(`${p.period}T00:00:00`);
    return view === 'weekly'
      ? `Week of ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };
  const hasActivity = points.some((p) => p.listed > 0 || p.reserved > 0 || p.collected > 0);

  return (
    <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Impact & Performance</h2>
          <p className="text-sm text-ink-600">How your food items are doing on Luck Bite.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDays(p.days)}
              className={`badge transition-all !px-3.5 !py-2 ${
                days === p.days ? 'bg-orange-500 text-cream-100' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3">
        <Kpi icon={<Package size={20} />} label="Items listed" value={String(s.items_listed)} hint={`${s.listings_count} listing${s.listings_count === 1 ? '' : 's'}`} />
        <Kpi icon={<ClipboardList size={20} />} label="Items reserved" value={String(s.items_reserved)} hint={`${s.items_pending} waiting for pickup`} />
        <Kpi icon={<CheckCircle2 size={20} />} label="Items collected" value={String(s.items_collected)} hint="marked as collected" />
        <Kpi
          icon={<IndianRupee size={20} />}
          label="Revenue recovered"
          value={inr(s.revenue_recovered)}
          hint={s.pending_value > 0 ? `${inr(s.pending_value)} more waiting for pickup` : 'from collected items'}
        />
        <Kpi icon={<TrendingUp size={20} />} label="Collection rate" value={pct(collectionRate)} hint={resolved > 0 ? `${s.reservations_collected} of ${resolved} finished reservations` : 'no finished reservations yet'} />
        <Kpi icon={<XCircle size={20} />} label="Cancellation rate" value={pct(cancellationRate)} hint={resolved > 0 ? `${s.reservations_cancelled} of ${resolved} finished reservations` : 'no finished reservations yet'} />
        <Kpi
          icon={<Leaf size={20} />}
          label="Food saved from waste"
          value={`${foodSavedKg.toFixed(1)} kg`}
          hint={`${s.items_collected} item${s.items_collected === 1 ? '' : 's'} rescued`}
          badge="Estimated"
        />
        <Kpi icon={<PiggyBank size={20} />} label="Customer savings" value={inr(s.customer_savings)} hint="vs. original prices" />
      </div>

      <div className="card p-5 sm:p-6 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-ink-900">Performance over time</h3>
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`badge capitalize transition-all !px-3.5 !py-2 ${
                  view === v ? 'bg-orange-500 text-cream-100' : 'bg-cream-200 text-ink-600 hover:bg-cream-100'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {!hasActivity ? (
          <p className="text-sm text-ink-500 py-10 text-center">
            No activity in this time range yet. Your charts will appear once you list items and customers reserve them.
          </p>
        ) : (
          <div className="space-y-8">
            <div>
              <p className="text-sm font-semibold text-ink-800 mb-2">Items listed, reserved and collected</p>
              <BarChart
                points={points.map((p) => ({
                  label: labelOf(p),
                  tooltip: `${longLabelOf(p)}: listed ${p.listed}, reserved ${p.reserved}, collected ${p.collected}`,
                  values: [p.listed, p.reserved, p.collected],
                }))}
                series={[
                  { name: 'Listed', color: '#C6D6C3' },
                  { name: 'Reserved', color: '#F5C66B' },
                  { name: 'Collected', color: '#173D2A' },
                ]}
                format={(n) => String(n)}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-800 mb-2">Revenue recovered (₹)</p>
              <BarChart
                points={points.map((p) => ({
                  label: labelOf(p),
                  tooltip: `${longLabelOf(p)}: ${inr(p.revenue)}`,
                  values: [p.revenue],
                }))}
                series={[{ name: 'Revenue recovered', color: '#2F6B4A' }]}
                format={inr}
              />
            </div>
          </div>
        )}
        <p className="text-xs text-ink-400 mt-4">
          {view === 'weekly' ? 'The last 12 weeks' : 'The last 12 months'}, counted by reservation date (Indian Standard Time).
        </p>
      </div>

      <div className="card p-5 sm:p-6 mt-6">
        <h3 className="font-bold text-ink-900 mb-2">How these numbers are calculated</h3>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-600">
          <li>
            <strong>Items listed</strong>: items you put up for sale (stock still left, plus items reserved and not cancelled).
          </li>
          <li>
            <strong>Items reserved</strong>: everything customers reserved, including items later collected or cancelled.
          </li>
          <li>
            <strong>Revenue recovered</strong>: the value of items you marked as collected, at the price when they were
            reserved. Luck Bite doesn't process payments, so this is based on your own pickup records.
          </li>
          <li>
            <strong>Collection and cancellation rates</strong> only count finished reservations (collected or cancelled).
            Reservations still waiting for pickup are not included.
          </li>
          <li>
            <strong>Food saved from waste is an estimate.</strong> We assume each collected item weighs about{' '}
            {AVG_ITEM_WEIGHT_KG} kg and would otherwise have been thrown away. It is a rough figure, not a measurement.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  badge?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">{icon}</div>
        {badge && <Badge variant="warning">{badge}</Badge>}
      </div>
      <p className="text-2xl font-bold text-ink-900 leading-tight">{value}</p>
      <p className="text-sm font-medium text-ink-700 mt-0.5">{label}</p>
      {hint && <p className="text-xs text-ink-400 mt-1">{hint}</p>}
    </div>
  );
}

interface ChartPoint {
  label: string;
  tooltip: string;
  values: number[];
}

// A simple bar chart made with plain HTML (no chart library needed)
function BarChart({
  points,
  series,
  format,
}: {
  points: ChartPoint[];
  series: { name: string; color: string }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...points.flatMap((p) => p.values));
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-ink-600">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
        <span className="text-xs text-ink-400 ml-auto">Highest: {format(max)}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-1.5 sm:gap-2 min-w-[420px]">
          {points.map((p) => (
            <div key={p.label + p.tooltip} className="flex-1 min-w-[26px] flex flex-col items-center" title={p.tooltip}>
              <div className="h-36 w-full flex items-end justify-center gap-0.5 border-b border-ink-900/10">
                {p.values.map((v, i) => (
                  <div
                    key={i}
                    className="w-2 sm:w-3 rounded-t"
                    style={{
                      height: `${(v / max) * 100}%`,
                      minHeight: v > 0 ? 3 : 0,
                      backgroundColor: series[i].color,
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-ink-500 mt-1 whitespace-nowrap">{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
