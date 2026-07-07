import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  bootstrapUserProfile,
  signInWithEmailPassword,
  signOut as authSignOut,
  signUpWithEmailPassword,
} from '@/lib/auth';
import { invalidateTravelUserPreferencesCache } from '@/lib/travel-user-preferences';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getUserId: () => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionsEqual(previous: Session | null, next: Session | null): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return previous.access_token === next.access_token && previous.user?.id === next.user?.id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading((prev) => (prev ? false : prev));
      return;
    }

    const supabase = getSupabase();
    let isActive = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isActive) return;

      setSession((prev) => (sessionsEqual(prev, nextSession) ? prev : nextSession));
      console.log('[Auth] session loaded', nextSession?.user?.id ?? null);

      if (nextSession?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        await bootstrapUserProfile(nextSession.user);
      }

      if (event === 'SIGNED_OUT') {
        invalidateTravelUserPreferencesCache();
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setIsLoading((prev) => (prev ? false : prev));
      }
    });

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isActive) return;
      setSession((prev) => (sessionsEqual(prev, currentSession) ? prev : currentSession));
      console.log('[Auth] session loaded', currentSession?.user?.id ?? null);
      setIsLoading((prev) => (prev ? false : prev));
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailPassword(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await signUpWithEmailPassword(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    invalidateTravelUserPreferencesCache();
  }, []);

  const getUserId = useCallback(() => session?.user?.id ?? null, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isLoggedIn: Boolean(session?.user),
      isConfigured,
      signIn,
      signUp,
      signOut,
      getUserId,
    }),
    [session, isLoading, isConfigured, signIn, signUp, signOut, getUserId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth は AuthProvider 内で使用してください');
  }
  return context;
}
