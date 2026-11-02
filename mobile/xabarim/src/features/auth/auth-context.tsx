import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  last_seen: string | null;
};

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfile(null); return; }
    const { data, error } = await supabase.from('profiles').select('id,username,full_name,avatar_url,bio,last_seen').eq('id', user.id).single();
    if (error) throw error;
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        try { await refreshProfile(); } catch { setProfile(null); }
      }
      if (active) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setProfile(null);
      else queueMicrotask(() => { void refreshProfile().catch(() => setProfile(null)); });
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [refreshProfile]);

  const signIn = useCallback(async (username: string, password: string) => {
    if (!supabase) throw new Error('Ilova Supabase bilan sozlanmagan.');
    const { error } = await supabase.auth.signInWithPassword({ email: `${username.trim().toLowerCase()}@xabarim.uz`, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (username: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Ilova Supabase bilan sozlanmagan.');
    const normalized = username.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: `${normalized}@xabarim.uz`, password,
      options: { data: { username: normalized, full_name: fullName.trim() } },
    });
    if (error) throw error;
    if (!data.session) throw new Error('Hisob yaratildi. Kirish uchun emailingizni tasdiqlang yoki Supabase’da email tasdiqlashni o‘chiring.');
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(() => ({ session, user: session?.user ?? null, profile, loading, refreshProfile, signIn, signUp, signOut }), [session, profile, loading, refreshProfile, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
