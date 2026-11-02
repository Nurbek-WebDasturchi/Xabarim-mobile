import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';
import { hasSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : secureStorage,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
        persistSession: false,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;
