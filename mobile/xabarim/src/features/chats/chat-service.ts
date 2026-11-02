import { supabase } from '@/lib/supabase';
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

function client() {
  if (!supabase) throw new Error('Supabase sozlamalari topilmadi.');
  return supabase;
}

export async function loadConversations(userId: string): Promise<Conversation[]> {
  const db = client();
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
  const { data: profiles, error: profileError } = await db.from('profiles').select('id,username,full_name,avatar_url,bio,last_seen').in('id', ids);
  if (profileError) throw profileError;
  const byId = new Map((profiles as Profile[]).map((item) => [item.id, item]));
  return [...latest.entries()].flatMap(([id, value]) => {
    const peer = byId.get(id);
    return peer ? [{ peer, ...value }] : [];
  });
}

export async function loadMessages(userId: string, peerId: string): Promise<Message[]> {
  const db = client();
  const { data, error } = await db.from('messages').select('id,sender,receiver,body,file_url,file_type,created_at,read,delivered_at,room_id')
    .is('room_id', null).or(`and(sender.eq.${userId},receiver.eq.${peerId}),and(sender.eq.${peerId},receiver.eq.${userId})`)
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
