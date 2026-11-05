import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppHeader } from '@/components/app-header';
import { AppNav } from '@/components/app-nav';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { useAuth } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { useT } from '@/features/i18n/i18n';

type Community = { id: number; name: string; kind: 'community'; description: string | null; members?: { user_id: string }[] | null };

export default function CommunitiesScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, session, loading } = useAuth();
  const t = useT();
  const [community, setCommunity] = useState<Community | null>(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const db = getSupabaseClient();
      const { data, error: loadError } = await db.from('rooms').select('id,name,kind,description').eq('kind', 'community').eq('name', 'Xabarim Official').maybeSingle();
      if (loadError) throw loadError;
      if (data) {
        const { data: membership, error: memberError } = await db.from('room_members').select('room_id').eq('room_id', data.id).eq('user_id', user.id).maybeSingle();
        if (memberError) throw memberError;
        setCommunity({ ...data, members: membership ? [{ user_id: user.id }] : [] } as Community);
      } else setCommunity(null);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Hamjamiyatni yuklab bo‘lmadi.'); }
    finally { setBusy(false); setRefreshing(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  if (!loading && !session) return <Redirect href="/login" />;
  const member = !!community?.members?.some((row) => row.user_id === user?.id);
  return <View style={styles.page}><AppHeader /><View style={styles.heading}><Text style={styles.title}>{t('community')}</Text><Text style={styles.subtitle}>{t('groupsDescription')}</Text></View>{busy ? <ActivityIndicator style={{ marginTop: 30 }} color={palette.blue} /> : error ? <Pressable onPress={() => void load()}><Text style={styles.empty}>{error} · Qayta urinish</Text></Pressable> : community ? <FlatList data={[community]} keyExtractor={(room) => String(room.id)} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={palette.blue} />} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/community/[roomId]', params: { roomId: String(item.id), name: item.name } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.icon}><Feather name="radio" size={23} color={palette.blue} /></View><View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.desc}>{item.description || 'Xabarim platformasining rasmiy hamjamiyati'}</Text></View><View style={[styles.status, member && styles.memberStatus]}><Text style={[styles.statusText, member && styles.memberStatusText]}>{member ? t('joined') : t('join')}</Text></View></Pressable>} /> : <View style={styles.emptyWrap}><Feather name="globe" size={42} color={palette.blue} /><Text style={styles.emptyTitle}>{t('notFound')}</Text><Text style={styles.empty}>Xabarim Official community bazada mavjud bo‘lishi kerak.</Text></View>}<AppNav /></View>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, heading: { paddingHorizontal: 18, paddingTop: 21 }, title: { color: palette.text, fontSize: 23, fontWeight: '900' }, subtitle: { color: palette.muted, marginTop: 5, fontSize: 13 }, list: { padding: 14, paddingBottom: 100 }, card: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 18, marginBottom: 9 }, pressed: { opacity: 0.82 }, icon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.raised }, name: { color: palette.text, fontWeight: '800', fontSize: 15 }, desc: { color: palette.muted, fontSize: 12, marginTop: 5 }, status: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: palette.blue }, memberStatus: { backgroundColor: palette.raised }, statusText: { color: 'white', fontWeight: '800', fontSize: 11 }, memberStatusText: { color: palette.green }, emptyWrap: { paddingTop: 75, alignItems: 'center' }, emptyTitle: { color: palette.text, fontSize: 17, fontWeight: '800', marginTop: 12 }, empty: { color: palette.muted, textAlign: 'center', padding: 24 } });
