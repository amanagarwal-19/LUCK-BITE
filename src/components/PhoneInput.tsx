import { cleanPhoneInput } from '@/lib/validation';

// Mobile number field: a fixed "+91" prefix and a digits-only input, styled like the other form fields.
export default function PhoneInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (digits: string) => void;
  id?: string;
}) {
  return (
    <div className="flex w-full rounded-xl border border-ink-900/10 bg-cream-50 transition-colors focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-200">
      <span className="flex items-center rounded-l-xl border-r border-ink-900/10 bg-cream-100 px-3.5 font-medium text-ink-600 select-none">
        +91
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        value={value}
        onChange={(e) => onChange(cleanPhoneInput(e.target.value))}
        placeholder="9876543210"
        className="w-full min-w-0 rounded-r-xl bg-transparent px-4 py-3 text-ink-900 placeholder-ink-400 focus:outline-none"
      />
    </div>
  );
}
