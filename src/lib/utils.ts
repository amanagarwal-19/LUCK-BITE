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

