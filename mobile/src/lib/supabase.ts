import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let supabase: SupabaseClient | null = null;
let initializing: Promise<SupabaseClient | null> | null = null;

export async function initializeSupabase(): Promise<SupabaseClient | null> {
  if (supabase) return supabase;
  if (initializing) return initializing;
  initializing = (async () => {
    let url = SUPABASE_URL;
    let key = SUPABASE_ANON_KEY;
    if (!url || !key) {
      const response = await fetch('https://www.xabarim.uz/config.js');
      if (!response.ok) throw new Error('Xabarim serveridan sozlamalarni olib bo‘lmadi.');
      const script = await response.text();
      const match = script.match(/window\.XABARIM_CONFIG\s*=\s*(\{[^;]+\})\s*;/);
      if (!match) throw new Error('Server Supabase sozlamalarini bermadi.');
      const config = JSON.parse(match[1]) as { url?: string; anonKey?: string };
      url = config.url ?? '';
      key = config.anonKey ?? '';
    }
    if (!url || !key) throw new Error('Supabase sozlamalari topilmadi.');
    supabase = createClient(url, key, {
      auth: { storage: secureStorage, autoRefreshToken: true, detectSessionInUrl: false, persistSession: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    return supabase;
  })();
  try { return await initializing; }
  finally { initializing = null; }
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase hali ishga tushmagan.');
  return supabase;
}
