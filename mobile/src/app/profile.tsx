import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppNav } from '@/components/app-nav';
import { AppHeader } from '@/components/app-header';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { useAuth } from '@/features/auth/auth-context';
import { cancelFollowRequest, decideFollowRequest, followUser, loadFollowState, loadFollowStats, loadIncomingFollowRequests, unfollowUser, updateAccountPrivacy, updateMyProfile, type FollowState } from '@/features/social/social-service';
import { getSupabaseClient } from '@/lib/supabase';
import { useLanguage, useT } from '@/features/i18n/i18n';

type Stats = { followers_count?: number; following_count?: number } | null;

export default function ProfileScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, profile, session, loading, signOut, refreshProfile } = useAuth();
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const { userId: rawViewedId } = useLocalSearchParams<{ userId?: string }>();
  const viewedId = Array.isArray(rawViewedId) ? rawViewedId[0] : rawViewedId;
  const isOther = !!viewedId && viewedId !== user?.id;
  const [viewed, setViewed] = useState<any>(null);
  useEffect(() => { if (isOther) void getSupabaseClient().from('profiles').select('id,username,full_name,avatar_url,bio,is_private').eq('id', viewedId).maybeSingle().then(({ data }) => setViewed(data)); }, [isOther, viewedId]);
  const shown = isOther ? viewed : profile;
  useEffect(() => { if (isOther && user && viewedId) void loadFollowState(user.id, viewedId).then(setFollowState).catch(() => setFollowState('none')); }, [isOther, user, viewedId]);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [stats, setStats] = useState<Stats>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [followBusy, setFollowBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [followState, setFollowState] = useState<FollowState>('none');
  const refreshRequests = useCallback(async () => { if (!user || isOther) return; try { setRequests(await loadIncomingFollowRequests(user.id)); } catch (e) { setRequestError(e instanceof Error ? e.message : 'So‘rovlar yuklanmadi.'); } }, [user, isOther]);
  useEffect(() => { void refreshRequests(); }, [refreshRequests]);
  useEffect(() => { setName(profile?.full_name ?? ''); setBio(profile?.bio ?? ''); }, [profile]);
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try { setStats(await loadFollowStats(isOther && viewedId ? viewedId : user.id)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Statistikani yuklab bo‘lmadi.'); }
    finally { setBusy(false); }
  }, [user, isOther, viewedId]);
  useEffect(() => { void load(); }, [load]);
  if (!loading && !session) return <Redirect href="/login" />;
  const save = async () => {
    if (!user) return;
    setSaving(true); setError('');
    try { await updateMyProfile(user.id, name, bio); await refreshProfile(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Profil saqlanmadi.'); }
    finally { setSaving(false); }
  };
  const logout = async () => { try { await signOut(); } catch (e) { setError(e instanceof Error ? e.message : 'Chiqishda xatolik.'); } };
  const changed = name.trim() !== (profile?.full_name ?? '') || bio.trim() !== (profile?.bio ?? '');
  const setPrivate = async (value: boolean) => { if (!user) return; setSaving(true); setError(''); try { await updateAccountPrivacy(user.id, value); await refreshProfile(); } catch (e) { setError(e instanceof Error ? e.message : 'Akkaunt turi o‘zgarmadi. Avval schema_v35.sql migratsiyasini bajaring.'); } finally { setSaving(false); } };
  const reviewRequest = async (id: number, requesterId: string, accept: boolean) => { setFollowBusy(true); setRequestError(''); try { await decideFollowRequest(id, requesterId, accept); await refreshRequests(); } catch (e) { setRequestError(e instanceof Error ? e.message : 'So‘rovni ko‘rib chiqib bo‘lmadi.'); } finally { setFollowBusy(false); } };
  const toggleViewedFollow = async () => { if (!user || !viewedId || !shown) return; setFollowBusy(true); setRequestError(''); try { if (followState === 'pending') await cancelFollowRequest(user.id, viewedId); else if (followState === 'following') await unfollowUser(user.id, viewedId); else await followUser(user.id, viewedId, !!shown.is_private, session?.access_token); setFollowState(followState === 'pending' || followState === 'following' ? 'none' : shown.is_private ? 'pending' : 'following'); } catch (e) { setRequestError(e instanceof Error ? e.message : 'Obuna amalini bajarib bo‘lmadi.'); } finally { setFollowBusy(false); } };
  return <View style={styles.page}>
    <AppHeader />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><Text style={styles.title}>{t('profile')}</Text><Pressable onPress={logout} style={styles.logout}><Text style={styles.logoutText}>{t('logout')}</Text></Pressable></View>
      <View style={styles.profileCard}><Pressable accessibilityRole="button" accessibilityLabel="Profil rasmini to‘liq ko‘rish" disabled={!shown?.avatar_url} onPress={() => setAvatarPreviewOpen(true)} style={styles.avatar}>{shown?.avatar_url ? <Image source={{ uri: shown.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.initial}>{(shown?.full_name || shown?.username || 'X').slice(0, 1).toUpperCase()}</Text>}</Pressable><Text style={styles.displayName}>{shown?.full_name || shown?.username}</Text><Text style={styles.username}>@{shown?.username}</Text>
        <View style={styles.stats}>{busy ? <ActivityIndicator color="#5848E8" /> : <><View style={styles.stat}><Text style={styles.statNumber}>{stats?.followers_count ?? '—'}</Text><Text style={styles.statLabel}>{t('followers')}</Text></View><View style={styles.divider} /><View style={styles.stat}><Text style={styles.statNumber}>{stats?.following_count ?? '—'}</Text><Text style={styles.statLabel}>{t('followingCount')}</Text></View></>}</View>
      </View>
      {isOther ? <View style={styles.editCard}>{shown?.is_private && followState !== 'following' && <Text style={styles.notice}>{t('privacyNotice')}</Text>}{!!requestError && <Text style={styles.error}>{requestError}</Text>}<Pressable disabled={followBusy} onPress={() => void toggleViewedFollow()} style={styles.save}>{followBusy ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>{followState === 'following' ? t('following') : followState === 'pending' ? t('requested') : t('follow')}</Text>}</Pressable></View> : <><View style={styles.editCard}><Text style={styles.section}>{t('accountType')}</Text><View style={styles.privacyRow}>{([false, true] as const).map((value) => <Pressable key={String(value)} disabled={saving} onPress={() => void setPrivate(value)} style={[styles.privacyOption, !!profile?.is_private === value && styles.privacySelected]}><Text style={[styles.privacyText, !!profile?.is_private === value && styles.privacySelectedText]}>{value ? t('private') : t('public')}</Text></Pressable>)}</View></View><View style={styles.editCard}><Text style={styles.section}>{t('profileInfo')}</Text><Text style={styles.label}>{t('name')}</Text><TextInput value={name} onChangeText={setName} placeholder={t('namePlaceholder')} placeholderTextColor="#9697A9" maxLength={60} style={styles.input} /><Text style={styles.label}>{t('bio')}</Text><TextInput value={bio} onChangeText={setBio} placeholder={t('bioPlaceholder')} placeholderTextColor="#9697A9" maxLength={160} multiline style={[styles.input, styles.bio]} /><Text style={styles.counter}>{bio.length}/160</Text>{changed && <Pressable onPress={save} disabled={saving} style={styles.save}>{saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>{t('save')}</Text>}</Pressable>}</View><View style={styles.editCard}><Text style={styles.section}>{t('requests')} · {requests.length}</Text>{!!requestError && <Text style={styles.error}>{requestError}</Text>}{requests.length === 0 ? <Text style={styles.notice}>{t('noRequests')}</Text> : requests.map((request) => <View key={request.id} style={styles.requestRow}><View style={styles.requestInfo}><Text style={styles.name}>{request.profiles?.full_name || request.profiles?.username}</Text><Text style={styles.username}>@{request.profiles?.username}</Text></View><Pressable disabled={followBusy} onPress={() => void reviewRequest(request.id, request.requester_id, false)} style={styles.decline}><Text style={styles.declineText}>{t('decline')}</Text></Pressable><Pressable disabled={followBusy} onPress={() => void reviewRequest(request.id, request.requester_id, true)} style={styles.accept}><Text style={styles.acceptText}>{t('accept')}</Text></Pressable></View>)}</View><View style={styles.editCard}><Text style={styles.section}>{t('language')}</Text><View style={styles.privacyRow}>{(['uz', 'ru', 'en'] as const).map((item) => <Pressable key={item} onPress={() => setLanguage(item)} style={[styles.privacyOption, language === item && styles.privacySelected]}><Text style={[styles.privacyText, language === item && styles.privacySelectedText]}>{item.toUpperCase()}</Text></Pressable>)}</View></View></>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.info}><Text style={styles.infoLabel}>Xabarim ID</Text><Text selectable style={styles.infoValue}>{profile?.id}</Text></View>
    </ScrollView>
    <AppNav />
    {avatarPreviewOpen && !!shown?.avatar_url && <Pressable accessibilityRole="button" accessibilityLabel="Rasmni yopish" onPress={() => setAvatarPreviewOpen(false)} style={styles.avatarPreview}><Text style={styles.avatarPreviewClose}>×</Text><Image source={{ uri: shown.avatar_url }} resizeMode="contain" style={styles.avatarPreviewImage} /></Pressable>}
  </View>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background, paddingTop: 0 }, content: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 100 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 15 }, title: { color: palette.text, fontSize: 23, fontWeight: '900' }, logout: { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#311C2B', borderRadius: 11 }, logoutText: { color: palette.red, fontSize: 12, fontWeight: '800' }, profileCard: { backgroundColor: palette.surface, borderRadius: 22, padding: 21, alignItems: 'center', borderWidth: 1, borderColor: palette.border }, avatar: { width: 92, height: 92, borderRadius: 46, overflow: 'hidden', backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.blue }, avatarImage: { width: '100%', height: '100%', borderRadius: 46 }, avatarPreview: { ...StyleSheet.absoluteFill, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center', padding: 20 }, avatarPreviewImage: { width: '100%', height: '100%' }, avatarPreviewClose: { position: 'absolute', zIndex: 1, top: 18, right: 22, color: 'white', fontSize: 38, lineHeight: 44 }, initial: { color: palette.blue, fontSize: 32, fontWeight: '900' }, displayName: { color: palette.text, fontSize: 20, fontWeight: '900', marginTop: 12 }, username: { color: palette.muted, fontSize: 13, marginTop: 4 }, stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30, marginTop: 22 }, stat: { alignItems: 'center', minWidth: 85 }, statNumber: { color: palette.text, fontSize: 19, fontWeight: '900' }, statLabel: { color: palette.muted, fontSize: 11, marginTop: 4 }, divider: { width: 1, height: 30, backgroundColor: palette.border }, editCard: { backgroundColor: palette.surface, borderRadius: 20, padding: 17, marginTop: 14, borderWidth: 1, borderColor: palette.border }, section: { color: palette.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }, label: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 11, marginBottom: 6 }, input: { minHeight: 46, borderRadius: 13, backgroundColor: palette.background, paddingHorizontal: 12, color: palette.text, fontSize: 14, borderWidth: 1, borderColor: palette.border }, bio: { minHeight: 75, paddingTop: 11, textAlignVertical: 'top' }, counter: { textAlign: 'right', color: palette.dim, fontSize: 10, marginTop: 4 }, save: { height: 45, borderRadius: 13, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, saveText: { color: 'white', fontWeight: '800', fontSize: 13 }, error: { color: palette.red, fontSize: 12, marginTop: 12 }, info: { paddingHorizontal: 4, paddingVertical: 16 }, infoLabel: { color: palette.muted, fontSize: 11 }, infoValue: { color: palette.dim, fontSize: 11, marginTop: 4 }, privacyRow: { flexDirection: 'row', gap: 8 }, privacyOption: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border }, privacySelected: { borderColor: palette.blue, backgroundColor: palette.raised }, privacyText: { color: palette.muted, fontSize: 11, fontWeight: '800' }, privacySelectedText: { color: palette.blue }, notice: { color: palette.muted, fontSize: 13, lineHeight: 19 }, requestRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.border, gap: 7 }, requestInfo: { flex: 1 }, name: { color: palette.text, fontSize: 13, fontWeight: '800' }, decline: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.raised }, declineText: { color: palette.muted, fontSize: 10, fontWeight: '800' }, accept: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.blue }, acceptText: { color: 'white', fontSize: 10, fontWeight: '800' } });
