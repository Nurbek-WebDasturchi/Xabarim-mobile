import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

const API_URL = 'https://www.xabarim.uz';
const CHANNEL_ID = 'xabarim-alerts-v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushNotifications(session: Session) {
  if (!Device.isDevice || Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Xabarim bildirishnomalari',
      description: 'Xabarlar, yoqtirishlar va yangi kuzatuvchilar',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: '#5848E8',
      sound: 'default',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await fetch(`${API_URL}/api/push/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
}

export async function sendActivityPush(sessionToken: string, recipient: string, kind: 'like' | 'follow') {
  try {
    await fetch(`${API_URL}/api/push/activity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient, kind }),
    });
  } catch {
    // Activity updates are already saved; push delivery must not undo them.
  }
}

