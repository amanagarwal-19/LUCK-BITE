import { useState } from 'react';
import { LogOut, KeyRound, MailCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function AccountPage({ onSignInClick }: { onSignInClick: () => void }) {
  const { user, loading, signOut, sendPasswordReset } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <p className="text-center text-ink-500 py-16 text-sm">Loading your account…</p>;
  }

  if (!user) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto">
        <h2 className="text-xl font-bold text-ink-900 mb-2">Sign in to your account</h2>
        <p className="text-ink-600 text-sm mb-5">
          Create an account or sign in to manage your profile.
        </p>
        <button onClick={onSignInClick} className="btn-primary">Sign in or create account</button>
      </div>
    );
  }

  const fullName: string = user.user_metadata?.full_name ?? '';
  const email = user.email ?? '';
  const initial = (fullName || email).charAt(0).toUpperCase();

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
        <div className="w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center text-2xl font-bold">
          {initial}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink-900 truncate">{fullName || 'Your account'}</h2>
          <p className="text-ink-600 text-sm truncate">{email}</p>
        </div>
      </div>

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
