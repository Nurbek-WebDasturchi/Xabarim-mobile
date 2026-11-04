import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/auth-context';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { joinCommunity, loadCommunity, loadCommunityPreview, loadRoomMessages, markRoomRead, sendRoomMessage, subscribeToMessages, type Community, type Message } from '@/features/chats/chat-service';

export default function CommunityScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { roomId: rawId } = useLocalSearchParams<{ roomId: string }>();
  const roomId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const { user, session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Message>>(null);
  const [room, setRoom] = useState<Community | null>(null);
  const [member, setMember] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user || !Number.isFinite(roomId)) return;
    try {
      const state = await loadCommunity(roomId, user.id);
      setRoom(state.room);
      setMember(state.member);
      setMessageCount(state.messageCount);
      const rows = state.member ? await loadRoomMessages(roomId) : await loadCommunityPreview(roomId);
      setMessages(rows);
      if (state.member) await markRoomRead(roomId, user.id);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Hamjamiyatni yuklab bo‘lmadi.'); }
    finally { setBusy(false); }
  }, [roomId, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToMessages((message) => {
    if (message.room_id !== roomId) return;
    setMessageCount((count) => count + 1);
    if (!member) {
      setMessages((current) => [...current, message].slice(-5));
      return;
    }
    setMessages((current) => current.some((row) => row.id === message.id) ? current : [...current, message]);
    if (user) void markRoomRead(roomId, user.id).catch(() => {});
  }), [member, roomId, user]);
  if (!loading && !session) return <Redirect href="/login" />;
  const join = async () => {
    if (!user || joining) return;
    setJoining(true);
    try {
      await joinCommunity(roomId, user.id);
      setMember(true);
      const rows = await loadRoomMessages(roomId);
      setMessages(rows);
      await markRoomRead(roomId, user.id);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Hamjamiyatga qo‘shilmadi.'); }
    finally { setJoining(false); }
  };
  const send = async () => {
    const body = draft.trim();
    if (!body || !user || sending || !member) return;
    setSending(true); setDraft('');
    try {
      const message = await sendRoomMessage(user.id, roomId, body);
      setMessages((current) => current.some((row) => row.id === message.id) ? current : [...current, message]);
      setMessageCount((count) => count + 1);
    } catch (e) { setDraft(body); setError(e instanceof Error ? e.message : 'Xabar yuborilmadi.'); }
    finally { setSending(false); }
  };
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.header, { height: 66 + insets.top, paddingTop: insets.top }]}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.roomIcon}><Feather name="radio" size={20} color={palette.blue} /></View><View style={styles.titleWrap}><Text numberOfLines={1} style={styles.title}>{room?.name || 'Xabarim Official'}</Text><Text style={styles.subtitle}>{room?.kind === 'community' ? `Hamjamiyat${member ? ' · A’zo' : ''}` : 'Yuklanmoqda'}</Text></View></View>
    {busy ? <View style={styles.center}><ActivityIndicator color={palette.blue} /></View> : <FlatList ref={list} data={messages} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.messages} onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })} ListHeaderComponent={!member && messageCount > 5 ? <View style={styles.locked}><View style={styles.fauxHistory} pointerEvents="none">{[0, 1, 2].map((item) => <View key={item} style={[styles.fauxBubble, item % 2 ? styles.fauxRight : styles.fauxLeft]}><View style={styles.fauxLine} /><View style={[styles.fauxLine, styles.fauxShort]} /></View>)}<BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} /></View><Feather name="lock" size={18} color={palette.blue} /><Text style={styles.lockedTitle}>{messageCount - 5} ta oldingi xabar yopiq</Text><Text style={styles.lockedText}>To‘liq tarixni ko‘rish uchun hamjamiyatga qo‘shiling.</Text><Pressable disabled={joining} onPress={() => void join()} style={({ pressed }) => [styles.joinButton, pressed && styles.pressed, joining && styles.disabled]}><Text style={styles.joinText}>{joining ? 'Qo‘shilyapti…' : 'Hamjamiyatga qo‘shilish'}</Text></Pressable></View> : undefined} ListEmptyComponent={<Text style={styles.empty}>Hozircha xabar yo‘q.</Text>} renderItem={({ item }) => {
      const mine = item.sender === user?.id;
      return <View style={[styles.line, mine ? styles.mine : styles.theirs]}><View style={[styles.bubble, mine ? styles.myBubble : styles.otherBubble]}>{!mine && <Text style={styles.sender}>Xabarim Official</Text>}<Text style={styles.body}>{item.body || (item.file_url ? '📎 Fayl' : '')}</Text><Text style={[styles.time, mine && styles.myTime]}>{new Date(item.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</Text></View></View>;
    }} />}
    {!busy && !member && <View style={[styles.previewFooter, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}><Text style={styles.previewText}>{messages.length ? `Oxirgi ${messages.length} ta xabar ko‘rsatilmoqda` : 'Kanal xabarlarini ko‘rish uchun qo‘shiling'}</Text>{!(messageCount > 5) && <Pressable disabled={joining} onPress={() => void join()} style={({ pressed }) => [styles.joinButton, pressed && styles.pressed]}><Text style={styles.joinText}>{joining ? 'Qo‘shilyapti…' : 'Qo‘shilish'}</Text></Pressable>}</View>}
    {!!error && <Pressable onPress={() => void load()}><Text style={styles.error}>{error} · Qayta urinish</Text></Pressable>}
    {member && <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}><TextInput value={draft} onChangeText={setDraft} placeholder="Xabar yozing..." placeholderTextColor={palette.dim} multiline style={styles.input} /><Pressable onPress={() => void send()} disabled={!draft.trim() || sending} style={styles.send}><Text style={styles.sendText}>➤</Text></Pressable></View>}
  </KeyboardAvoidingView>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border }, back: { width: 34 }, backText: { color: palette.text, fontSize: 32 }, roomIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center' }, titleWrap: { flex: 1 }, title: { color: palette.text, fontWeight: '800', fontSize: 15 }, subtitle: { color: palette.muted, fontSize: 11, marginTop: 2 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, messages: { flexGrow: 1, padding: 14, gap: 8 }, empty: { color: palette.muted, textAlign: 'center', padding: 28 }, locked: { alignItems: 'center', padding: 17, marginBottom: 14, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 18 }, fauxHistory: { alignSelf: 'stretch', gap: 6, marginBottom: 10, overflow: 'hidden', borderRadius: 12 }, fauxBubble: { width: '72%', height: 30, borderRadius: 10, backgroundColor: palette.raised, padding: 6, gap: 4 }, fauxLeft: { alignSelf: 'flex-start' }, fauxRight: { alignSelf: 'flex-end' }, fauxLine: { height: 5, width: '80%', borderRadius: 4, backgroundColor: palette.dim }, fauxShort: { width: '45%' }, lockedTitle: { color: palette.text, fontSize: 15, fontWeight: '800', marginTop: 7 }, lockedText: { color: palette.muted, textAlign: 'center', fontSize: 12, marginTop: 4, marginBottom: 10 }, line: { flexDirection: 'row' }, mine: { justifyContent: 'flex-end' }, theirs: { justifyContent: 'flex-start' }, bubble: { maxWidth: '84%', minWidth: 82, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 }, myBubble: { backgroundColor: palette.blue }, otherBubble: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, sender: { fontSize: 11, color: '#8DC5FF', fontWeight: '700', marginBottom: 3 }, body: { color: palette.text, fontSize: 15 }, time: { color: '#C9D5E7', fontSize: 10, textAlign: 'right', marginTop: 3 }, myTime: { color: '#DAE9FF' }, joinButton: { minHeight: 42, paddingHorizontal: 18, borderRadius: 22, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, joinText: { color: 'white', fontWeight: '800', fontSize: 13 }, disabled: { opacity: 0.6 }, pressed: { opacity: 0.82 }, previewFooter: { alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingTop: 10, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border }, previewText: { color: palette.muted, fontSize: 12 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 9, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border }, input: { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, color: palette.text, backgroundColor: palette.background, borderRadius: 18, borderWidth: 1, borderColor: palette.border }, send: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, sendText: { color: 'white', fontSize: 19 }, error: { color: palette.red, padding: 8 } });
