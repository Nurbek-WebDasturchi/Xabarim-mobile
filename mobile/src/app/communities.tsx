import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { AppNav } from '@/components/app-nav';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { useAuth } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase';

type Room = { id: number; name?: string | null; title?: string | null; kind?: string | null; description?: string | null };
export default function CommunitiesScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, session, loading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const db = getSupabaseClient();
      const { data, error: loadError } = await db.from('rooms').select('*').order('id', { ascending: false }).limit(100);
      if (loadError) setError(loadError.message);
      else setRooms(((data ?? []) as Room[]).filter((room) => room.kind === 'group' || room.kind === 'community'));
      setBusy(false);
    })();
  }, [user]);
  if (!loading && !session) return <Redirect href="/login" />;
  return <View style={styles.page}><AppHeader /><View style={styles.heading}><Text style={styles.title}>Hamjamiyatlar</Text><Text style={styles.subtitle}>Guruh suhbatlari va qiziqishlar.</Text></View>{busy ? <ActivityIndicator style={{ marginTop: 30 }} color={palette.blue} /> : error ? <Text style={styles.empty}>{error}</Text> : <FlatList data={rooms} keyExtractor={(room) => String(room.id)} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.emptyWrap}><Text style={styles.emptyIcon}>◉</Text><Text style={styles.emptyTitle}>Hozircha hamjamiyat yo‘q</Text><Text style={styles.empty}>Guruhlar bu yerda ko‘rinadi.</Text></View>} renderItem={({ item }) => <View style={styles.card}><View style={styles.icon}><Text style={styles.iconText}>♧</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{item.name || item.title || 'Guruh'}</Text>{!!item.description && <Text style={styles.desc}>{item.description}</Text>}</View></View>} />}<AppNav /></View>;
}
const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, heading: { paddingHorizontal: 18, paddingTop: 21 }, title: { color: palette.text, fontSize: 23, fontWeight: '900' }, subtitle: { color: palette.muted, marginTop: 5, fontSize: 13 }, list: { padding: 14, paddingBottom: 100 }, card: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 18, marginBottom: 9 }, icon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.raised }, iconText: { color: palette.blue, fontSize: 24 }, name: { color: palette.text, fontWeight: '800', fontSize: 14 }, desc: { color: palette.muted, fontSize: 12, marginTop: 4 }, emptyWrap: { paddingTop: 75, alignItems: 'center' }, emptyIcon: { color: palette.blue, fontSize: 46 }, emptyTitle: { color: palette.text, fontSize: 17, fontWeight: '800', marginTop: 12 }, empty: { color: palette.muted, textAlign: 'center', padding: 24 } });
