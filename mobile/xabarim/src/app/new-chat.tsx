import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth, type Profile } from '@/features/auth/auth-context';
import { supabase } from '@/lib/supabase';

export default function NewChatScreen() {
  const { user, session, loading } = useAuth();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = useCallback(async (value: string) => {
    const q = value.trim().toLowerCase().replace(/[,()%*]/g, '');
    if (!supabase || !user || q.length < 2) { setItems([]); setBusy(false); return; }
    setBusy(true); setError('');
    const { data, error: requestError } = await supabase.from('profiles').select('id,username,full_name,avatar_url,bio,last_seen').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id', user.id).limit(20);
    if (requestError) setError(requestError.message); else setItems((data ?? []) as Profile[]);
    setBusy(false);
  }, [user]);
  useEffect(() => { const timer = setTimeout(() => { void search(query); }, 300); return () => clearTimeout(timer); }, [query, search]);
  if (!loading && !session) return <Redirect href="/login" />;
  return <View style={styles.page}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.title}>Yangi chat</Text><Text style={styles.subtitle}>Username yoki ism orqali qidiring</Text></View></View>
    <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Masalan, username" placeholderTextColor="#999AAD" autoCapitalize="none" autoCorrect={false} style={styles.input} autoFocus /></View>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {busy ? <View style={styles.center}><ActivityIndicator color="#5848E8" /></View> : query.trim().length < 2 ? <View style={styles.center}><Text style={styles.hint}>Kamida 2 ta belgi kiriting</Text></View> : <FlatList data={items} keyExtractor={(item) => item.id} renderItem={({ item }) => <Pressable onPress={() => router.replace({ pathname: '/chat/[peerId]', params: { peerId: item.id, name: item.full_name || item.username, username: item.username } })} style={styles.row}>{item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.initial}>{(item.full_name || item.username).slice(0, 1).toUpperCase()}</Text></View>}<View><Text style={styles.name}>{item.full_name || item.username}</Text><Text style={styles.username}>@{item.username}</Text></View></Pressable>} ListEmptyComponent={<View style={styles.center}><Text style={styles.hint}>Foydalanuvchi topilmadi</Text></View>} />}
  </View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7F8FC', paddingTop: 58 }, header: { paddingHorizontal: 21, flexDirection: 'row', alignItems: 'center', gap: 13 }, back: { height: 42, width: 42, borderRadius: 15, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }, backText: { color: '#292A40', fontSize: 31, lineHeight: 34 }, title: { color: '#191A2E', fontSize: 22, fontWeight: '800' }, subtitle: { color: '#85869A', fontSize: 12, marginTop: 3 }, search: { margin: 20, marginBottom: 10, height: 50, borderRadius: 16, backgroundColor: 'white', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }, searchIcon: { color: '#85869A', fontSize: 27, marginRight: 9, marginTop: -4 }, input: { flex: 1, color: '#191A2E', fontSize: 14 }, row: { minHeight: 75, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 13 }, avatar: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#E9E7FF', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#5848E8', fontSize: 19, fontWeight: '800' }, name: { color: '#202137', fontSize: 15, fontWeight: '700' }, username: { color: '#85869A', fontSize: 13, marginTop: 4 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, hint: { color: '#85869A', fontSize: 14 }, error: { color: '#B73747', marginHorizontal: 22 }, });
