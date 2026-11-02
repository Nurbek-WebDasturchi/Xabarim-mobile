import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/auth-context';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { loadRoomMessages, markRoomRead, sendRoomMessage, subscribeToMessages, type Message } from '@/features/chats/chat-service';

export default function GroupChatScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { roomId: rawId, name: rawName } = useLocalSearchParams<{ roomId: string; name?: string }>();
  const roomId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const name = Array.isArray(rawName) ? rawName[0] : rawName;
  const { user, session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<FlatList<Message>>(null);
  const load = useCallback(async () => {
    if (!user || !Number.isFinite(roomId)) return;
    try {
      const rows = await loadRoomMessages(roomId);
      setMessages(rows);
      await markRoomRead(roomId, user.id);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Guruh xabarlarini yuklab bo‘lmadi.'); }
    finally { setBusy(false); }
  }, [roomId, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToMessages((message) => {
    if (message.room_id !== roomId) return;
    setMessages((current) => current.some((row) => row.id === message.id) ? current : [...current, message]);
    if (user) void markRoomRead(roomId, user.id).catch(() => {});
  }), [roomId, user]);
  if (!loading && !session) return <Redirect href="/login" />;
  const send = async () => {
    const body = draft.trim();
    if (!body || !user || sending) return;
    setSending(true); setDraft('');
    try {
      const message = await sendRoomMessage(user.id, roomId, body);
      setMessages((current) => current.some((row) => row.id === message.id) ? current : [...current, message]);
    } catch (e) { setDraft(body); setError(e instanceof Error ? e.message : 'Xabar yuborilmadi.'); }
    finally { setSending(false); }
  };
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.header, { height: 66 + insets.top, paddingTop: insets.top }]}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.roomIcon}><Text style={styles.roomInitial}>{(name || 'G').slice(0, 1).toUpperCase()}</Text></View><View style={styles.titleWrap}><Text numberOfLines={1} style={styles.title}>{name || 'Guruh'}</Text><Text style={styles.subtitle}>Guruh suhbati</Text></View></View>
    {busy ? <View style={styles.center}><ActivityIndicator color={palette.blue} /></View> : <FlatList ref={list} data={messages} keyExtractor={(item) => String(item.id)} contentContainerStyle={messages.length ? styles.messages : styles.emptyMessages} onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })} ListEmptyComponent={<Text style={styles.empty}>Guruhdagi suhbatni boshlang.</Text>} renderItem={({ item }) => {
      const mine = item.sender === user?.id;
      return <View style={[styles.line, mine ? styles.mine : styles.theirs]}><View style={[styles.bubble, mine ? styles.myBubble : styles.otherBubble]}>{!mine && <Text style={styles.sender}>Guruh a’zosi</Text>}<Text style={styles.body}>{item.body || (item.file_url ? '📎 Fayl' : '')}</Text><Text style={[styles.time, mine && styles.myTime]}>{new Date(item.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</Text></View></View>;
    }} />}
    {!!error && <Pressable onPress={() => void load()}><Text style={styles.error}>{error} · Qayta urinish</Text></Pressable>}
    <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}><TextInput value={draft} onChangeText={setDraft} placeholder="Xabar yozing..." placeholderTextColor={palette.dim} multiline style={styles.input} /><Pressable onPress={send} disabled={!draft.trim() || sending} style={styles.send}><Text style={styles.sendText}>➤</Text></Pressable></View>
  </KeyboardAvoidingView>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }, back: { width: 34 }, backText: { color: palette.text, fontSize: 32 }, roomIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center' }, roomInitial: { color: palette.blue, fontSize: 18, fontWeight: '800' }, titleWrap: { flex: 1 }, title: { color: palette.text, fontWeight: '800', fontSize: 15 }, subtitle: { color: palette.muted, fontSize: 11, marginTop: 2 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, messages: { padding: 14, gap: 8 }, emptyMessages: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }, empty: { color: palette.muted }, line: { flexDirection: 'row' }, mine: { justifyContent: 'flex-end' }, theirs: { justifyContent: 'flex-start' }, bubble: { maxWidth: '84%', minWidth: 82, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 }, myBubble: { backgroundColor: palette.blue }, otherBubble: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, sender: { fontSize: 11, color: '#8DC5FF', fontWeight: '700', marginBottom: 3 }, body: { color: palette.text, fontSize: 15 }, time: { color: '#C9D5E7', fontSize: 10, textAlign: 'right', marginTop: 3 }, myTime: { color: '#DAE9FF' }, error: { color: palette.red, padding: 8 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 9, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border }, input: { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, color: palette.text, backgroundColor: palette.background, borderRadius: 18, borderWidth: 1, borderColor: palette.border }, send: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, sendText: { color: 'white', fontSize: 19 } });
