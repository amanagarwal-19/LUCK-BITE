import { useEffect, useState } from 'react';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import Modal from '@/components/Modal';
import { useAuth } from '@/lib/AuthContext';
import { cleanPhoneInput, isValidMobile, PHONE_ERROR, dobError, latestBirthDate, GENDER_OPTIONS } from '@/lib/validation';

type Mode = 'signin' | 'signup' | 'forgot' | 'verify' | 'resetSent' | 'recovery' | 'recoveryDone';

const TITLES: Record<Mode, string> = {
  signin: 'Sign in',
  signup: 'Create your account',
  forgot: 'Reset your password',
  verify: 'Verify your email',
  resetSent: 'Check your email',
  recovery: 'Set a new password',
  recoveryDone: 'Password updated',
};

export default function AuthModal({
  open,
  onClose,
  initialMode = 'signin',
  role = 'customer',
  onOpenTerms,
}: {
  onOpenTerms?: () => void;
  open: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  role?: 'customer' | 'business';
}) {
  const { signIn, signUp, sendPasswordReset, updatePassword, recovering, finishRecovery } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setPassword('');
      setShowPassword(false);
      setPhone('');
      setDob('');
      setGender('');
    }
  }, [open, initialMode]);

  // When the user arrives from a password-reset email link, show the "new password" form
  const activeMode: Mode = recovering && mode !== 'recoveryDone' ? 'recovery' : mode;
  const isOpen = open || recovering || mode === 'recoveryDone';

  const goTo = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const handleClose = () => {
    if (recovering) finishRecovery();
    if (mode === 'recoveryDone') setMode('signin');
    onClose();
  };

  const validEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

  const getTitle = () => {
    if (activeMode === 'signin') {
      return role === 'business' ? 'Business sign in' : 'Customer sign in';
    }
    if (activeMode === 'signup') {
      return role === 'business' ? 'Create a business account' : 'Create your customer account';
    }
    return TITLES[activeMode];
  };

  const handleSubmit = async () => {
    setError(null);

    if (activeMode === 'signup' && !fullName.trim()) return setError('Please enter your full name.');
    if (activeMode === 'signup' && role === 'customer') {
      if (!isValidMobile(phone)) return setError(PHONE_ERROR);
      const dError = dobError(dob);
      if (dError) return setError(dError);
    }
    if (activeMode !== 'recovery' && !validEmail(email)) return setError('Please enter a valid email address.');
    if ((activeMode === 'signup' || activeMode === 'recovery') && password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }
    if (activeMode === 'signin' && !password) return setError('Please enter your password.');

    setBusy(true);
    try {
      if (activeMode === 'signin') {
        await signIn(email.trim(), password, role);
        handleClose();
      } else if (activeMode === 'signup') {
        const { needsVerification } = await signUp(
          fullName.trim(),
          email.trim(),
          password,
          role,
          role === 'customer' ? { phone, dateOfBirth: dob || undefined, gender: gender || undefined } : undefined
        );
        if (needsVerification) goTo('verify');
        else handleClose();
      } else if (activeMode === 'forgot') {
        await sendPasswordReset(email.trim());
        goTo('resetSent');
      } else if (activeMode === 'recovery') {
        await updatePassword(password);
        finishRecovery();
        setPassword('');
        setMode('recoveryDone');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !busy) handleSubmit();
  };

  const passwordField = (label: string, autoComplete: string) => (
    <div>
      <label className="label-field">{label}</label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onEnter}
          autoComplete={autoComplete}
          placeholder={activeMode === 'signin' ? 'Your password' : 'At least 8 characters'}
          className="input-field pr-12"
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  const emailField = (
    <div>
      <label className="label-field">Email address</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={onEnter}
        autoComplete="email"
        placeholder="you@example.com"
        className="input-field"
      />
    </div>
  );

  const errorBox = error && (
    <div className="rounded-xl bg-error-100 border border-error-500/20 text-error-700 text-sm px-4 py-3">{error}</div>
  );

  return (
    <Modal open={isOpen} onClose={handleClose} title={getTitle()} size="sm">
      <div className="mb-4 flex items-center justify-between pb-1 border-b border-ink-900/5">
        <span className={`badge ${role === 'business' ? 'bg-ink-900 text-cream-100' : 'bg-orange-100 text-orange-700'}`}>
          {role === 'business' ? 'Business Portal' : 'Customer Account'}
        </span>
        <span className="text-xs text-ink-500">
          {role === 'business' ? 'For restaurants & stores' : 'For food rescue & pickups'}
        </span>
      </div>

      {activeMode === 'signin' && (
        <div className="space-y-4">
          {emailField}
          {passwordField('Password', 'current-password')}
          <div className="text-right -mt-2">
            <button onClick={() => goTo('forgot')} className="text-sm font-medium text-orange-600 hover:underline">
              Forgot password?
            </button>
          </div>
          {errorBox}
          <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full">
            {busy ? 'Signing in…' : `Sign in as ${role === 'business' ? 'Business' : 'Customer'}`}
          </button>
          <p className="text-sm text-center text-ink-600">
            New here?{' '}
            <button onClick={() => goTo('signup')} className="font-semibold text-orange-600 hover:underline">
              {role === 'business' ? 'Create a business account' : 'Create a customer account'}
            </button>
          </p>
        </div>
      )}

      {activeMode === 'signup' && (
        <div className="space-y-4">
          <div>
            <label className="label-field">{role === 'business' ? 'Contact person name' : 'Full name'}</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onKeyDown={onEnter}
              autoComplete="name"
              placeholder={role === 'business' ? 'e.g. John Doe (Manager)' : 'Your full name'}
              className="input-field"
            />
          </div>
          {emailField}
          {role === 'customer' && (
            <>
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
                    onKeyDown={onEnter}
                    autoComplete="tel-national"
                    placeholder="9876543210"
                    className="input-field"
                  />
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  10 digits, numbers only. Businesses use it to reach you about your pickup.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
            </>
          )}
          {passwordField('Password', 'new-password')}
          <p className="text-xs text-ink-500">
            By creating an account you agree to the{' '}
            {onOpenTerms ? (
              <button type="button" onClick={onOpenTerms} className="font-semibold text-orange-600 hover:underline">
                Terms & Privacy Policy
              </button>
            ) : (
              'Terms & Privacy Policy'
            )}
            .
          </p>
          {errorBox}
          <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full">
            {busy ? 'Creating account…' : `Create ${role === 'business' ? 'Business' : 'Customer'} Account`}
          </button>
          <p className="text-sm text-center text-ink-600">
            Already have an account?{' '}
            <button onClick={() => goTo('signin')} className="font-semibold text-orange-600 hover:underline">
              Sign in
            </button>
          </p>
        </div>
      )}

      {activeMode === 'forgot' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">Enter your email and we'll send you a link to set a new password.</p>
          {emailField}
          {errorBox}
          <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-sm text-center">
            <button onClick={() => goTo('signin')} className="font-semibold text-orange-600 hover:underline">
              Back to sign in
            </button>
          </p>
        </div>
      )}

      {(activeMode === 'verify' || activeMode === 'resetSent') && (
        <div className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
            <MailCheck size={28} className="text-orange-600" />
          </div>
          <p className="text-ink-700">
            {activeMode === 'verify'
              ? <>We've sent a verification link to <strong>{email}</strong>. Click it to finish creating your account.</>
              : <>If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.</>}
          </p>
          <p className="text-xs text-ink-500">Can't see it? Check your spam folder.</p>
          <button onClick={() => goTo('signin')} className="btn-secondary w-full">Back to sign in</button>
        </div>
      )}

      {activeMode === 'recovery' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">Choose a new password for your account.</p>
          {passwordField('New password', 'new-password')}
          {errorBox}
          <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full">
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </div>
      )}

      {activeMode === 'recoveryDone' && (
        <div className="text-center space-y-4">
          <p className="text-ink-700">Your password has been updated. You're signed in.</p>
          <button onClick={handleClose} className="btn-primary w-full">Continue</button>
        </div>
      )}
    </Modal>
  );
}
