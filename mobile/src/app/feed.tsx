import { Redirect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/auth-context';
import { addPostComment, createPost, loadFeed, loadPostEngagement, reactToPost, removePostReaction, type Post, type PostComment } from '@/features/social/social-service';
import { getSupabaseClient } from '@/lib/supabase';
import { AppNav } from '@/components/app-nav';
import { AppHeader } from '@/components/app-header';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { isVideoUrl, PostVideo } from '@/components/post-video';

type Note = { user_id: string; text: string; created_at: string };

export default function FeedScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, profile, session, loading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [busy, setBusy] = useState(true);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const lastImageTap = useRef<{ postId: number; time: number } | null>(null);
  const [likedAnimation, setLikedAnimation] = useState<number | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [likedPosts, setLikedPosts] = useState<number[]>([]);
  const [comments, setComments] = useState<Record<number, PostComment[]>>({});
  const [imageRatios, setImageRatios] = useState<Record<number, number>>({});
  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      const db = getSupabaseClient();
      const [feed, noteResult] = await Promise.all([
        loadFeed(),
        db.rpc('feed_notes').then(async (result) => {
          if (!result.error && result.data) return result.data as Note[];
          const fallback = await db.from('notes').select('user_id,text,created_at').gt('created_at', new Date(Date.now() - 864e5).toISOString()).limit(80);
          if (fallback.error) throw fallback.error;
          return (fallback.data ?? []) as Note[];
        }),
      ]);
      const engagement = await loadPostEngagement(feed.map((post) => post.id), user.id);
      setPosts(feed);
      setLikeCounts(engagement.likes);
      setLikedPosts(engagement.liked);
      setComments(engagement.comments);
      setNotes(noteResult);
    } catch (e) { setError(e instanceof Error ? e.message : 'Lentani yuklab bo‘lmadi.'); }
    finally { setBusy(false); setRefreshing(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  if (!loading && !session) return <Redirect href="/login" />;
  const publish = async () => {
    if (!draft.trim() || !user || posting) return;
    setPosting(true); setError('');
    try { await createPost(user.id, draft.trim()); setDraft(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Postni joylab bo‘lmadi.'); }
    finally { setPosting(false); }
  };
  const publishNote = async () => {
    if (!noteDraft.trim() || noteDraft.trim().length > 60 || !user || posting) return;
    setPosting(true);
    try {
      const db = getSupabaseClient();
      const { error: rpcError } = await db.rpc('set_note', { p_text: noteDraft.trim() });
      if (rpcError) {
        if (rpcError.code !== 'PGRST202' && rpcError.code !== '42883') throw rpcError;
        const { error: saveError } = await db.from('notes').upsert({ user_id: user.id, text: noteDraft.trim(), created_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (saveError) throw saveError;
      }
      setNoteDraft(''); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Note saqlanmadi.'); }
    finally { setPosting(false); }
  };
  const like = async (post: Post, forceLike = false) => {
    if (!user) return;
    const wasLiked = likedPosts.includes(post.id);
    if (forceLike && wasLiked) return;
    setLikedPosts((current) => wasLiked ? current.filter((id) => id !== post.id) : [...current, post.id]);
    setLikeCounts((current) => ({ ...current, [post.id]: Math.max(0, (current[post.id] ?? 0) + (wasLiked ? -1 : 1)) }));
    try { if (wasLiked) await removePostReaction(post.id, user.id); else await reactToPost(post.id, user.id, '❤️', post.author, session?.access_token); }
    catch (e) {
      setLikedPosts((current) => wasLiked ? [...current, post.id] : current.filter((id) => id !== post.id));
      setLikeCounts((current) => ({ ...current, [post.id]: Math.max(0, (current[post.id] ?? 0) + (wasLiked ? 1 : -1)) }));
      setError(e instanceof Error ? e.message : 'Reaksiya yuborilmadi.');
    }
  };
  const onPostImagePress = (post: Post) => {
    const now = Date.now();
    const previousTap = lastImageTap.current;
    lastImageTap.current = { postId: post.id, time: now };
    if (previousTap?.postId === post.id && now - previousTap.time < 450) {
      lastImageTap.current = null;
      void like(post, true);
      setLikedAnimation(post.id);
      setTimeout(() => setLikedAnimation((current) => current === post.id ? null : current), 700);
    }
  };
  const comment = async (postId: number) => {
    const body = commentDraft.trim();
    if (!body) return;
    try { await addPostComment(postId, body); setComments((current) => ({ ...current, [postId]: [...(current[postId] ?? []), { id: Date.now(), post_id: postId, user_id: user?.id || '', body, created_at: new Date().toISOString() }] })); setCommentDraft(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Izoh yuborilmadi.'); }
  };
  return <View style={styles.page}>
    <AppHeader />
    <View style={styles.header}><Text style={styles.title}>Postlar</Text><View style={styles.filters}><Text style={styles.filterActive}>◎ Global</Text><Text style={styles.filter}>♧ Kuzatilmoqda</Text><Text style={styles.filter}>♨ Trend</Text></View></View>
    <FlatList data={posts} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#5848E8" />} ListHeaderComponent={<>
      <View style={styles.notesHeading}><Text style={styles.sectionTitle}>24 soatlik Notelar</Text><Text style={styles.noteCount}>{notes.length}</Text></View>
      <View style={styles.noteComposer}><TextInput value={noteDraft} onChangeText={setNoteDraft} placeholder="Bugun nima gap?" placeholderTextColor="#9697A9" maxLength={60} style={styles.noteInput} /><Pressable onPress={publishNote} disabled={!noteDraft.trim() || posting} style={styles.noteButton}><Text style={styles.noteButtonText}>＋</Text></Pressable></View>
      {notes.length > 0 && <FlatList horizontal data={notes} keyExtractor={(item) => item.user_id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notesList} renderItem={({ item }) => <View style={styles.noteCard}><View style={styles.noteDot}><Text style={styles.noteDotText}>{item.user_id === user?.id ? 'S' : '✦'}</Text></View><Text numberOfLines={2} style={styles.noteText}>{item.text}</Text></View>} />}
      <View style={styles.sectionLine}><Text style={styles.sectionTitle}>Postlar</Text><Text style={styles.postCount}>{posts.length}</Text></View>
      <View style={styles.composeCard}><TextInput value={draft} onChangeText={setDraft} placeholder="Nima yangilik?" placeholderTextColor="#9697A9" multiline maxLength={2000} style={styles.composeInput} /><View style={styles.composeBottom}><Text style={styles.charCount}>{draft.length}/2000</Text><Pressable onPress={publish} disabled={!draft.trim() || posting} style={[styles.publishButton, !draft.trim() && styles.disabled]}>{posting ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.publishText}>Joylash</Text>}</Pressable></View></View>
      {!!error && <Pressable onPress={() => void load()}><Text style={styles.error}>{error}  ·  Yangilash</Text></Pressable>}
    </>} ListEmptyComponent={busy ? <ActivityIndicator style={{ marginTop: 35 }} color={palette.blue} /> : <Text style={styles.empty}>Hozircha post yo‘q. Birinchi bo‘lib ulashing.</Text>} renderItem={({ item }) => <View style={styles.postCard}>
      <View style={styles.postHeader}>{item.profiles?.avatar_url ? <Image source={{ uri: item.profiles.avatar_url }} style={styles.authorAvatar} /> : <View style={styles.authorAvatar}><Text style={styles.authorInitial}>{(item.profiles?.full_name || item.profiles?.username || 'X').slice(0, 1).toUpperCase()}</Text></View>}<View style={styles.authorDetails}><Text style={styles.authorName}>{item.profiles?.full_name || item.profiles?.username || 'Xabarim foydalanuvchisi'}</Text><Text style={styles.authorMeta}>@{item.profiles?.username || 'user'} · {new Date(item.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}</Text></View></View>
      {!!item.body && <Text style={styles.postBody}>{item.body}</Text>}{!!item.image_url && (isVideoUrl(item.image_url) ? <View style={[styles.postImageWrap, { height: 250 }]}><PostVideo uri={item.image_url} /></View> : <Pressable onPress={() => onPostImagePress(item)} style={[styles.postImageWrap, { height: undefined }]}><Image source={{ uri: item.image_url }} style={[styles.postImage, { height: undefined, aspectRatio: imageRatios[item.id] ?? 1 }]} onLoad={(event) => { const { width, height } = event.nativeEvent.source; if (width && height) { const ratio = Math.min(1.91, Math.max(0.8, width / height)); setImageRatios((current) => current[item.id] === ratio ? current : { ...current, [item.id]: ratio }); } }} resizeMode="cover" />{likedAnimation === item.id && <View pointerEvents="none" style={styles.likeOverlay}><Text style={styles.bigHeart}>♥</Text></View>}</Pressable>)}
      <View style={styles.actions}><Pressable onPress={() => void like(item)} style={styles.action}><Text style={[styles.likeIcon, likedPosts.includes(item.id) && { color: palette.red }]}>♥</Text><Text style={styles.actionCount}>{likeCounts[item.id] ?? 0}</Text></Pressable><Pressable onPress={() => setCommentPostId((current) => current === item.id ? null : item.id)} style={styles.action}><Ionicons name="chatbubble-outline" size={25} color={palette.text} /><Text style={styles.actionCount}>{comments[item.id]?.length ?? 0}</Text></Pressable></View>
      {commentPostId === item.id && <View style={{ paddingHorizontal: 14, paddingTop: 5 }}>{(comments[item.id] ?? []).map((row) => <View key={row.id} style={{ flexDirection: 'row', marginTop: 6 }}><Text style={{ color: palette.text, fontWeight: '800', fontSize: 12 }}>{row.user_id === user?.id ? 'Siz' : 'Foydalanuvchi'} </Text><Text style={{ color: palette.muted, fontSize: 12, flex: 1 }}>{row.body}</Text></View>)}<View style={styles.commentComposer}><TextInput value={commentDraft} onChangeText={setCommentDraft} placeholder="Izoh yozing..." placeholderTextColor={palette.dim} maxLength={1000} style={styles.commentInput} /><Pressable onPress={() => void comment(item.id)}><Text style={styles.commentSend}>Yuborish</Text></Pressable></View></View>}
    </View>} />
    <AppNav />
  </View>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background, paddingTop: 0 }, header: { minHeight: 65, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.border }, title: { color: palette.text, fontSize: 16, fontWeight: '800' }, filters: { flexDirection: 'row', gap: 4 }, filterActive: { color: 'white', fontSize: 9, fontWeight: '700', backgroundColor: palette.blue, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 12, overflow: 'hidden' }, filter: { color: palette.muted, fontSize: 9, fontWeight: '700', backgroundColor: palette.surface, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: palette.border }, list: { paddingHorizontal: 14, paddingBottom: 100 }, notesHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }, sectionTitle: { color: palette.text, fontSize: 16, fontWeight: '800' }, noteCount: { color: palette.muted, fontSize: 12 }, noteComposer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: palette.surface, height: 48, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1, borderColor: palette.border }, noteInput: { flex: 1, color: palette.text, fontSize: 14 }, noteButton: { width: 32, height: 32, borderRadius: 11, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, noteButtonText: { color: 'white', fontSize: 23, lineHeight: 26 }, notesList: { gap: 9, paddingVertical: 12 }, noteCard: { width: 112, minHeight: 76, padding: 10, borderRadius: 16, backgroundColor: palette.raised, justifyContent: 'space-between', borderWidth: 1, borderColor: palette.border }, noteDot: { height: 25, width: 25, borderRadius: 13, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, noteDotText: { color: 'white', fontWeight: '800', fontSize: 11 }, noteText: { color: palette.text, fontSize: 12, lineHeight: 16 }, sectionLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 10 }, postCount: { color: palette.muted, fontSize: 12 }, composeCard: { backgroundColor: palette.surface, borderRadius: 18, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: palette.border }, composeInput: { minHeight: 50, maxHeight: 130, color: palette.text, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' }, composeBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }, charCount: { color: palette.dim, fontSize: 11 }, publishButton: { paddingHorizontal: 15, paddingVertical: 9, backgroundColor: palette.blue, borderRadius: 12, minWidth: 72, alignItems: 'center' }, disabled: { backgroundColor: palette.dim }, publishText: { color: 'white', fontWeight: '800', fontSize: 12 }, error: { color: palette.red, fontSize: 12, marginBottom: 10 }, empty: { marginTop: 25, textAlign: 'center', color: palette.muted, fontSize: 14 }, postCard: { backgroundColor: palette.surface, borderRadius: 21, paddingTop: 14, paddingBottom: 14, borderWidth: 1, borderColor: palette.border, marginBottom: 12, overflow: 'hidden' }, postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, authorAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, authorInitial: { color: 'white', fontSize: 16, fontWeight: '800' }, authorDetails: { marginLeft: 10 }, authorName: { color: palette.text, fontWeight: '800', fontSize: 13 }, authorMeta: { marginTop: 3, color: palette.muted, fontSize: 11 }, postBody: { color: palette.text, fontSize: 15, lineHeight: 22, marginTop: 13, marginHorizontal: 14 }, postImageWrap: { width: '100%', height: 250, marginTop: 12, backgroundColor: palette.background, position: 'relative' }, postImage: { width: '100%', height: '100%' }, likeOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' }, bigHeart: { color: 'white', fontSize: 86, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 12 }, actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, marginTop: 13, paddingTop: 11, gap: 22, paddingHorizontal: 14 }, action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }, likeIcon: { color: palette.text, fontSize: 25, fontWeight: '600' }, actionCount: { color: palette.muted, fontSize: 13, fontWeight: '600' }, commentComposer: { flexDirection: 'row', alignItems: 'center', marginTop: 9, marginHorizontal: 14, paddingHorizontal: 10, minHeight: 39, borderRadius: 12, backgroundColor: palette.raised }, commentInput: { flex: 1, paddingVertical: 8, color: palette.text, fontSize: 13 }, commentSend: { color: palette.blue, fontWeight: '800', fontSize: 12 } });
