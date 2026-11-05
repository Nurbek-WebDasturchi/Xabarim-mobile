import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export function useAsyncStorage<T extends string>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => { let active = true; void SecureStore.getItemAsync(key).then((stored) => { if (active && stored) setValue(stored as T); }).catch(() => {}); return () => { active = false; }; }, [key]);
  const update = (next: T) => { setValue(next); void SecureStore.setItemAsync(key, next).catch(() => {}); };
  return [value, update];
}
