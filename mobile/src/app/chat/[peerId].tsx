import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/auth-context';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { describeChatLoadError, loadMessages, markConversationRead, sendMessage, subscribeToMessages, type Message } from '@/features/chats/chat-service';
import { getSupabaseClient } from '@/lib/supabase';

export default function ChatScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { peerId: paramPeer, name: paramName, username: paramUsername, avatar: paramAvatar } = useLocalSearchParams<{ peerId: string; name?: string; username?: string; avatar?: string }>();
  const peerId = Array.isArray(paramPeer) ? paramPeer[0] : paramPeer;
  const name = Array.isArray(paramName) ? paramName[0] : paramName;
  const username = Array.isArray(paramUsername) ? paramUsername[0] : paramUsername;
  const avatar = Array.isArray(paramAvatar) ? paramAvatar[0] : paramAvatar;
  const [loadedAvatar, setLoadedAvatar] = useState<string | null>(avatar || null);
  const { user, session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<FlatList<Message>>(null);
  useEffect(() => { if (!loadedAvatar && peerId) void getSupabaseClient().from('profiles').select('avatar_url').eq('id', peerId).maybeSingle().then(({ data }) => setLoadedAvatar(data?.avatar_url || null)); }, [loadedAvatar, peerId]);
  const load = useCallback(async () => {
    if (!user || !peerId) return;
    try {
      const rows = await loadMessages(user.id, peerId);
      setMessages(rows);
      await markConversationRead(user.id, peerId);
      setError('');
    } catch (e) { setError(describeChatLoadError(e, 'Xabarlarni olib bo‘lmadi.')); }
    finally { setBusy(false); }
  }, [user, peerId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToMessages((message) => {
    if (!user || !((message.sender === user.id && message.receiver === peerId) || (message.sender === peerId && message.receiver === user.id))) return;
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    if (message.sender === peerId && user) void markConversationRead(user.id, peerId).catch(() => {});
  }), [peerId, user]);
  if (!loading && !session) return <Redirect href="/login" />;
  const submit = async () => {
    const body = text.trim();
    if (!body || !user || !peerId || sending) return;
    setSending(true); setText(''); setError('');
    try {
      const message = await sendMessage(user.id, peerId, body);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    } catch (e) { setText(body); setError(e instanceof Error ? e.message : 'Xabar yuborilmadi.'); }
    finally { setSending(false); }
  };
  const showChatMenu = () => Alert.alert(name || username || 'Suhbat', undefined, [
    { text: 'Profilni ko‘rish', onPress: () => router.push({ pathname: '/profile', params: { userId: peerId } }) },
    { text: 'Profil havolasini ulashish', onPress: () => { void Share.share({ message: `Xabarim: @${username || peerId}` }); } },
    { text: 'Bekor qilish', style: 'cancel' },
  ]);
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
    <View style={[styles.header, { height: 67 + insets.top, paddingTop: insets.top }]}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Pressable onPress={() => router.push({ pathname: '/profile', params: { userId: peerId } })} style={styles.identity}><View style={styles.avatar}>{loadedAvatar ? <Image source={{ uri: loadedAvatar }} style={styles.avatarImage} /> : <Text style={styles.initial}>{(name || username || 'X').slice(0, 1).toUpperCase()}</Text>}</View><View style={styles.person}><Text numberOfLines={1} style={styles.name}>{name || username || 'Suhbat'}</Text><Text style={styles.username}>{username ? `@${username}` : 'Xabarim foydalanuvchisi'}</Text></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Suhbat menyusi" hitSlop={12} onPress={showChatMenu} style={styles.more}><Text style={styles.moreText}>•••</Text></Pressable></View>
    {busy ? <View style={styles.center}><ActivityIndicator color="#5848E8" /></View> : <FlatList ref={list} data={messages} keyExtractor={(item) => String(item.id)} contentContainerStyle={messages.length ? styles.messages : styles.emptyMessages} onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })} ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyAvatar}><Text style={styles.emptyInitial}>{(name || username || 'X').slice(0, 1).toUpperCase()}</Text></View><Text style={styles.emptyTitle}>Suhbatni boshlang</Text><Text style={styles.emptyText}>Birinchi xabaringizni yuboring 👋</Text></View>} renderItem={({ item }) => {
      const mine = item.sender === user?.id;
      return <View style={[styles.messageLine, mine ? styles.myLine : styles.theirLine]}><View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble]}><Text style={[styles.body, mine && styles.myBody]}>{item.body || (item.file_url ? '📎 Fayl' : '')}</Text><View style={styles.meta}><Text style={[styles.messageTime, mine && styles.myTime]}>{new Date(item.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</Text>{mine && <Text style={styles.status}>{item.read ? '✓✓' : item.delivered_at ? '✓✓' : '✓'}</Text>}</View></View></View>;
    }} />}
    {!!error && <Pressable onPress={() => void load()}><Text style={styles.error}>{error}  ·  Qayta urinish</Text></Pressable>}
    <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}><TextInput value={text} onChangeText={setText} placeholder="Xabar yozing..." placeholderTextColor="#A0A1B0" multiline style={styles.input} maxLength={4000} onSubmitEditing={submit} blurOnSubmit={false} /><Pressable onPress={submit} disabled={!text.trim() || sending} style={[styles.send, (!text.trim() || sending) && styles.sendDisabled]}><Text style={styles.sendText}>➤</Text></Pressable></View>
  </KeyboardAvoidingView>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background, paddingTop: 0 }, header: { minHeight: 67, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, backgroundColor: palette.surface }, back: { width: 37, height: 42, justifyContent: 'center' }, backText: { color: palette.text, fontSize: 33, lineHeight: 37 }, identity: { flex: 1, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, initial: { color: palette.blue, fontSize: 17, fontWeight: '800' }, person: { marginLeft: 10, flex: 1 }, name: { color: palette.text, fontSize: 15, fontWeight: '800' }, username: { color: palette.muted, fontSize: 11, marginTop: 3 }, more: { width: 37, alignItems: 'center' }, moreText: { color: palette.muted, fontSize: 17 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, messages: { paddingHorizontal: 14, paddingVertical: 18, gap: 9 }, emptyMessages: { flexGrow: 1, justifyContent: 'center' }, empty: { alignItems: 'center', paddingHorizontal: 35 }, emptyAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center' }, emptyInitial: { color: palette.blue, fontSize: 27, fontWeight: '800' }, emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '800', marginTop: 16 }, emptyText: { color: palette.muted, fontSize: 14, marginTop: 7 }, messageLine: { width: '100%', flexDirection: 'row' }, myLine: { justifyContent: 'flex-end' }, theirLine: { justifyContent: 'flex-start' }, bubble: { maxWidth: '83%', minWidth: 75, paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7, borderRadius: 18 }, myBubble: { backgroundColor: palette.blue, borderBottomRightRadius: 5 }, theirBubble: { backgroundColor: palette.surface, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: palette.border }, body: { fontSize: 15, lineHeight: 21, color: palette.text }, myBody: { color: 'white' }, meta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 3 }, messageTime: { color: palette.dim, fontSize: 10 }, myTime: { color: '#D7E8FF' }, status: { color: '#D7E8FF', fontSize: 10 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 13, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 20 : 12, backgroundColor: palette.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border }, input: { flex: 1, minHeight: 45, maxHeight: 120, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 17, backgroundColor: palette.background, color: palette.text, fontSize: 15, borderWidth: 1, borderColor: palette.border }, send: { width: 45, height: 45, borderRadius: 23, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: palette.dim }, sendText: { color: 'white', fontSize: 20, marginLeft: 2 }, error: { color: palette.red, paddingHorizontal: 16, paddingVertical: 7, fontSize: 12 } });
