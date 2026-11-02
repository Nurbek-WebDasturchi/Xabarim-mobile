import type { Profile } from '@/features/auth/auth-context';
import { getSupabaseClient } from '@/lib/supabase';

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
  const { data, error } = await getSupabaseClient().from('profiles').update({ full_name: fullName.trim(), bio: bio.trim() }).eq('id', userId).select('id,username,full_name,avatar_url,bio,last_seen').single();
  if (error) throw error;
  return data as Profile;
}

export async function followUser(userId: string) {
  const { error } = await getSupabaseClient().from('follows').insert({ following: userId });
  if (error && error.code !== '23505') throw error;
}

export async function unfollowUser(myId: string, userId: string) {
  const { error } = await getSupabaseClient().from('follows').delete().eq('follower', myId).eq('following', userId);
  if (error) throw error;
}

export async function reactToPost(postId: number, userId: string, emoji: string) {
  const { error } = await getSupabaseClient().from('post_reactions').upsert({ post_id: postId, user_id: userId, emoji }, { onConflict: 'post_id,user_id' });
  if (error) throw error;
}

export async function removePostReaction(postId: number, userId: string) {
  const { error } = await getSupabaseClient().from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
  if (error) throw error;
}

export async function addPostComment(postId: number, body: string) {
  const { error } = await getSupabaseClient().from('post_comments').insert({ post_id: postId, body: body.trim() });
  if (error) throw error;
}
