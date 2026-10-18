// Shared checks for phone numbers, dates of birth and gender.

// Indian mobile numbers: exactly 10 digits, starting with 6, 7, 8 or 9
export const MOBILE_REGEX = /^[6-9][0-9]{9}$/;
export const MIN_AGE = 18;

export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

// Keeps only digits (so letters and symbols can't be typed), max 10
export function cleanPhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function isValidMobile(value: string): boolean {
  return MOBILE_REGEX.test(value);
}

export const PHONE_ERROR = 'Please enter a valid 10-digit mobile number (digits only, starting with 6, 7, 8 or 9).';

// Latest date of birth allowed (someone who turned MIN_AGE today), as YYYY-MM-DD
export function latestBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE);
  return d.toISOString().slice(0, 10);
}

// Returns an error message, or null if the date of birth is empty or acceptable
export function dobError(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    return 'Please enter a valid date of birth.';
  }
  if (value < '1900-01-01') return 'Please enter a valid date of birth.';
  if (value > latestBirthDate()) return `You must be at least ${MIN_AGE} years old to use Luck Bite.`;
  return null;
}
