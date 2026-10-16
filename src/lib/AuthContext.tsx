import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  recovering: boolean;
  signUp: (fullName: string, email: string, password: string, role: 'customer' | 'business') => Promise<{ needsVerification: boolean }>;
  signIn: (email: string, password: string, expectedRole?: 'customer' | 'business') => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  finishRecovery: () => void;
  refetchRole: () => Promise<UserRole | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('email not confirmed')) return 'Please verify your email first. Check your inbox for the verification link.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts or emails sent. Please wait a few minutes and try again.';
  if (m.includes('already registered') || m.includes('user already exists')) return 'An account with this email already exists. Please sign in instead.';
  if (m.includes('not authorized')) return 'This email address is not allowed to receive emails yet (email sending is still in test mode).';
  if (m.includes('same password')) return 'Your new password must be different from the old one.';
  return message;
}

async function resolveUserRole(u: User): Promise<UserRole> {
  // 1. FAST PATH (Instant / 0ms): Check user_metadata.role from user object in memory
  if (u.user_metadata?.role && ['customer', 'business', 'admin'].includes(u.user_metadata.role)) {
    return u.user_metadata.role as UserRole;
  }

  // 2. Try secure RPC with a 1200ms timeout
  try {
    const rpcPromise = supabase.rpc('get_user_account_role');
    const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 1200)
    );
    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
    if (!error && data && ['customer', 'business', 'admin'].includes(data)) {
      return data as UserRole;
    }
  } catch {
    // fallback
  }

  // 3. Try user_profiles table with a 1000ms timeout
  try {
    const queryPromise = supabase.from('user_profiles').select('role').eq('id', u.id).maybeSingle();
    const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 1000)
    );
    const { data: profile } = await Promise.race([queryPromise, timeoutPromise]);
    if (profile?.role && ['customer', 'business', 'admin'].includes(profile.role)) {
      return profile.role as UserRole;
    }
  } catch {
    // fallback
  }

  return 'customer';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const syncUserAndRole = useCallback(async (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      try {
        const detectedRole = await resolveUserRole(newUser);
        setRole(detectedRole);
      } catch {
        setRole('customer');
      }
    } else {
      setRole(null);
    }
  }, []);

  const refetchRole = useCallback(async (): Promise<UserRole | null> => {
    if (!user) {
      setRole(null);
      return null;
    }
    const updated = await resolveUserRole(user);
    setRole(updated);
    return updated;
  }, [user]);

  useEffect(() => {
    let active = true;

    // Fail-safe: Under no circumstances should the app be stuck on loading for more than 1.2 seconds
    const safetyTimer = setTimeout(() => {
      if (active) {
        setLoading(false);
      }
    }, 1200);

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (active) {
          await syncUserAndRole(data.session?.user ?? null);
        }
      } catch (err) {
        console.warn('Session init warning:', err);
      } finally {
        if (active) {
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      }
    };

    init();

    // Keep in sync with sign in / sign out / token refresh / password-reset link
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      try {
        await syncUserAndRole(session?.user ?? null);
      } catch (err) {
        console.warn('Auth state change warning:', err);
      } finally {
        if (active) setLoading(false);
      }
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      listener.subscription.unsubscribe();
    };
  }, [syncUserAndRole]);

  const signUp = useCallback(async (
    fullName: string,
    email: string,
    password: string,
    accountRole: 'customer' | 'business'
  ) => {
    const cleanEmail = normalizeEmail(email);
    const cleanName = fullName.trim();

    // 1. Check if email is already taken or associated with the other account type via backend RPC
    try {
      const { data: checkData, error: checkError } = await supabase.rpc('check_account_registration', {
        p_email: cleanEmail,
        p_target_role: accountRole,
      });
      if (!checkError && checkData && checkData.allowed === false) {
        throw new Error(checkData.message);
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('associated with') || err.message.includes('already exists'))) {
        throw err;
      }
    }

    // 2. Perform Supabase signup
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          role: accountRole,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes('already registered') || m.includes('user already exists')) {
        // Look up if this email is registered under the other role to provide the clear required message
        try {
          const { data: checkData } = await supabase.rpc('check_account_registration', {
            p_email: cleanEmail,
            p_target_role: accountRole,
          });
          if (checkData && checkData.allowed === false) {
            throw new Error(checkData.message);
          }
        } catch (inner) {
          if (inner instanceof Error) throw inner;
        }
      }
      throw new Error(friendlyError(error.message));
    }

    // Supabase returns a user with no identities when the email is already registered
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      try {
        const { data: checkData } = await supabase.rpc('check_account_registration', {
          p_email: cleanEmail,
          p_target_role: accountRole,
        });
        if (checkData && checkData.allowed === false) {
          throw new Error(checkData.message);
        }
      } catch (inner) {
        if (inner instanceof Error) throw inner;
      }
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    if (data.user) {
      setRole(accountRole);
    }

    return { needsVerification: !data.session };
  }, []);

  const signIn = useCallback(async (
    email: string,
    password: string,
    expectedRole?: 'customer' | 'business'
  ) => {
    const cleanEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) throw new Error(friendlyError(error.message));

    const signedInUser = data.user;
    if (!signedInUser) return;

    if (expectedRole) {
      let resolvedRole: UserRole | null = null;
      try {
        const { data: valData, error: valError } = await supabase.rpc('validate_login_role', {
          p_expected_role: expectedRole,
        });
        if (!valError && valData) {
          if (!valData.valid) {
            await supabase.auth.signOut();
            setRole(null);
            throw new Error(valData.error);
          }
          resolvedRole = valData.role as UserRole;
        }
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('registered as a') || err.message.includes('Account type mismatch'))) {
          throw err;
        }
      }

      // Fallback role validation if RPC is not yet created
      if (!resolvedRole) {
        resolvedRole = await resolveUserRole(signedInUser);
        if (resolvedRole !== 'admin' && resolvedRole !== expectedRole) {
          await supabase.auth.signOut();
          setRole(null);
          if (resolvedRole === 'customer') {
            throw new Error('This account is registered as a Customer. Please use the Customer login.');
          } else if (resolvedRole === 'business') {
            throw new Error('This account is registered as a Business. Please use the Business portal to sign in.');
          } else {
            throw new Error('Account type mismatch. Please sign in through the correct portal.');
          }
        }
      }

      setRole(resolvedRole);
    } else {
      const resolvedRole = await resolveUserRole(signedInUser);
      setRole(resolvedRole);
    }
  }, []);

  const signOut = useCallback(async () => {
    setRole(null);
    await supabase.auth.signOut();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const cleanEmail = normalizeEmail(email);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });
    if (error) throw new Error(friendlyError(error.message));
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(friendlyError(error.message));
  }, []);

  const finishRecovery = useCallback(() => setRecovering(false), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        recovering,
        signUp,
        signIn,
        signOut,
        sendPasswordReset,
        updatePassword,
        finishRecovery,
        refetchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

