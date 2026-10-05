import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { Context } from '../lib/types';

export interface AuthValue {
  session: Session | null;
  ready: boolean;
  context: Context | null;
  contextError: string | null;
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [context, setContext] = useState<Context | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setContext(await api.me());
      setContextError(null);
    } catch (e) {
      setContextError(e instanceof Error ? e.message : 'Could not load your account.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) void refresh();
    else setContext(null);
  }, [session, refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      ready,
      context,
      contextError,
      refresh,
      // Identity only: no repository scopes are requested (spec §7.1).
      signIn: async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
        });
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, ready, context, contextError, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
