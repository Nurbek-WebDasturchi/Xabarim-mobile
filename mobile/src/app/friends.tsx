import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { AppNav } from '@/components/app-nav';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { useAuth, type Profile } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { cancelFollowRequest, followUser, loadFollowState, unfollowUser, type FollowState } from '@/features/social/social-service';
import { useT } from '@/features/i18n/i18n';

export default function FriendsScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, session, loading } = useAuth();
  const t = useT();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [states, setStates] = useState<Record<string, FollowState>>({});
  const [working, setWorking] = useState<string | null>(null);
  const search = useCallback(async (value: string) => {
    const q = value.trim().replace(/[,()%*]/g, '');
    if (!user || q.length < 2) { setRows([]); setBusy(false); return; }
    setBusy(true); setError('');
    const { data, error: requestError } = await getSupabaseClient().from('profiles').select('id,username,full_name,avatar_url,bio,last_seen,is_private').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id', user.id).limit(30);
    if (requestError) setError(requestError.message); else { const found = (data ?? []) as Profile[]; setRows(found); const next: Record<string, FollowState> = {}; await Promise.all(found.map(async (person) => { try { next[person.id] = await loadFollowState(user.id, person.id); } catch { next[person.id] = 'none'; } })); setStates(next); }
    setBusy(false);
  }, [user]);
  useEffect(() => { const timer = setTimeout(() => { void search(query); }, 250); return () => clearTimeout(timer); }, [query, search]);
  if (!loading && !session) return <Redirect href="/login" />;
  const toggleFollow = async (item: Profile) => { if (!user) return; setWorking(item.id); setError(''); try { const current = states[item.id] ?? 'none'; if (current === 'pending') await cancelFollowRequest(user.id, item.id); else if (current === 'following') await unfollowUser(user.id, item.id); else await followUser(user.id, item.id, !!item.is_private, session?.access_token); setStates((value) => ({ ...value, [item.id]: current === 'pending' || current === 'following' ? 'none' : item.is_private ? 'pending' : 'following' })); } catch (e) { setError(e instanceof Error ? e.message : 'Obuna amalini bajarib bo‘lmadi.'); } finally { setWorking(null); } };
  const labelFor = (state: FollowState) => state === 'following' ? t('following') : state === 'pending' ? t('requested') : t('follow');
  return <View style={styles.page}><AppHeader /><View style={styles.heading}><Text style={styles.title}>{t('exploreFriends')}</Text><Text style={styles.subtitle}>{t('searchUsers')}</Text></View><View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder={t('search')} placeholderTextColor={palette.dim} autoCapitalize="none" style={styles.input} /></View>{!!error && <Text style={styles.error}>{error}</Text>}{busy ? <ActivityIndicator style={{ marginTop: 30 }} color={palette.blue} /> : <FlatList data={rows} keyExtractor={(row) => row.id} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>{query.length < 2 ? t('searchHint') : t('notFound')}</Text>} renderItem={({ item }) => <View style={styles.row}>{item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.initial}>{(item.full_name || item.username).slice(0, 1).toUpperCase()}</Text></View>}<Pressable onPress={() => router.push({ pathname: '/profile', params: { userId: item.id } })} style={styles.info}><Text style={styles.name}>{item.full_name || item.username}</Text><Text style={styles.username}>@{item.username}{item.is_private ? ' · 🔒' : ''}</Text>{!!item.bio && <Text numberOfLines={1} style={styles.bio}>{item.bio}</Text>}</Pressable><Pressable disabled={working === item.id} onPress={() => void toggleFollow(item)} style={[styles.followButton, states[item.id] === 'none' && styles.followPrimary]}><Text numberOfLines={1} style={[styles.followText, states[item.id] === 'none' && styles.followPrimaryText]}>{working === item.id ? '…' : labelFor(states[item.id] ?? 'none')}</Text></Pressable></View>} />}<AppNav /></View>;
}
const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, heading: { paddingHorizontal: 18, paddingTop: 21 }, title: { color: palette.text, fontSize: 23, fontWeight: '900' }, subtitle: { color: palette.muted, marginTop: 5, fontSize: 13 }, search: { margin: 15, height: 50, borderRadius: 16, backgroundColor: palette.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.border }, searchIcon: { color: palette.muted, fontSize: 27, marginRight: 8 }, input: { flex: 1, color: palette.text }, list: { paddingHorizontal: 14, paddingBottom: 100 }, row: { minHeight: 83, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, avatar: { height: 54, width: 54, borderRadius: 27, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center' }, initial: { color: palette.blue, fontSize: 20, fontWeight: '800' }, info: { flex: 1, marginLeft: 12 }, name: { color: palette.text, fontSize: 14, fontWeight: '800' }, username: { color: palette.muted, fontSize: 12, marginTop: 3 }, bio: { color: palette.dim, fontSize: 11, marginTop: 3 }, followButton: { maxWidth: 106, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: palette.raised }, followPrimary: { backgroundColor: palette.blue }, followText: { color: palette.text, fontSize: 10, fontWeight: '800' }, followPrimaryText: { color: 'white' }, empty: { color: palette.muted, textAlign: 'center', paddingHorizontal: 35, paddingTop: 35 }, error: { color: palette.red, paddingHorizontal: 20 } });
