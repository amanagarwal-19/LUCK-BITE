import { useState } from 'react';
import { Store, ArrowLeft, Building2, User, Mail, Phone, MapPin, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BUSINESS_TYPES } from '@/types';
import Logo from '@/components/Logo';
import type { Business } from '@/types';

export default function BusinessProfileForm({
  onSubmit,
  onBack,
}: {
  onSubmit: (business: Business) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [businessType, setBusinessType] = useState<string>(BUSINESS_TYPES[0]);
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contactName.trim() || !location.trim()) {
      setError('Please fill in business name, contact name, and location.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data, error } = await supabase
      .from('businesses')
      .insert({
        name: name.trim(),
        contact_name: contactName.trim(),
        business_type: businessType,
        location: location.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      .select('*')
      .single();

    if (error || !data) {
      setError('Could not create your business profile. Please try again.');
      setSubmitting(false);
      return;
    }

    onSubmit(data as Business);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-ink-900/5">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-4">
          <button onClick={onBack} className="btn-ghost -ml-2">
            <ArrowLeft size={18} /> <span className="hidden sm:inline">Home</span>
          </button>
          <Logo size="sm" />
          <span className="ml-auto badge bg-ink-900/5 text-ink-600">Business</span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 sm:px-8 py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4 shadow-card">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-2">Create Your Business Profile</h1>
          <p className="text-ink-600 text-sm">
            Set up your business to start listing surplus meal boxes and managing reservations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <Field icon={<Building2 size={18} />} label="Business Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sunrise Bakehouse"
              className="input-field"
              required
            />
          </Field>

          <Field icon={<User size={18} />} label="Contact Name" required>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Mara Costa"
              className="input-field"
              required
            />
          </Field>

          <Field icon={<Tag size={18} />} label="Business Type">
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="input-field"
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field icon={<MapPin size={18} />} label="Location" required>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="12 Harbour Street, Eureka"
              className="input-field"
              required
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-5">
            <Field icon={<Mail size={18} />} label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mara@sunrisebake.co"
                className="input-field"
              />
            </Field>

            <Field icon={<Phone size={18} />} label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07700 900111"
                className="input-field"
              />
            </Field>
          </div>

          {error && (
            <div className="rounded-xl bg-error-100 border border-error-500/20 p-3">
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating profile…' : 'Create Profile & Continue'}
          </button>
          <p className="text-center text-xs text-ink-400">
            Demo prototype — no account or password is required.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  required,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label-field">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-ink-400">{icon}</span>
          {label}
          {required && <span className="text-orange-500">*</span>}
        </span>
      </label>
      {children}
    </div>
  );
}
