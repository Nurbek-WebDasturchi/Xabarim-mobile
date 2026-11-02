import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { loadMessages, markConversationRead, sendMessage, subscribeToMessages, type Message } from '@/features/chats/chat-service';

export default function ChatScreen() {
  const { peerId: paramPeer, name: paramName, username: paramUsername } = useLocalSearchParams<{ peerId: string; name?: string; username?: string }>();
  const peerId = Array.isArray(paramPeer) ? paramPeer[0] : paramPeer;
  const name = Array.isArray(paramName) ? paramName[0] : paramName;
  const username = Array.isArray(paramUsername) ? paramUsername[0] : paramUsername;
  const { user, session, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<FlatList<Message>>(null);
  const load = useCallback(async () => {
    if (!user || !peerId) return;
    try {
      const rows = await loadMessages(user.id, peerId);
      setMessages(rows);
      await markConversationRead(user.id, peerId);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Xabarlarni olib bo‘lmadi.'); }
    finally { setBusy(false); }
  }, [user, peerId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToMessages((message) => {
    if (message.sender !== peerId && message.receiver !== peerId) return;
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
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.identity}><View style={styles.avatar}><Text style={styles.initial}>{(name || username || 'X').slice(0, 1).toUpperCase()}</Text></View><View style={styles.person}><Text numberOfLines={1} style={styles.name}>{name || username || 'Suhbat'}</Text><Text style={styles.username}>{username ? `@${username}` : 'Xabarim foydalanuvchisi'}</Text></View></View><View style={styles.more}><Text style={styles.moreText}>•••</Text></View></View>
    {busy ? <View style={styles.center}><ActivityIndicator color="#5848E8" /></View> : <FlatList ref={list} data={messages} keyExtractor={(item) => String(item.id)} contentContainerStyle={messages.length ? styles.messages : styles.emptyMessages} onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })} ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyAvatar}><Text style={styles.emptyInitial}>{(name || username || 'X').slice(0, 1).toUpperCase()}</Text></View><Text style={styles.emptyTitle}>Suhbatni boshlang</Text><Text style={styles.emptyText}>Birinchi xabaringizni yuboring 👋</Text></View>} renderItem={({ item }) => {
      const mine = item.sender === user?.id;
      return <View style={[styles.messageLine, mine ? styles.myLine : styles.theirLine]}><View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble]}><Text style={[styles.body, mine && styles.myBody]}>{item.body || (item.file_url ? '📎 Fayl' : '')}</Text><View style={styles.meta}><Text style={[styles.messageTime, mine && styles.myTime]}>{new Date(item.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</Text>{mine && <Text style={styles.status}>{item.read ? '✓✓' : item.delivered_at ? '✓✓' : '✓'}</Text>}</View></View></View>;
    }} />}
    {!!error && <Pressable onPress={() => void load()}><Text style={styles.error}>{error}  ·  Qayta urinish</Text></Pressable>}
    <View style={styles.composer}><TextInput value={text} onChangeText={setText} placeholder="Xabar yozing..." placeholderTextColor="#A0A1B0" multiline style={styles.input} maxLength={4000} onSubmitEditing={submit} blurOnSubmit={false} /><Pressable onPress={submit} disabled={!text.trim() || sending} style={[styles.send, (!text.trim() || sending) && styles.sendDisabled]}><Text style={styles.sendText}>➤</Text></Pressable></View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7F8FC', paddingTop: 50 }, header: { minHeight: 67, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8EF', backgroundColor: 'white' }, back: { width: 37, height: 42, justifyContent: 'center' }, backText: { color: '#292A40', fontSize: 33, lineHeight: 37 }, identity: { flex: 1, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#E9E7FF', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#5848E8', fontSize: 17, fontWeight: '800' }, person: { marginLeft: 10, flex: 1 }, name: { color: '#202137', fontSize: 15, fontWeight: '800' }, username: { color: '#85869A', fontSize: 11, marginTop: 3 }, more: { width: 37, alignItems: 'center' }, moreText: { color: '#77788D', fontSize: 17 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, messages: { paddingHorizontal: 14, paddingVertical: 18, gap: 9 }, emptyMessages: { flexGrow: 1, justifyContent: 'center' }, empty: { alignItems: 'center', paddingHorizontal: 35 }, emptyAvatar: { width: 70, height: 70, borderRadius: 26, backgroundColor: '#E9E7FF', alignItems: 'center', justifyContent: 'center' }, emptyInitial: { color: '#5848E8', fontSize: 27, fontWeight: '800' }, emptyTitle: { color: '#202137', fontSize: 18, fontWeight: '800', marginTop: 16 }, emptyText: { color: '#85869A', fontSize: 14, marginTop: 7 }, messageLine: { width: '100%', flexDirection: 'row' }, myLine: { justifyContent: 'flex-end' }, theirLine: { justifyContent: 'flex-start' }, bubble: { maxWidth: '83%', minWidth: 75, paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7, borderRadius: 18 }, myBubble: { backgroundColor: '#5848E8', borderBottomRightRadius: 5 }, theirBubble: { backgroundColor: 'white', borderBottomLeftRadius: 5 }, body: { fontSize: 15, lineHeight: 21, color: '#28293E' }, myBody: { color: 'white' }, meta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 3 }, messageTime: { color: '#9B9CAF', fontSize: 10 }, myTime: { color: '#D5D0FF' }, status: { color: '#D5D0FF', fontSize: 10 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingHorizontal: 13, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 20 : 12, backgroundColor: 'white', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8EF' }, input: { flex: 1, minHeight: 45, maxHeight: 120, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 17, backgroundColor: '#F5F5F9', color: '#202137', fontSize: 15 }, send: { width: 45, height: 45, borderRadius: 16, backgroundColor: '#5848E8', alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: '#B8B3EB' }, sendText: { color: 'white', fontSize: 20, marginLeft: 2 }, error: { color: '#B73747', paddingHorizontal: 16, paddingVertical: 7, fontSize: 12 } });
