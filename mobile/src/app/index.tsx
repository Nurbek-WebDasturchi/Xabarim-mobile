import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { colors } from '@/components/theme';

export default function IndexRoute() {
  const { session, loading, configured } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator color="#5848E8" size="large" /></View>;
  if (!configured) return <View style={styles.loading}><Text style={styles.title}>Serverga ulanib bo‘lmadi</Text><Text style={styles.help}>Internetni tekshiring va ilovani qayta oching. Xabarim sozlamalari xabarim.uz serveridan olinadi.</Text></View>;
  return <Redirect href={session ? '/chats' : '/login'} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 28 }, title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }, help: { marginTop: 10, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center' } });
