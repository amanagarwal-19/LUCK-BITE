import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export default function Modal({
  open,
  onClose,
  children,
  title,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const maxW = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full bg-cream-50 rounded-t-3xl sm:rounded-2xl shadow-card-hover animate-slide-up max-h-[92vh] overflow-y-auto',
          maxW
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-cream-50/95 backdrop-blur border-b border-ink-900/5">
          {title && <h2 className="text-lg font-bold text-ink-900">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-ink-500 hover:bg-cream-200 hover:text-ink-900 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
