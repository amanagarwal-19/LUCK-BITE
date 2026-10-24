export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function availabilityText(listing: {
  available_until?: string | null;
  collection_window?: string | null;
}): string {
  if (listing.available_until) return `Available till ${listing.available_until}`;
  if (listing.collection_window) return listing.collection_window;
  return '—';
}

// Can customers still reserve this listing?
// It must be switched on, not archived, in stock, and not past its "available till" time.
export function isListingAvailable(
  l: {
    is_active: boolean;
    archived_at?: string | null;
    quantity_available: number;
    expires_at?: string | null;
  },
  nowMs: number = Date.now()
): boolean {
  if (!l.is_active || l.archived_at) return false;
  if (l.quantity_available <= 0) return false;
  if (l.expires_at && new Date(l.expires_at).getTime() <= nowMs) return false;
  return true;
}
