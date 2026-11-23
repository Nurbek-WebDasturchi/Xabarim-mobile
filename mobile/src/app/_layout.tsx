import { Stack, router, useSegments } from 'expo-router';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useThemeColors, useThemeMode, type ThemeColors } from '@/components/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { registerPushNotifications } from '@/features/notifications/push-notifications';
import { LanguageProvider , useUiText } from '@/features/i18n/i18n';

export default function RootLayout() {
  return <SafeAreaProvider><LanguageProvider><AuthProvider><RootNavigator /></AuthProvider></LanguageProvider></SafeAreaProvider>;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const palette = useThemeColors();
  const mode = useThemeMode();
  const ui = useUiText();
  const styles = makeStyles(palette);
  const segments = useSegments();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('Yangi versiyani yuklab olib o‘rnatasizmi?');
  const [showLatest, setShowLatest] = useState(false);
  const [manualCheck, setManualCheck] = useState(false);
  const checkInProgress = useRef(false);
  const registeredUser = useRef<string | null>(null);

  useEffect(() => {
    if (!session || registeredUser.current === session.user.id) return;
    registeredUser.current = session.user.id;
    void registerPushNotifications(session).catch(() => { registeredUser.current = null; });
  }, [session]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (typeof data?.url === 'string') router.push(data.url as never);
    });
    return () => subscription.remove();
  }, []);

  const checkForUpdate = useCallback(async (manual = false) => {
    if (__DEV__ || checkInProgress.current || !Updates.isEnabled) return;
    checkInProgress.current = true;
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setUpdateError(false);
        setShowLatest(false);
        setManualCheck(manual);
        setUpdateMessage('Yangi versiyani yuklab olib o‘rnatasizmi?');
        setUpdateAvailable(true);
      } else if (manual) {
        setUpdateError(false);
        setShowLatest(true);
        setManualCheck(true);
        setUpdateMessage('Ilova eng so‘nggi versiyada.');
        setUpdateAvailable(true);
      }
    } catch {
      if (manual) {
        setUpdateError(true);
        setManualCheck(true);
        setUpdateMessage('Yangilanishni tekshirib bo‘lmadi. Internetni tekshirib qayta urinib ko‘ring.');
        setUpdateAvailable(true);
      }
    } finally {
      checkInProgress.current = false;
      setCheckingUpdate(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const onAuthRoute = segments[0] === 'login' || segments[0] === 'register';
    if (!session && !onAuthRoute) router.replace('/register');
    if (session && onAuthRoute) router.replace('/chats');
  }, [session, loading, segments]);

  useEffect(() => {
    const timer = setTimeout(() => { void checkForUpdate(); }, 0);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });
    return () => subscription.remove();
  }, [checkForUpdate]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.type === 'app_update') {
        setUpdateError(false);
        setManualCheck(false);
        setShowLatest(false);
        setUpdateMessage('Yangi versiyani yuklab olib o‘rnatasizmi?');
        setUpdateAvailable(true);
      }
    });
    return () => subscription.remove();
  }, []);

  const applyUpdate = async () => {
    setDownloading(true);
    setUpdateError(false);
    setShowLatest(false);
    setManualCheck(false);
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        await Updates.reloadAsync();
      } else {
        setUpdateAvailable(false);
      }
    } catch {
      setUpdateError(true);
      setUpdateMessage('Yangilash amalga oshmadi. Internetni tekshirib, qayta urinib ko‘ring.');
    } finally {
      setDownloading(false);
    }
  };

  const closeUpdateModal = () => {
    setUpdateAvailable(false);
    setUpdateError(false);
    setUpdateMessage('Yangi versiyani yuklab olib o‘rnatasizmi?');
  };

  return <><StatusBar style={mode === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: styles.screen }}><Stack.Screen name="community/[roomId]" /><Stack.Screen name="wallet" /><Stack.Screen name="privacy" /></Stack>
    <Modal visible={updateAvailable} transparent animationType="fade" onRequestClose={closeUpdateModal}>
      <View style={styles.modalBackdrop}><View style={styles.updateModal}>
        <Text style={styles.updateTitle}>{manualCheck && (showLatest || updateError) ? 'Yangilanish holati' : ui.newVersion}</Text>
        <Text style={styles.updateMessage}>{downloading ? 'Yangilanish yuklab olinmoqda…' : updateMessage}</Text>
        {downloading && <Text style={styles.progressText}>Iltimos, ilovani yopmang.</Text>}
        <View style={styles.modalActions}>
          {manualCheck && !checkingUpdate && !downloading && !updateError && !showLatest && <Pressable accessibilityRole="button" onPress={() => { void checkForUpdate(true); }} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Yangilanishni tekshirish</Text></Pressable>}
          {!downloading && <Pressable accessibilityRole="button" onPress={closeUpdateModal} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Keyinroq</Text></Pressable>}
          {updateError && !downloading && <Pressable accessibilityRole="button" onPress={() => { void checkForUpdate(true); }} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Qayta tekshirish</Text></Pressable>}
          {showLatest && !downloading ? <Pressable accessibilityRole="button" onPress={closeUpdateModal} style={styles.updateButton}><Text style={styles.updateButtonText}>Yopish</Text></Pressable> : !updateError && <Pressable accessibilityRole="button" disabled={downloading || checkingUpdate} onPress={() => { void applyUpdate(); }} style={[styles.updateButton, (downloading || checkingUpdate) && styles.disabledButton]}><Text style={styles.updateButtonText}>{downloading ? 'Yuklanmoqda…' : checkingUpdate ? 'Tekshirilmoqda…' : 'Yangilash'}</Text></Pressable>}
        </View>
      </View></View>
    </Modal>
  </>;
}

const makeStyles = (palette: ThemeColors) => StyleSheet.create({
  screen: { backgroundColor: palette.background },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.55)' }, updateModal: { width: '100%', maxWidth: 420, padding: 22, borderRadius: 22, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: 12 },
  updateTitle: { color: palette.text, fontSize: 20, fontWeight: '700' }, updateMessage: { color: palette.muted, fontSize: 15, lineHeight: 22 }, progressText: { color: palette.muted, fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 8 },
  cancelButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }, cancelButtonText: { color: palette.text, fontWeight: '600' },
  updateButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, updateButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 }, disabledButton: { opacity: 0.65 },
});
