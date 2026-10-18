import { useEffect, useState } from 'react';
import { LogOut, KeyRound, MailCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { cleanPhoneInput, isValidMobile, PHONE_ERROR, dobError, latestBirthDate, GENDER_OPTIONS } from '@/lib/validation';

export default function AccountPage({ onSignInClick }: { onSignInClick: () => void }) {
  const { user, role, loading, signOut, sendPasswordReset } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Load the saved phone number, date of birth and gender
  useEffect(() => {
    if (!user || role === 'business') return;
    supabase
      .from('user_profiles')
      .select('phone,date_of_birth,gender')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPhone(data.phone ?? '');
          setDob(data.date_of_birth ?? '');
          setGender(data.gender ?? '');
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  if (loading) {
    return <p className="text-center text-ink-500 py-16 text-sm">Loading your account…</p>;
  }

  if (!user) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto">
        <h2 className="text-xl font-bold text-ink-900 mb-2">Sign in to your account</h2>
        <p className="text-ink-600 text-sm mb-5">
          Sign in or create an account to view and manage your profile.
        </p>
        <button onClick={onSignInClick} className="btn-primary">Sign in as Customer</button>
      </div>
    );
  }

  const fullName: string = user.user_metadata?.full_name ?? '';
  const email = user.email ?? '';
  const initial = (fullName || email).charAt(0).toUpperCase();

  const handleSaveProfile = async () => {
    setProfileError(null);
    setProfileMessage(null);
    if (role !== 'admin' && !isValidMobile(phone)) return setProfileError(PHONE_ERROR);
    const dError = dobError(dob);
    if (dError) return setProfileError(dError);
    setSavingProfile(true);
    const { error: rpcError } = await supabase.rpc('update_my_profile', {
      p_phone: phone || null,
      p_date_of_birth: dob || null,
      p_gender: gender || null,
    });
    setSavingProfile(false);
    if (rpcError) {
      setProfileError(rpcError.message || 'Could not save your details. Please try again.');
      return;
    }
    setProfileMessage('Your details have been saved.');
  };

  const handleReset = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordReset(email);
      setMessage(`We've sent a password reset link to ${email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset email. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 sm:p-8 max-w-xl">
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-full ${role === 'business' ? 'bg-ink-900' : 'bg-orange-500'} text-white flex items-center justify-center text-2xl font-bold`}>
          {initial}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-ink-900 truncate">{fullName || 'Your account'}</h2>
            <span className={`badge text-xs ${role === 'business' ? 'bg-ink-900 text-white' : 'bg-orange-100 text-orange-700'}`}>
              {role === 'business' ? 'Business Account' : role === 'admin' ? 'Admin' : 'Customer Account'}
            </span>
          </div>
          <p className="text-ink-600 text-sm truncate">{email}</p>
        </div>
      </div>

      {role === 'business' && (
        <div className="mb-6 rounded-xl bg-orange-50 border border-orange-200 p-4 text-sm text-ink-700">
          <p className="font-medium text-orange-800 mb-1">Business Account</p>
          <p className="text-xs text-ink-600">
            This account is registered for business operations. You can manage your restaurant, surplus food listings, and pickup verifications in the Business Portal.
          </p>
        </div>
      )}

      {role !== 'business' && (
        <div className="mb-6 border-t border-ink-900/5 pt-5">
          <h3 className="font-bold text-ink-900 mb-3">Your details</h3>
          <div className="space-y-4">
            <div>
              <label className="label-field">Mobile number</label>
              <div className="flex items-center gap-2">
                <span className="text-ink-600 font-medium">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
                  placeholder="9876543210"
                  className="input-field"
                />
              </div>
              <p className="text-xs text-ink-400 mt-1">10 digits, numbers only.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-field">
                  Date of birth <span className="text-ink-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={dob}
                  max={latestBirthDate()}
                  onChange={(e) => setDob(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">
                  Gender <span className="text-ink-400 font-normal">(optional)</span>
                </label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="input-field">
                  <option value="">Select</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary">
              {savingProfile ? 'Saving…' : 'Save details'}
            </button>
            {profileMessage && <p className="text-sm text-green-600">{profileMessage}</p>}
            {profileError && <p className="text-sm text-error-700">{profileError}</p>}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <button onClick={handleReset} disabled={busy} className="btn-secondary w-full sm:w-auto">
          <KeyRound size={16} /> {busy ? 'Sending…' : 'Reset password'}
        </button>
        <button onClick={() => signOut()} className="btn-secondary w-full sm:w-auto sm:ml-3">
          <LogOut size={16} /> Sign out
        </button>
      </div>

      {message && (
        <p className="mt-4 flex items-start gap-2 text-sm text-green-600">
          <MailCheck size={16} className="mt-0.5 shrink-0" /> {message}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-error-700">{error}</p>}
    </div>
  );
}
