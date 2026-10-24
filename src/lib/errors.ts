// Turns a database error into a message that is safe to show people.
// The full details (code, message, hint) are only ever printed to the browser console while developing.

interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

export function friendlyListingError(error: DbErrorLike): string {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();

  // No connection to the server
  if (!code && (message.includes('failed to fetch') || message.includes('network'))) {
    return "We couldn't reach the server. Please check your internet connection and try again.";
  }
  // The database refused it for this account (not signed in, or business not verified)
  if (code === '42501' || code === 'PGRST301' || message.includes('row-level security')) {
    return "We couldn't save this listing. Please make sure you are signed in and your business is verified.";
  }
  // A rule on the data was broken (for example the discounted price is higher than the original)
  if (code === '23514') {
    return 'Please check the prices and quantity. The discounted price cannot be higher than the original price.';
  }
  // A required value is missing or in the wrong format
  if (code === '23502' || code === '22P02' || code === '22007' || code === '22001') {
    return 'Some details are missing or not valid. Please check the form and try again.';
  }
  return 'Could not save the listing. Please try again.';
}
