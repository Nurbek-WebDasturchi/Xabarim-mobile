import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useEffect } from 'react';
import { useThemeColors, useThemeMode, type ThemeColors } from '@/components/theme';
import { router, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><RootNavigator /></AuthProvider></SafeAreaProvider>;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const palette = useThemeColors();
  const mode = useThemeMode();
  const styles = makeStyles(palette);
  const segments = useSegments();
  useEffect(() => {
    if (loading) return;
    const onAuthRoute = segments[0] === 'login' || segments[0] === 'register';
    if (!session && !onAuthRoute) router.replace('/login');
    if (session && onAuthRoute) router.replace('/chats');
  }, [session, loading, segments]);
  return <><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: styles.screen }} /></>;
}

const makeStyles = (palette: ThemeColors) => StyleSheet.create({ screen: { backgroundColor: palette.background } });
