import { useSyncExternalStore } from 'react';

export type ThemeColors = {
  background: string; surface: string; raised: string; border: string; blue: string; blueDark: string;
  text: string; muted: string; dim: string; red: string; green: string;
};

export const darkColors: ThemeColors = {
  background: '#0B1423', surface: '#101C2E', raised: '#142239', border: '#263650',
  blue: '#1877F2', blueDark: '#1168DD', text: '#F3F6FC', muted: '#9AAAC0', dim: '#71829A',
  red: '#F04467', green: '#63C6A4',
};
export const lightColors: ThemeColors = {
  background: '#F2F5FA', surface: '#FFFFFF', raised: '#E8EEF7', border: '#D7E0ED',
  blue: '#1877F2', blueDark: '#1168DD', text: '#172338', muted: '#52647D', dim: '#73839A',
  red: '#D92950', green: '#16835F',
};
export const colors = darkColors;

let mode: 'dark' | 'light' = 'dark';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getThemeMode = () => mode;
export function toggleTheme() {
  mode = mode === 'dark' ? 'light' : 'dark';
  listeners.forEach((listener) => listener());
}
export function useThemeMode() { return useSyncExternalStore(subscribe, () => mode, () => mode); }
export function useThemeColors() { return useThemeMode() === 'dark' ? darkColors : lightColors; }
