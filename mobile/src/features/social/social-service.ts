import type { Profile } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { sendActivityPush } from '@/features/notifications/push-notifications';

export type Post = {
  id: number;
  author: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>;
};
export type PostComment = { id: number; post_id: number; user_id: string; body: string; created_at: string };
export type PostEngagement = { likes: Record<number, number>; liked: number[]; comments: Record<number, PostComment[]> };

export async function loadPostEngagement(postIds: number[], userId: string): Promise<PostEngagement> {
  if (!postIds.length) return { likes: {}, liked: [], comments: {} };
  const db = getSupabaseClient();
  const [reactionResult, commentResult] = await Promise.all([
    db.from('post_reactions').select('post_id,user_id,emoji').in('post_id', postIds),
    db.from('post_comments').select('id,post_id,user_id,body,created_at').in('post_id', postIds).order('created_at', { ascending: true }),
  ]);
  if (reactionResult.error) throw reactionResult.error;
  if (commentResult.error) throw commentResult.error;
  const likes: Record<number, number> = {};
  const liked: number[] = [];
  for (const reaction of reactionResult.data ?? []) {
    if (reaction.emoji !== '❤️' && reaction.emoji !== '👍') continue;
    likes[reaction.post_id] = (likes[reaction.post_id] ?? 0) + 1;
    if (reaction.user_id === userId) liked.push(reaction.post_id);
  }
  const comments: Record<number, PostComment[]> = {};
  for (const comment of (commentResult.data ?? []) as PostComment[]) (comments[comment.post_id] ??= []).push(comment);
  return { likes, liked, comments };
}

export async function loadFeed(): Promise<Post[]> {
  const db = getSupabaseClient();
  const { data, error } = await db.rpc('global_posts', { p_limit: 50 });
  let posts: Post[];
  if (!error && data) posts = data as Post[];
  else {
    const { data: rows, error: queryError } = await db.from('posts').select('*').order('created_at', { ascending: false }).limit(50);
    if (queryError) throw queryError;
    posts = (rows ?? []) as Post[];
  }
  if (!posts.length) return [];
  const ids = [...new Set(posts.map((post) => post.author))];
  const { data: profiles, error: profileError } = await db.from('profiles').select('id,username,full_name,avatar_url').in('id', ids);
  if (profileError) throw profileError;
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return posts.map((post) => ({ ...post, profiles: byId.get(post.author) }));
}

export async function createPost(author: string, body: string) {
  const { error } = await getSupabaseClient().from('posts').insert({ author, body });
  if (error) throw error;
}

export async function loadFollowStats(userId: string) {
  const { data, error } = await getSupabaseClient().rpc('follow_stats', { p_user: userId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function updateMyProfile(userId: string, fullName: string, bio: string) {
  const { data, error } = await getSupabaseClient().from('profiles').update({ full_name: fullName.trim(), bio: bio.trim() }).eq('id', userId).select('id,username,full_name,avatar_url,bio,last_seen,is_private').single();
  if (error) throw error;
  return data as Profile;
}

export async function updateAccountPrivacy(userId: string, isPrivate: boolean) {
  const { error } = await getSupabaseClient().from('profiles').update({ is_private: isPrivate }).eq('id', userId);
  if (error) throw error;
}

export type FollowState = 'none' | 'pending' | 'following';
export async function loadFollowState(myId: string, targetId: string): Promise<FollowState> {
  const db = getSupabaseClient();
  const [{ data: follow, error: followError }, { data: request, error: requestError }] = await Promise.all([
    db.from('follows').select('follower').eq('follower', myId).eq('following', targetId).maybeSingle(),
    db.from('follow_requests').select('id').eq('requester_id', myId).eq('target_id', targetId).maybeSingle(),
  ]);
  if (followError) throw followError;
  if (requestError) throw requestError;
  return follow ? 'following' : request ? 'pending' : 'none';
}

export async function followUser(myId: string, userId: string, isPrivate: boolean, sessionToken?: string) {
  const db = getSupabaseClient();
  if (isPrivate) {
    const { error } = await db.from('follow_requests').upsert({ requester_id: myId, target_id: userId }, { onConflict: 'requester_id,target_id', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await db.from('follows').insert({ follower: myId, following: userId });
    if (error && error.code !== '23505') throw error;
    if (!error && sessionToken) void sendActivityPush(sessionToken, userId, 'follow');
  }
}

export async function cancelFollowRequest(myId: string, targetId: string) {
  const { error } = await getSupabaseClient().from('follow_requests').delete().eq('requester_id', myId).eq('target_id', targetId);
  if (error) throw error;
}

export async function loadIncomingFollowRequests(userId: string) {
  const { data, error } = await getSupabaseClient().from('follow_requests').select('id,requester_id,created_at,profiles!follow_requests_requester_id_fkey(id,username,full_name,avatar_url)').eq('target_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function decideFollowRequest(requestId: number, requesterId: string, accept: boolean) {
  const { data, error } = await getSupabaseClient().rpc('decide_follow_request', { p_request: requestId, p_accept: accept });
  if (error) throw error;
  if (!data) throw new Error('So‘rov topilmadi yoki allaqachon ko‘rib chiqilgan.');
}

export async function unfollowUser(myId: string, userId: string) {
  const { error } = await getSupabaseClient().from('follows').delete().eq('follower', myId).eq('following', userId);
  if (error) throw error;
}

export async function reactToPost(postId: number, userId: string, emoji: string, authorId?: string, sessionToken?: string) {
  const { error } = await getSupabaseClient().from('post_reactions').upsert({ post_id: postId, user_id: userId, emoji }, { onConflict: 'post_id,user_id' });
  if (error) throw error;
  if (authorId && authorId !== userId && sessionToken) void sendActivityPush(sessionToken, authorId, 'like');
}

export async function removePostReaction(postId: number, userId: string) {
  const { error } = await getSupabaseClient().from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}

export async function addPostComment(postId: number, body: string) {
  const { error } = await getSupabaseClient().from('post_comments').insert({ post_id: postId, body: body.trim() });
  if (error) throw error;
}
