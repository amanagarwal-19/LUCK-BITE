import { UtensilsCrossed } from 'lucide-react';

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const text = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';
  const icon = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${dim} rounded-xl bg-orange-500 flex items-center justify-center shadow-warm`}>
        <UtensilsCrossed size={icon} className="text-cream-100" strokeWidth={2.5} />
      </div>
      <span className={`${text} font-display font-bold tracking-tight text-ink-900`}>
        Luck<span className="text-orange-500">Bite</span>
      </span>
    </div>
  );
}
