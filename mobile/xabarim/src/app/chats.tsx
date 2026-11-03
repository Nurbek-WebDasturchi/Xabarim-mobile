import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { loadConversations, subscribeToMessages, type Conversation, type Message } from '@/features/chats/chat-service';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const timeLabel = (date: string) => {
  const value = new Date(date), now = new Date();
  if (value.toDateString() === now.toDateString()) return value.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  return value.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' });
};

export default function ChatsScreen() {
  const { user, profile, session, loading, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    try { setError(''); setRows(await loadConversations(user.id)); } catch (e) { setError(e instanceof Error ? e.message : 'Chatlarni yuklab bo‘lmadi.'); } finally { setBusy(false); setRefreshing(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToMessages((message: Message) => {
    if (message.sender === user?.id || message.receiver === user?.id) void load();
  }), [load, user?.id]);
  if (!loading && !session) return <Redirect href="/login" />;
  const filtered = rows.filter((row) => `${row.peer.full_name ?? ''} ${row.peer.username}`.toLowerCase().includes(query.toLowerCase()));
  const doSignOut = async () => { try { await signOut(); } catch (e) { setError(e instanceof Error ? e.message : 'Chiqishda xatolik yuz berdi.'); } };

  return <View style={[styles.page, { paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom }]}>
    <View style={styles.header}><View><Text style={styles.greeting}>Xabarim</Text><Text style={styles.heading}>Xabarlar</Text></View><Pressable onPress={doSignOut} style={styles.avatar} accessibilityLabel="Hisobdan chiqish"><Text style={styles.avatarText}>{(profile?.full_name || profile?.username || 'X').slice(0, 1).toUpperCase()}</Text></Pressable></View>
    <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Chatlardan qidirish" placeholderTextColor="#999AAD" style={styles.searchInput} /></View>
    {!!error && <Pressable onPress={() => void load()}><Text style={styles.error}>{error}  ·  Qayta urinish</Text></Pressable>}
    {busy ? <View style={styles.center}><ActivityIndicator size="large" color="#5848E8" /></View> : <FlatList data={filtered} keyExtractor={(item) => item.peer.id} contentContainerStyle={filtered.length ? styles.list : styles.emptyList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#5848E8" />} ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptyEmoji}>✦</Text></View><Text style={styles.emptyTitle}>{query ? 'Hech narsa topilmadi' : 'Hozircha chat yo‘q'}</Text><Text style={styles.emptyText}>Username orqali yaqinlaringizni topib, birinchi xabarni yuboring.</Text><Pressable onPress={() => router.push('/new-chat')} style={styles.startButton}><Text style={styles.startButtonText}>Yangi chat</Text></Pressable></View>} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/chat/[peerId]', params: { peerId: item.peer.id, name: item.peer.full_name || item.peer.username, username: item.peer.username } })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {item.peer.avatar_url ? <Image source={{ uri: item.peer.avatar_url }} style={styles.peerAvatarImage} /> : <View style={styles.peerAvatar}><Text style={styles.peerInitial}>{(item.peer.full_name || item.peer.username).slice(0, 1).toUpperCase()}</Text></View>}
      <View style={styles.rowBody}><View style={styles.rowTop}><Text numberOfLines={1} style={styles.peerName}>{item.peer.full_name || item.peer.username}</Text><Text style={styles.time}>{timeLabel(item.last.created_at)}</Text></View><View style={styles.rowBottom}><Text numberOfLines={1} style={styles.preview}>{item.last.body || (item.last.file_url ? '📎 Fayl' : 'Xabar')}</Text>{item.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text></View>}</View></View>
    </Pressable>} />}
    <Pressable onPress={() => router.push('/new-chat')} style={({ pressed }) => [styles.fab, pressed && styles.pressed]} accessibilityLabel="Yangi chat"><Text style={styles.fabText}>＋</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7F8FC', paddingTop: 58 }, header: { paddingHorizontal: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, greeting: { fontSize: 13, color: '#85869A', fontWeight: '600' }, heading: { marginTop: 3, fontSize: 29, lineHeight: 35, color: '#191A2E', fontWeight: '900' }, avatar: { height: 46, width: 46, borderRadius: 18, backgroundColor: '#E6E3FF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#5848E8', fontWeight: '900', fontSize: 19 }, search: { marginHorizontal: 22, marginTop: 22, marginBottom: 10, height: 50, borderRadius: 16, backgroundColor: 'white', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EEEEF4' }, searchIcon: { color: '#85869A', fontSize: 28, marginRight: 9, marginTop: -4 }, searchInput: { flex: 1, color: '#191A2E', fontSize: 14 }, list: { paddingHorizontal: 15, paddingBottom: 105 }, row: { minHeight: 79, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }, pressed: { opacity: 0.75 }, peerAvatar: { width: 54, height: 54, borderRadius: 20, backgroundColor: '#E9E7FF', alignItems: 'center', justifyContent: 'center' }, peerAvatarImage: { width: 54, height: 54, borderRadius: 20 }, peerInitial: { color: '#5848E8', fontSize: 20, fontWeight: '800' }, rowBody: { flex: 1, marginLeft: 13, height: 60, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8EF' }, rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, peerName: { flex: 1, color: '#202137', fontSize: 15, fontWeight: '700' }, time: { marginLeft: 8, color: '#9A9BAD', fontSize: 11 }, rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }, preview: { flex: 1, color: '#85869A', fontSize: 13 }, badge: { minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, backgroundColor: '#5848E8', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, badgeText: { color: 'white', fontSize: 10, fontWeight: '800' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 60 }, empty: { alignItems: 'center', paddingHorizontal: 36 }, emptyIcon: { height: 76, width: 76, borderRadius: 28, backgroundColor: '#EAE8FF', alignItems: 'center', justifyContent: 'center' }, emptyEmoji: { fontSize: 31, color: '#5848E8' }, emptyTitle: { color: '#191A2E', fontWeight: '800', fontSize: 19, marginTop: 18 }, emptyText: { color: '#85869A', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }, startButton: { paddingHorizontal: 21, paddingVertical: 13, borderRadius: 14, backgroundColor: '#5848E8', marginTop: 20 }, startButtonText: { color: 'white', fontWeight: '800', fontSize: 14 }, fab: { position: 'absolute', bottom: 30, right: 23, width: 58, height: 58, borderRadius: 21, backgroundColor: '#5848E8', alignItems: 'center', justifyContent: 'center', shadowColor: '#3C30B4', shadowOpacity: 0.28, shadowRadius: 12, elevation: 7 }, fabText: { color: 'white', fontSize: 31, lineHeight: 34, fontWeight: '400' }, error: { color: '#B73747', marginHorizontal: 24, marginTop: 7, fontSize: 12 } });
