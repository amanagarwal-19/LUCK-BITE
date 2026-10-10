import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Badge({ children, variant = 'default', className }: { children: ReactNode; variant?: 'default' | 'orange' | 'green' | 'warning' | 'error' | 'neutral'; className?: string }) {
  const styles = {
    default: 'bg-cream-200 text-ink-700',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-green-100 text-green-600',
    warning: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700',
    neutral: 'bg-ink-900/5 text-ink-600',
  };
  return <span className={cn('badge', styles[variant], className)}>{children}</span>;
}
