import { getSupabaseClient } from '@/lib/supabase';
import type { Profile } from '@/features/auth/auth-context';

export type Message = {
  id: number;
  sender: string;
  receiver: string | null;
  body: string | null;
  file_url: string | null;
  file_type: string | null;
  created_at: string;
  read: boolean;
  delivered_at: string | null;
  room_id: number | null;
};

export type Conversation = { peer: Profile; last: Message; unread: number };
export type RoomConversation = { room: { id: number; name: string; kind: string; description: string | null }; last: Message | null; unread: number };
export type Community = { id: number; name: string; kind: 'community'; description: string | null };

export function describeChatLoadError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const dbError = error as { message?: string; code?: string; details?: string; hint?: string };
  const code = dbError.code ? ` [${dbError.code}]` : '';
  const message = dbError.message?.trim();
  return message ? `${fallback}${code}: ${message}` : fallback;
}

function client() {
  return getSupabaseClient();
}

export async function loadConversations(userId: string): Promise<Conversation[]> {
  const db = client();
  // Keep the personal-chat filter independent from the OR expression so PostgREST
  // cannot accidentally include room messages in the inbox query.
  const { data, error } = await db.from('messages').select('id,sender,receiver,body,file_url,file_type,created_at,read,delivered_at,room_id')
    .is('room_id', null).or(`sender.eq.${userId},receiver.eq.${userId}`).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  const latest = new Map<string, { last: Message; unread: number }>();
  for (const raw of (data ?? []) as Message[]) {
    const peerId = raw.sender === userId ? raw.receiver : raw.sender;
    if (!peerId) continue;
    const item = latest.get(peerId) ?? { last: raw, unread: 0 };
    if (raw.receiver === userId && !raw.read) item.unread += 1;
    latest.set(peerId, item);
  }
  const ids = [...latest.keys()];
  if (ids.length === 0) return [];
  const { data: profiles, error: profileError } = await db.from('profiles').select('id,username,full_name,avatar_url,bio,last_seen,is_private').in('id', ids);
  if (profileError) throw profileError;
  const byId = new Map((profiles as Profile[]).map((item) => [item.id, item]));
  return [...latest.entries()].flatMap(([id, value]) => {
    const peer = byId.get(id);
    return peer ? [{ peer, ...value }] : [];
  });
}

export async function loadRoomConversations(userId: string): Promise<RoomConversation[]> {
  const db = client();
  const { data: memberships, error: membershipError } = await db.from('room_members').select('room_id,rooms(id,name,kind,description)').eq('user_id', userId);
  if (membershipError) throw membershipError;
  const rooms = (memberships ?? []).map((row: any) => row.rooms).filter((room: any) => room?.kind === 'group');
  if (!rooms.length) return [];
  const ids = rooms.map((room: any) => room.id);
  const { data: messages, error } = await db.from('messages').select('id,sender,receiver,body,file_url,file_type,created_at,read,delivered_at,room_id').in('room_id', ids).order('created_at', { ascending: false });
  if (error) throw error;
  const latest = new Map<number, Message>();
  const unread = new Map<number, number>();
  for (const message of (messages ?? []) as Message[]) {
    if (!message.room_id) continue;
    if (!latest.has(message.room_id)) latest.set(message.room_id, message);
    if (message.sender !== userId && !message.read) unread.set(message.room_id, (unread.get(message.room_id) ?? 0) + 1);
  }
  return rooms.map((room: any) => ({ room, last: latest.get(room.id) ?? null, unread: unread.get(room.id) ?? 0 }));
}

export async function loadRoomMessages(roomId: number): Promise<Message[]> {
  const { data, error } = await client().from('messages').select('id,sender,receiver,body,file_url,file_type,created_at,read,delivered_at,room_id').eq('room_id', roomId).order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function loadCommunity(roomId: number, userId: string) {
  const db = client();
  const { data: room, error: roomError } = await db.from('rooms').select('id,name,kind,description').eq('id', roomId).eq('kind', 'community').single();
  if (roomError) throw roomError;
  const { data: membership, error: membershipError } = await db.from('room_members').select('room_id').eq('room_id', roomId).eq('user_id', userId).maybeSingle();
  if (membershipError) throw membershipError;
  const { data: counts, error: countError } = await db.rpc('community_message_counts');
  if (countError) throw countError;
  const count = (counts ?? []).find((row: { room_id: number; message_count: number }) => row.room_id === roomId)?.message_count ?? 0;
  return { room: room as Community, member: !!membership, messageCount: count };
}

export async function loadCommunityPreview(roomId: number): Promise<Message[]> {
  const { data, error } = await client().from('messages').select('id,sender,receiver,body,file_url,file_type,created_at,read,delivered_at,room_id').eq('room_id', roomId).order('created_at', { ascending: false }).limit(5);
  if (error) throw error;
  return ((data ?? []) as Message[]).reverse();
}

export async function joinCommunity(roomId: number, userId: string) {
  const { error } = await client().from('room_members').insert({ room_id: roomId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}

export async function sendRoomMessage(userId: string, roomId: number, body: string): Promise<Message> {
  const { data, error } = await client().from('messages').insert({ sender: userId, room_id: roomId, body }).select('id,sender,receiver,body,file_url,file_type,created_at,read,delivered_at,room_id').single();
  if (error) throw error;
  return data as Message;
}

export async function sendPushMessage(sessionToken: string, recipient: string, message: Message) {
  if (message.room_id || !message.receiver) return;
  await fetch('https://www.xabarim.uz/api/push/message', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, body: message.body || 'Sizga yangi xabar yuborildi', message_id: message.id }),
  });
}

export async function markRoomRead(roomId: number, userId: string) {
  const { error } = await client().from('messages').update({ read: true }).eq('room_id', roomId).neq('sender', userId).eq('read', false);
  if (error) throw error;
}

export async function loadMessages(userId: string, peerId: string): Promise<Message[]> {
  const db = client();
  const { data, error } = await db.from('messages').select('id,sender,receiver,body,file_url,file_type,created_at,read,delivered_at,room_id')
    .is('room_id', null)
    .or(`and(sender.eq.${userId},receiver.eq.${peerId}),and(sender.eq.${peerId},receiver.eq.${userId})`)
    .order('created_at', { ascending: true }).limit(300);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(userId: string, peerId: string, body: string): Promise<Message> {
  const db = client();
  const { data, error } = await db.from('messages').insert({ sender: userId, receiver: peerId, body }).select('id,sender,receiver,body,file_url,file_type,created_at,read,delivered_at,room_id').single();
  if (error) throw error;
  return data as Message;
}

export async function markConversationRead(userId: string, peerId: string) {
  const { error } = await client().from('messages').update({ read: true }).eq('sender', peerId).eq('receiver', userId).eq('read', false);
  if (error) throw error;
}

export function subscribeToMessages(onMessage: (message: Message) => void) {
  const channel = client().channel(`native-inbox-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => onMessage(payload.new as Message))
    .subscribe();
  return () => { void client().removeChannel(channel); };
}
