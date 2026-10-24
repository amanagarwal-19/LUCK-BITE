import { useRef, useState } from 'react';
import { Store, ArrowLeft, Building2, User, Mail, Phone, MapPin, Tag, FileCheck, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { BUSINESS_TYPES } from '@/types';
import LocationPicker from '@/components/LocationPicker';
import PhoneInput from '@/components/PhoneInput';
import type { PickedLocation } from '@/components/LocationPicker';
import Logo from '@/components/Logo';

const MAX_DOC_MB = 5;
const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default function BusinessProfileForm({
  onSubmitted,
  onBack,
}: {
  onSubmitted: () => void;
  onBack: () => void;
}) {
  const { user, role } = useAuth();
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState(
    (user?.user_metadata?.full_name as string | undefined) ?? ''
  );
  const [businessType, setBusinessType] = useState<string>(BUSINESS_TYPES[0]);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [licence, setLicence] = useState('');
  const [doc, setDoc] = useState<File | null>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      setError('Please upload a PDF, JPG, PNG or WebP file.');
      return;
    }
    if (file.size > MAX_DOC_MB * 1024 * 1024) {
      setError(`The document is too large. Please upload a file under ${MAX_DOC_MB} MB.`);
      return;
    }
    setError(null);
    setDoc(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in first.');
      return;
    }
    if (role === 'customer') {
      setError('Only Business accounts can register a business.');
      return;
    }
    if (!name.trim() || !contactName.trim()) {
      setError('Please fill in business name and contact name.');
      return;
    }
    if (!picked) {
      setError('Please search for your business on the map, or tap the map to place the pin on it.');
      return;
    }
    if (picked.address.trim().length < 3) {
      setError('Please add your business address under the map.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!/^[6-9][0-9]{9}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number (digits only, starting with 6, 7, 8 or 9).');
      return;
    }
    setSubmitting(true);
    setError(null);

    // The certificate is optional: only upload it if one was chosen
    let path: string | null = null;
    if (doc) {
      const safeName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('verification-docs')
        .upload(path, doc, { contentType: doc.type });
      if (uploadError) {
        setError('Could not upload your document. Please try again.');
        setSubmitting(false);
        return;
      }
    }

    const { error: rpcError } = await supabase.rpc('register_business', {
      p_name: name.trim(),
      p_contact_name: contactName.trim(),
      p_business_type: businessType,
      p_location: picked.address,
      p_latitude: picked.lat,
      p_longitude: picked.lng,
      p_place_id: picked.placeId,
      p_email: email.trim(),
      p_phone: phone.trim(),
      p_licence_number: licence.trim() || null,
      p_evidence_path: path,
    });

    if (rpcError) {
      setError(rpcError.message || 'Could not submit your registration. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-cream-100">
        <Header onBack={onBack} />
        <div className="max-w-md mx-auto px-5 sm:px-8 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
            <FileCheck size={34} className="text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 mb-2">Registration submitted</h1>
          <p className="text-ink-600 text-sm mb-6">
            Your business is now <strong>pending verification</strong>. An administrator will review your details and
            document. You can start listing food as soon as it is approved.
          </p>
          <button onClick={onSubmitted} className="btn-primary">Back to my businesses</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <Header onBack={onBack} />

      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-ink-900 flex items-center justify-center mx-auto mb-4 shadow-card">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-2">Register Your Business</h1>
          <p className="text-ink-600 text-sm">
            We verify every business before it can list food. Your registration will start as
            "Pending verification".
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-5 sm:p-6 space-y-7">
          <section className="space-y-5">
            <SectionTitle step={1}>Business details</SectionTitle>
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

            <div className="grid sm:grid-cols-2 gap-5">
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
            </div>
          </section>

          <section className="space-y-5 pt-6 border-t border-ink-900/5">
            <SectionTitle step={2}>Location</SectionTitle>
            <Field icon={<MapPin size={18} />} label="Business Location" required>
              <LocationPicker
                value={picked}
                onChange={(v) => {
                  setPicked(v);
                  if (!name.trim() && v.name) setName(v.name);
                }}
              />
            </Field>
          </section>

          <section className="space-y-5 pt-6 border-t border-ink-900/5">
            <SectionTitle step={3}>Contact details</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field icon={<Mail size={18} />} label="Business Email" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mara@sunrisebake.co"
                  className="input-field"
                  required
                />
              </Field>

              <Field icon={<Phone size={18} />} label="Mobile Number" required>
                <PhoneInput value={phone} onChange={setPhone} />
                <p className="text-xs text-ink-400 mt-1.5">10 digits, numbers only</p>
              </Field>
            </div>
          </section>

          <section className="pt-6 border-t border-ink-900/5">
            <SectionTitle step={4}>Verification <span className="font-normal text-ink-400">(optional)</span></SectionTitle>
            <p className="text-xs text-ink-500 mt-1 mb-5">
              Only the administrator can see these. Adding your FSSAI details helps us verify your business faster.
            </p>

            <Field icon={<FileCheck size={18} />} label="FSSAI Licence Number">
              <input
                type="text"
                value={licence}
                onChange={(e) => setLicence(e.target.value)}
                placeholder="e.g. 14-digit FSSAI number"
                className="input-field"
              />
            </Field>

            <div className="mt-5">
              <label className="label-field">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-ink-400"><Upload size={18} /></span>
                  FSSAI certificate or proof of authorization
                </span>
              </label>
              <button
                type="button"
                onClick={() => docInput.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-ink-900/15 py-5 px-4 text-center text-ink-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
              >
                {doc ? (
                  <span className="text-sm font-medium text-ink-800 break-all">{doc.name}</span>
                ) : (
                  <>
                    <span className="block text-sm font-medium">Click to upload a document (optional)</span>
                    <span className="block text-xs text-ink-400 mt-0.5">
                      FSSAI certificate, business licence or authorization letter. PDF, JPG, PNG or WebP, up to 5 MB.
                    </span>
                  </>
                )}
              </button>
              <input
                ref={docInput}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleDocChange}
                className="hidden"
              />
            </div>
          </section>

          {error && (
            <div className="rounded-xl bg-error-100 border border-error-500/20 p-3">
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}

          <div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </button>
            <p className="text-center text-xs text-ink-400 mt-3">
              Your business starts as "Pending verification" until an administrator reviews it.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-ink-900/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-4">
        <button onClick={onBack} className="btn-ghost -ml-2">
          <ArrowLeft size={18} /> <span className="hidden sm:inline">Back</span>
        </button>
        <Logo size="sm" />
        <span className="ml-auto badge bg-ink-900/5 text-ink-600">Business</span>
      </div>
    </header>
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

function SectionTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-bold text-ink-900">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
        {step}
      </span>
      <span>{children}</span>
    </h2>
  );
}
