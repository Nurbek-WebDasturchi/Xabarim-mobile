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
import { joinCommunity } from '@/features/chats/chat-service';

type Community = { id: number; name: string; kind: 'community'; description: string | null; member: boolean; count: number };

export default function CommunitiesScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, session, loading } = useAuth();
  const t = useT();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const db = getSupabaseClient();
      const { data, error: loadError } = await db.from('rooms').select('id,name,kind,description').eq('kind', 'community').order('created_at', { ascending: false });
      if (loadError) throw loadError;
      const { data: memberships, error: memberError } = await db.from('room_members').select('room_id').eq('user_id', user.id);
      if (memberError) throw memberError;
      const { data: counts, error: countError } = await db.rpc('community_counts');
      const countByRoom = new Map<number, number>();
      if (!countError) for (const row of counts ?? []) countByRoom.set(row.room_id, row.members);
      const memberIds = new Set((memberships ?? []).map((row) => row.room_id));
      setCommunities((data ?? []).map((room) => ({ ...room, member: memberIds.has(room.id), count: countByRoom.get(room.id) ?? 0 })) as Community[]);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Hamjamiyatni yuklab bo‘lmadi.'); }
    finally { setBusy(false); setRefreshing(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  if (!loading && !session) return <Redirect href="/login" />;
  const join = async (item: Community) => { if (!user || item.member) return; try { await joinCommunity(item.id, user.id); setCommunities((current) => current.map((room) => room.id === item.id ? { ...room, member: true, count: room.count + 1 } : room)); } catch (e) { setError(e instanceof Error ? e.message : 'Hamjamiyatga qo‘shilmadi.'); } };
  return <View style={styles.page}><AppHeader /><View style={styles.heading}><Text style={styles.title}>{t('community')}</Text><Text style={styles.subtitle}>{t('groupsDescription')}</Text></View>{busy ? <ActivityIndicator style={{ marginTop: 30 }} color={palette.blue} /> : error ? <Pressable onPress={() => void load()}><Text style={styles.empty}>{error} · Qayta urinish</Text></Pressable> : communities.length ? <FlatList data={communities} keyExtractor={(room) => String(room.id)} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={palette.blue} />} renderItem={({ item }) => <View style={styles.card}><Pressable onPress={() => router.push({ pathname: '/community/[roomId]', params: { roomId: String(item.id), name: item.name } })} style={styles.roomLink}><View style={styles.icon}><Feather name="radio" size={23} color={palette.blue} /></View><View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.desc}>{item.description || 'Xabarim platformasining rasmiy hamjamiyati'}</Text><Text style={styles.memberCount}>{item.count} ta a’zo</Text></View></Pressable><Pressable onPress={() => void join(item)} style={[styles.status, item.member && styles.memberStatus]}><Text style={[styles.statusText, item.member && styles.memberStatusText]}>{item.member ? t('joined') : t('join')}</Text></Pressable></View>} /> : <View style={styles.emptyWrap}><Feather name="globe" size={42} color={palette.blue} /><Text style={styles.emptyTitle}>{t('notFound')}</Text><Text style={styles.empty}>Hozircha hamjamiyat topilmadi.</Text></View>}<AppNav /></View>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, heading: { paddingHorizontal: 18, paddingTop: 21 }, title: { color: palette.text, fontSize: 23, fontWeight: '900' }, subtitle: { color: palette.muted, marginTop: 5, fontSize: 13 }, list: { padding: 14, paddingBottom: 100 }, card: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 18, marginBottom: 9 }, roomLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed: { opacity: 0.82 }, icon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.raised }, name: { color: palette.text, fontWeight: '800', fontSize: 15 }, desc: { color: palette.muted, fontSize: 12, marginTop: 5 }, memberCount: { color: palette.muted, fontSize: 11, marginTop: 5 }, status: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: palette.blue }, memberStatus: { backgroundColor: palette.raised }, statusText: { color: 'white', fontWeight: '800', fontSize: 11 }, memberStatusText: { color: palette.green }, emptyWrap: { paddingTop: 75, alignItems: 'center' }, emptyTitle: { color: palette.text, fontSize: 17, fontWeight: '800', marginTop: 12 }, empty: { color: palette.muted, textAlign: 'center', padding: 24 } });
