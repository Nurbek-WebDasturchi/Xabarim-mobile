import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useCallback, useEffect, useState } from 'react';
import { useThemeColors, useThemeMode, type ThemeColors } from '@/components/theme';
import { router, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';

export default function RootLayout() {
  return <SafeAreaProvider><AuthProvider><RootNavigator /></AuthProvider></SafeAreaProvider>;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const palette = useThemeColors();
  const mode = useThemeMode();
  const styles = makeStyles(palette);
  const segments = useSegments();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateError, setUpdateError] = useState(false);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || Updates.isEmbeddedLaunch) return;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) setUpdateAvailable(true);
    } catch {
      // Keep app startup available when the update service is offline.
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const onAuthRoute = segments[0] === 'login' || segments[0] === 'register';
    if (!session && !onAuthRoute) router.replace('/login');
    if (session && onAuthRoute) router.replace('/chats');
  }, [session, loading, segments]);

  useEffect(() => {
    void checkForUpdate();
  }, [checkForUpdate]);

  const applyUpdate = async () => {
    setDownloading(true);
    setUpdateError(false);
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) await Updates.reloadAsync();
      setUpdateAvailable(false);
    } catch {
      setUpdateError(true);
    } finally {
      setDownloading(false);
    }
  };

  return <><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: styles.screen }}><Stack.Screen name="community/[roomId]" /></Stack>
    {updateAvailable && <View style={styles.updateBanner}>
      <View style={styles.updateCopy}><Text style={styles.updateTitle}>Yangi versiya mavjud</Text><Text style={styles.updateMessage}>{updateError ? 'Yangilash amalga oshmadi. Qayta urinib ko‘ring.' : 'Ilovani yangilash uchun bosing.'}</Text></View>
      <Pressable accessibilityRole="button" disabled={downloading} onPress={applyUpdate} style={styles.updateButton}>
        {downloading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.updateButtonText}>Yangilash</Text>}
      </Pressable>
      {updateError && <Pressable accessibilityRole="button" accessibilityLabel="Yangilanishlarni qayta tekshirish" onPress={() => { void checkForUpdate(); }} style={styles.retryButton}><Text style={styles.retryText}>↻</Text></Pressable>}
    </View>}
  </>;
}

const makeStyles = (palette: ThemeColors) => StyleSheet.create({
  screen: { backgroundColor: palette.background },
  updateBanner: { position: 'absolute', left: 12, right: 12, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  updateCopy: { flex: 1, gap: 3 }, updateTitle: { color: palette.text, fontSize: 15, fontWeight: '700' }, updateMessage: { color: palette.muted, fontSize: 12 },
  updateButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 11, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, updateButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 }, retryButton: { paddingHorizontal: 2 }, retryText: { color: palette.blue, fontSize: 24 },
});
