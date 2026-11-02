import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';

export default function ExploreScreen() {
  const { session, loading } = useAuth();
  if (!loading && !session) return <Redirect href="/login" />;
  return <View style={styles.page}><Text style={styles.icon}>✦</Text><Text style={styles.title}>Xabarim</Text><Text style={styles.body}>Ijtimoiy lenta va kashfiyotlar keyingi yangilanishlarda qo‘shiladi.</Text></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7F8FC', justifyContent: 'center', alignItems: 'center', padding: 35 }, icon: { color: '#5848E8', fontSize: 36 }, title: { marginTop: 14, color: '#191A2E', fontSize: 22, fontWeight: '800' }, body: { marginTop: 8, color: '#85869A', textAlign: 'center', fontSize: 14, lineHeight: 21 } });
