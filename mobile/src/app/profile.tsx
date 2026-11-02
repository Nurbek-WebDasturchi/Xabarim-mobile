import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppNav } from '@/components/app-nav';
import { AppHeader } from '@/components/app-header';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { useAuth } from '@/features/auth/auth-context';
import { loadFollowStats, updateMyProfile } from '@/features/social/social-service';
import { getSupabaseClient } from '@/lib/supabase';

type Stats = { followers_count?: number; following_count?: number } | null;

export default function ProfileScreen() {
  const palette = useThemeColors();
  const styles = createStyles(palette);
  const { user, profile, session, loading, signOut, refreshProfile } = useAuth();
  const { userId: rawViewedId } = useLocalSearchParams<{ userId?: string }>();
  const viewedId = Array.isArray(rawViewedId) ? rawViewedId[0] : rawViewedId;
  const isOther = !!viewedId && viewedId !== user?.id;
  const [viewed, setViewed] = useState<any>(null);
  useEffect(() => { if (isOther) void getSupabaseClient().from('profiles').select('id,username,full_name,avatar_url,bio').eq('id', viewedId).maybeSingle().then(({ data }) => setViewed(data)); }, [isOther, viewedId]);
  const shown = isOther ? viewed : profile;
  const [name, setName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [stats, setStats] = useState<Stats>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setName(profile?.full_name ?? ''); setBio(profile?.bio ?? ''); }, [profile]);
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try { setStats(await loadFollowStats(user.id)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Statistikani yuklab bo‘lmadi.'); }
    finally { setBusy(false); }
  }, [user]);
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
  return <View style={styles.page}>
    <AppHeader />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><Text style={styles.title}>Profil</Text><Pressable onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Chiqish</Text></Pressable></View>
      <View style={styles.profileCard}><View style={styles.avatar}>{shown?.avatar_url ? <Image source={{ uri: shown.avatar_url }} style={{ width: '100%', height: '100%' }} /> : <Text style={styles.initial}>{(shown?.full_name || shown?.username || 'X').slice(0, 1).toUpperCase()}</Text>}</View><Text style={styles.displayName}>{shown?.full_name || shown?.username}</Text><Text style={styles.username}>@{shown?.username}</Text>
        <View style={styles.stats}>{busy ? <ActivityIndicator color="#5848E8" /> : <><View style={styles.stat}><Text style={styles.statNumber}>{stats?.followers_count ?? '—'}</Text><Text style={styles.statLabel}>Obunachilar</Text></View><View style={styles.divider} /><View style={styles.stat}><Text style={styles.statNumber}>{stats?.following_count ?? '—'}</Text><Text style={styles.statLabel}>Obunalar</Text></View></>}</View>
      </View>
      <View style={styles.editCard}><Text style={styles.section}>Profil ma’lumotlari</Text><Text style={styles.label}>Ism</Text><TextInput value={name} onChangeText={setName} placeholder="Ismingiz" placeholderTextColor="#9697A9" maxLength={60} style={styles.input} /><Text style={styles.label}>Bio</Text><TextInput value={bio} onChangeText={setBio} placeholder="O‘zingiz haqingizda" placeholderTextColor="#9697A9" maxLength={160} multiline style={[styles.input, styles.bio]} /><Text style={styles.counter}>{bio.length}/160</Text>{changed && <Pressable onPress={save} disabled={saving} style={styles.save}>{saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Saqlash</Text>}</Pressable>}</View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.info}><Text style={styles.infoLabel}>Xabarim ID</Text><Text selectable style={styles.infoValue}>{profile?.id}</Text></View>
    </ScrollView>
    <AppNav />
  </View>;
}

const createStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background, paddingTop: 0 }, content: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 100 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 15 }, title: { color: palette.text, fontSize: 23, fontWeight: '900' }, logout: { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#311C2B', borderRadius: 11 }, logoutText: { color: palette.red, fontSize: 12, fontWeight: '800' }, profileCard: { backgroundColor: palette.surface, borderRadius: 22, padding: 21, alignItems: 'center', borderWidth: 1, borderColor: palette.border }, avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.blue }, initial: { color: palette.blue, fontSize: 32, fontWeight: '900' }, displayName: { color: palette.text, fontSize: 20, fontWeight: '900', marginTop: 12 }, username: { color: palette.muted, fontSize: 13, marginTop: 4 }, stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30, marginTop: 22 }, stat: { alignItems: 'center', minWidth: 85 }, statNumber: { color: palette.text, fontSize: 19, fontWeight: '900' }, statLabel: { color: palette.muted, fontSize: 11, marginTop: 4 }, divider: { width: 1, height: 30, backgroundColor: palette.border }, editCard: { backgroundColor: palette.surface, borderRadius: 20, padding: 17, marginTop: 14, borderWidth: 1, borderColor: palette.border }, section: { color: palette.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }, label: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 11, marginBottom: 6 }, input: { minHeight: 46, borderRadius: 13, backgroundColor: palette.background, paddingHorizontal: 12, color: palette.text, fontSize: 14, borderWidth: 1, borderColor: palette.border }, bio: { minHeight: 75, paddingTop: 11, textAlignVertical: 'top' }, counter: { textAlign: 'right', color: palette.dim, fontSize: 10, marginTop: 4 }, save: { height: 45, borderRadius: 13, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, saveText: { color: 'white', fontWeight: '800', fontSize: 13 }, error: { color: palette.red, fontSize: 12, marginTop: 12 }, info: { paddingHorizontal: 4, paddingVertical: 16 }, infoLabel: { color: palette.muted, fontSize: 11 }, infoValue: { color: palette.dim, fontSize: 11, marginTop: 4 } });
