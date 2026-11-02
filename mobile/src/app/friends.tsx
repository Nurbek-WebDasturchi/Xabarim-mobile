import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { AppNav } from '@/components/app-nav';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { useAuth, type Profile } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase';

export default function FriendsScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, session, loading } = useAuth();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = useCallback(async (value: string) => {
    const q = value.trim().replace(/[,()%*]/g, '');
    if (!user || q.length < 2) { setRows([]); setBusy(false); return; }
    setBusy(true); setError('');
    const { data, error: requestError } = await getSupabaseClient().from('profiles').select('id,username,full_name,avatar_url,bio,last_seen').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id', user.id).limit(30);
    if (requestError) setError(requestError.message); else setRows((data ?? []) as Profile[]);
    setBusy(false);
  }, [user]);
  useEffect(() => { const timer = setTimeout(() => { void search(query); }, 250); return () => clearTimeout(timer); }, [query, search]);
  if (!loading && !session) return <Redirect href="/login" />;
  return <View style={styles.page}><AppHeader /><View style={styles.heading}><Text style={styles.title}>Do‘stlar</Text><Text style={styles.subtitle}>Yaqinlaringizni toping va suhbatni boshlang.</Text></View><View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Ism yoki username" placeholderTextColor={palette.dim} autoCapitalize="none" style={styles.input} /></View>{!!error && <Text style={styles.error}>{error}</Text>}{busy ? <ActivityIndicator style={{ marginTop: 30 }} color={palette.blue} /> : <FlatList data={rows} keyExtractor={(row) => row.id} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>{query.length < 2 ? 'Do‘st qidirish uchun kamida 2 ta belgi yozing' : 'Foydalanuvchi topilmadi'}</Text>} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/chat/[peerId]', params: { peerId: item.id, name: item.full_name || item.username, username: item.username } })} style={styles.row}>{item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.initial}>{(item.full_name || item.username).slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.info}><Text style={styles.name}>{item.full_name || item.username}</Text><Text style={styles.username}>@{item.username}</Text>{!!item.bio && <Text numberOfLines={1} style={styles.bio}>{item.bio}</Text>}</View><Text style={styles.arrow}>›</Text></Pressable>} />}<AppNav /></View>;
}
const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, heading: { paddingHorizontal: 18, paddingTop: 21 }, title: { color: palette.text, fontSize: 23, fontWeight: '900' }, subtitle: { color: palette.muted, marginTop: 5, fontSize: 13 }, search: { margin: 15, height: 50, borderRadius: 16, backgroundColor: palette.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.border }, searchIcon: { color: palette.muted, fontSize: 27, marginRight: 8 }, input: { flex: 1, color: palette.text }, list: { paddingHorizontal: 14, paddingBottom: 100 }, row: { minHeight: 83, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 }, avatar: { height: 54, width: 54, borderRadius: 27, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center' }, initial: { color: palette.blue, fontSize: 20, fontWeight: '800' }, info: { flex: 1, marginLeft: 12 }, name: { color: palette.text, fontSize: 14, fontWeight: '800' }, username: { color: palette.muted, fontSize: 12, marginTop: 3 }, bio: { color: palette.dim, fontSize: 11, marginTop: 3 }, arrow: { color: palette.muted, fontSize: 27 }, empty: { color: palette.muted, textAlign: 'center', paddingHorizontal: 35, paddingTop: 35 }, error: { color: palette.red, paddingHorizontal: 20 } });
