import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { hasSupabaseConfig } from '@/lib/config';

export default function IndexRoute() {
  const { session, loading } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator color="#5848E8" size="large" /></View>;
  if (!hasSupabaseConfig) return <View style={styles.loading}><Text style={styles.title}>Xabarim sozlanishi kerak</Text><Text style={styles.help}>EXPO_PUBLIC_SUPABASE_URL va EXPO_PUBLIC_SUPABASE_ANON_KEY qiymatlarini mobile/xabarim/.env fayliga kiriting.</Text></View>;
  return <Redirect href={session ? '/chats' : '/login'} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: '#F7F8FC', alignItems: 'center', justifyContent: 'center', padding: 28 }, title: { fontSize: 20, fontWeight: '800', color: '#17182D', textAlign: 'center' }, help: { marginTop: 10, fontSize: 15, lineHeight: 22, color: '#72748B', textAlign: 'center' } });
