import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppHeader } from '@/components/app-header';
import { AppNav } from '@/components/app-nav';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { useAuth } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase';

type Notification = { id: number; actor: string; kind: 'follow' | 'like' | 'comment' | 'xcoin' | 'mention'; post_id: number | null; body: string | null; created_at: string; read_at: string | null; actor_profile?: { username: string; full_name: string | null } | null };

export default function NotificationsScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, session, loading } = useAuth();
  const [rows, setRows] = useState<Notification[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: loadError } = await getSupabaseClient().from('notifications').select('id,actor,kind,post_id,body,created_at,read_at,actor_profile:profiles!notifications_actor_fkey(username,full_name)').eq('recipient', user.id).order('created_at', { ascending: false }).limit(100);
    if (loadError) setError('Bildirishnomalarni yuklab bo‘lmadi.');
    else { setRows((data ?? []) as unknown as Notification[]); setError(''); }
    setBusy(false); setRefreshing(false);
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  if (!loading && !session) return <Redirect href="/login" />;
  const open = async (item: Notification) => {
    if (!item.read_at) {
      const now = new Date().toISOString();
      setRows((current) => current.map((row) => row.id === item.id ? { ...row, read_at: now } : row));
      await getSupabaseClient().from('notifications').update({ read_at: now }).eq('id', item.id);
    }
    if (item.kind === 'follow') router.push({ pathname: '/profile', params: { userId: item.actor } });
    else if (item.post_id) router.push('/feed');
  };
  const description = (item: Notification) => {
    const name = item.actor_profile?.full_name || (item.actor_profile?.username ? `@${item.actor_profile.username}` : 'Foydalanuvchi');
    if (item.kind === 'follow') return `${name} sizga obuna bo‘ldi`;
    if (item.kind === 'like') return `${name} postingizga yoqdi bildirdi`;
    if (item.kind === 'comment') return `${name} postingizga izoh yozdi${item.body ? `: ${item.body}` : ''}`;
    if (item.kind === 'mention') return `${name} sizni tilga oldi${item.body ? `: ${item.body}` : ''}`;
    return `${item.body || 'XCoin'} XCoin hisobingizga tushdi`;
  };
  return <View style={styles.page}><AppHeader title="Bildirishnomalar" />{busy ? <ActivityIndicator style={{ marginTop: 35 }} color={palette.blue} /> : error ? <Pressable onPress={() => void load()}><Text style={styles.empty}>{error} · Qayta urinish</Text></Pressable> : <FlatList data={rows} keyExtractor={(item) => String(item.id)} contentContainerStyle={rows.length ? styles.list : styles.emptyList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={palette.blue} />} ListEmptyComponent={<View style={styles.emptyState}><Feather name="bell" size={35} color={palette.muted} /><Text style={styles.empty}>Hozircha bildirishnoma yo‘q.</Text></View>} renderItem={({ item }) => <Pressable onPress={() => void open(item)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={[styles.icon, !item.read_at && styles.unreadIcon]}><Feather name={item.kind === 'follow' ? 'user-plus' : item.kind === 'xcoin' ? 'dollar-sign' : item.kind === 'comment' ? 'message-circle' : 'heart'} size={18} color={palette.blue} /></View><View style={styles.copy}><Text style={styles.message}>{description(item)}</Text><Text style={styles.time}>{new Date(item.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text></View>{!item.read_at && <View style={styles.dot} />}</Pressable>} />}<AppNav /></View>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, list: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 100 }, emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 60 }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 17 }, pressed: { opacity: 0.78 }, icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center' }, unreadIcon: { backgroundColor: palette.blue + '22' }, copy: { flex: 1 }, message: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' }, time: { color: palette.muted, fontSize: 11, marginTop: 5 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.blue }, emptyState: { alignItems: 'center', gap: 12 }, empty: { color: palette.muted, textAlign: 'center', padding: 24 } });
