import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

const APP_URL = 'https://www.xabarim.uz/pages/app.html';
const BRAND = '#654dff';
const EAS_PROJECT_ID = '58c7c926-0fd6-48a0-8898-f150ecf4f446';
const NOTIFICATION_CHANNEL = 'messages';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
      name: 'Xabarim xabarlari',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: BRAND,
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;
    const response = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    if (!response.data) throw new Error('Expo push token was empty');
  return response.data;
}

export default function App() {
  const webView = useRef<WebView<{}>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [webReady, setWebReady] = useState(false);

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then(setPushToken)
      .catch((error) => console.warn('Push notification registration failed', error));
    const received = Notifications.addNotificationReceivedListener(() => {});
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const url = event.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('https://www.xabarim.uz/')) {
        webView.current?.injectJavaScript(`location.href=${JSON.stringify(url)}; true;`);
      }
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, []);

  const injectPushToken = useCallback((token: string) => {
    webView.current?.injectJavaScript(
      `window.XABARIM_NATIVE_PUSH_TOKEN=${JSON.stringify(token)};window.dispatchEvent(new Event('xabarim-native-push-token'));true;`,
    );
  }, []);

  useEffect(() => {
    if (webReady && pushToken) injectPushToken(pushToken);
  }, [injectPushToken, pushToken, webReady]);

  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    setCanGoBack(state.canGoBack);
    setLoading(state.loading);
    if (state.url.startsWith('https://www.xabarim.uz/')) setFailed(false);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webView.current?.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <WebView<{}>
          ref={webView}
          source={{ uri: APP_URL }}
          style={styles.webView}
          onNavigationStateChange={onNavigationStateChange}
          onLoadStart={() => {
            setLoading(true);
            setFailed(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (message?.type === 'xabarim-web-ready') setWebReady(true);
            } catch {}
          }}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) setFailed(true);
          }}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          originWhitelist={['https://*', 'http://*']}
          applicationNameForUserAgent="XabarimAndroid"
          pullToRefreshEnabled
          bounces={false}
          renderLoading={() => <Loading />}
          startInLoadingState
        />
        {loading && !failed ? (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={BRAND} />
          </View>
        ) : null}
        {failed ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.logo}>Xabarim</Text>
            <Text style={styles.errorTitle}>Ulanish amalga oshmadi</Text>
            <Text style={styles.errorText}>Internet aloqasini tekshirib, qayta urinib ko‘ring.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFailed(false);
                setLoading(true);
                webView.current?.reload();
              }}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Qayta urinish</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Loading() {
  return (
    <View style={styles.initialLoading}>
      <ActivityIndicator size="large" color={BRAND} />
      <Text style={styles.loadingText}>Xabarim yuklanmoqda…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: '#ffffff' },
  webView: { flex: 1, backgroundColor: '#ffffff' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    alignItems: 'center',
    backgroundColor: 'rgba(101, 77, 255, 0.10)',
  },
  initialLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
  },
  loadingText: { color: '#6b7280', fontSize: 15 },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
  },
  logo: { color: BRAND, fontSize: 27, fontWeight: '800', marginBottom: 22 },
  errorTitle: { color: '#151522', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  errorText: { color: '#686879', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  retryButton: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: BRAND,
  },
  retryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.82 },
});
