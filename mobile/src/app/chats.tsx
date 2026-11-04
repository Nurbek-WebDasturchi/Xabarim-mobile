import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { describeChatLoadError, loadConversations, loadRoomConversations, subscribeToMessages, type Conversation, type Message, type RoomConversation } from '@/features/chats/chat-service';
import { AppNav } from '@/components/app-nav';
import { AppHeader } from '@/components/app-header';
import { useThemeColors, type ThemeColors } from '@/components/theme';

const timeLabel = (date: string) => {
  const value = new Date(date), now = new Date();
  if (value.toDateString() === now.toDateString()) return value.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  return value.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' });
};

export default function ChatsScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, profile, session, loading, signOut } = useAuth();
  const [rows, setRows] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'personal' | 'groups'>('personal');
  const [groups, setGroups] = useState<RoomConversation[]>([]);
  const load = useCallback(async () => {
    if (!user) return;
    try { setError(''); setRows(await loadConversations(user.id)); } catch (e) { setError(describeChatLoadError(e, 'Chatlarni yuklab bo‘lmadi.')); } finally { setBusy(false); setRefreshing(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  const loadGroups = useCallback(async () => {
    if (!user) return;
    try { setError(''); setGroups(await loadRoomConversations(user.id)); }
    catch (e) { setError(describeChatLoadError(e, 'Guruhlarni yuklab bo‘lmadi.')); }
  }, [user]);
  useEffect(() => { if (tab === 'groups') void loadGroups(); }, [loadGroups, tab]);
  useEffect(() => subscribeToMessages((message: Message) => {
    if (message.sender === user?.id || message.receiver === user?.id) void load();
  }), [load, user?.id]);
  if (!loading && !session) return <Redirect href="/login" />;
  const filtered = rows.filter((row) => `${row.peer.full_name ?? ''} ${row.peer.username}`.toLowerCase().includes(query.toLowerCase()));
  const doSignOut = async () => { try { await signOut(); } catch (e) { setError(e instanceof Error ? e.message : 'Chiqishda xatolik yuz berdi.'); } };

  return <View style={styles.page}>
    <AppHeader />
    <View style={styles.tabs}><Pressable onPress={() => setTab('personal')} style={tab === 'personal' ? styles.tabActive : styles.tab}><Text style={tab === 'personal' ? styles.tabActiveText : styles.tabText}>♟  Shaxsiy</Text></Pressable><Pressable onPress={() => setTab('groups')} style={tab === 'groups' ? styles.tabActive : styles.tab}><Text style={tab === 'groups' ? styles.tabActiveText : styles.tabText}>♧  Guruhlar</Text></Pressable><Pressable onPress={doSignOut} style={styles.signOutWrap}><Text style={styles.signOut}>Chiqish</Text></Pressable></View>
    <View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Chatlardan qidirish" placeholderTextColor="#999AAD" style={styles.searchInput} /></View>
    {!!error && <Pressable onPress={() => void load()}><Text style={styles.error}>{error}  ·  Qayta urinish</Text></Pressable>}
    {tab === 'groups' ? <FlatList data={groups.filter((row) => row.room.name.toLowerCase().includes(query.toLowerCase()))} keyExtractor={(row) => String(row.room.id)} contentContainerStyle={groups.length ? styles.list : styles.emptyList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadGroups()} tintColor={palette.blue} />} ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptyEmoji}>♧</Text></View><Text style={styles.emptyTitle}>Guruhlar topilmadi</Text><Text style={styles.emptyText}>Siz a’zo bo‘lgan guruhlar shu yerda ko‘rinadi.</Text></View>} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/group/[roomId]', params: { roomId: String(item.room.id), name: item.room.name } })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.peerAvatar}><Text style={styles.peerInitial}>{item.room.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.rowBody}><View style={styles.rowTop}><Text numberOfLines={1} style={styles.peerName}>{item.room.name}</Text><Text style={styles.time}>{item.last ? timeLabel(item.last.created_at) : ''}</Text></View><View style={styles.rowBottom}><Text numberOfLines={1} style={styles.preview}>{item.last?.body || 'Guruh suhbati'}</Text>{item.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View>}</View></View></Pressable>} /> : busy ? <View style={styles.center}><ActivityIndicator size="large" color={palette.blue} /></View> : <FlatList data={filtered} keyExtractor={(item) => item.peer.id} contentContainerStyle={filtered.length ? styles.list : styles.emptyList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={palette.blue} />} ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Text style={styles.emptyEmoji}>✦</Text></View><Text style={styles.emptyTitle}>{query ? 'Hech narsa topilmadi' : 'Hozircha chat yo‘q'}</Text><Text style={styles.emptyText}>Username orqali yaqinlaringizni topib, birinchi xabarni yuboring.</Text><Pressable onPress={() => router.push('/new-chat')} style={styles.startButton}><Text style={styles.startButtonText}>Yangi chat</Text></Pressable></View>} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/chat/[peerId]', params: { peerId: item.peer.id, name: item.peer.full_name || item.peer.username, username: item.peer.username } })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    {item.peer.avatar_url ? <Image source={{ uri: item.peer.avatar_url }} style={styles.peerAvatarImage} /> : <View style={styles.peerAvatar}><Text style={styles.peerInitial}>{(item.peer.full_name || item.peer.username).slice(0, 1).toUpperCase()}</Text></View>}
      <View style={styles.rowBody}><View style={styles.rowTop}><Text numberOfLines={1} style={styles.peerName}>{item.peer.full_name || item.peer.username}</Text><Text style={styles.time}>{timeLabel(item.last.created_at)}</Text></View><View style={styles.rowBottom}><Text numberOfLines={1} style={styles.preview}>{item.last.body || (item.last.file_url ? '📎 Fayl' : 'Xabar')}</Text>{item.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text></View>}</View></View>
    </Pressable>} />}
    <Pressable onPress={() => router.push('/new-chat')} style={({ pressed }) => [styles.fab, pressed && styles.pressed]} accessibilityLabel="Yangi chat"><Text style={styles.fabText}>＋</Text></Pressable>
    <AppNav />
  </View>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background, paddingTop: 0 }, tabs: { minHeight: 78, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 9 }, tabActive: { backgroundColor: '#181F4C', paddingHorizontal: 17, paddingVertical: 13, borderRadius: 18 }, tabText: { color: palette.muted, fontSize: 13, fontWeight: '800' }, tabActiveText: { color: palette.blue, fontSize: 13, fontWeight: '800' }, tab: { backgroundColor: palette.surface, paddingHorizontal: 17, paddingVertical: 13, borderRadius: 18, borderWidth: 1, borderColor: palette.border }, signOutWrap: { marginLeft: 'auto' }, signOut: { color: palette.dim, fontSize: 10 }, search: { marginHorizontal: 15, marginTop: 1, marginBottom: 10, height: 50, borderRadius: 16, backgroundColor: palette.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.border }, searchIcon: { color: palette.muted, fontSize: 28, marginRight: 9, marginTop: -4 }, searchInput: { flex: 1, color: palette.text, fontSize: 14 }, list: { paddingHorizontal: 13, paddingBottom: 105 }, row: { minHeight: 91, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 20, marginBottom: 8 }, pressed: { opacity: 0.75 }, peerAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border }, peerAvatarImage: { width: 58, height: 58, borderRadius: 29 }, peerInitial: { color: palette.blue, fontSize: 20, fontWeight: '800' }, rowBody: { flex: 1, marginLeft: 13, height: 66, justifyContent: 'center' }, rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, peerName: { flex: 1, color: palette.text, fontSize: 15, fontWeight: '700' }, time: { marginLeft: 8, color: palette.muted, fontSize: 11 }, rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }, preview: { flex: 1, color: palette.muted, fontSize: 13 }, badge: { minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, badgeText: { color: 'white', fontSize: 10, fontWeight: '800' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 60 }, empty: { alignItems: 'center', paddingHorizontal: 36 }, emptyIcon: { height: 76, width: 76, borderRadius: 38, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, emptyEmoji: { fontSize: 31, color: 'white' }, emptyTitle: { color: palette.text, fontWeight: '800', fontSize: 19, marginTop: 18 }, emptyText: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }, startButton: { paddingHorizontal: 21, paddingVertical: 13, borderRadius: 14, backgroundColor: palette.blue, marginTop: 20 }, startButtonText: { color: 'white', fontWeight: '800', fontSize: 14 }, fab: { position: 'absolute', bottom: 92, right: 23, width: 58, height: 58, borderRadius: 29, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', shadowColor: palette.blue, shadowOpacity: 0.35, shadowRadius: 12, elevation: 7 }, fabText: { color: 'white', fontSize: 31, lineHeight: 34, fontWeight: '400' }, error: { color: palette.red, marginHorizontal: 24, marginTop: 7, fontSize: 12 } });
