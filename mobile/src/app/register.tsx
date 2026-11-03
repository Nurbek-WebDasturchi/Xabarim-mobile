import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { colors } from '@/components/theme';

export default function RegisterScreen() {
  const { session, signUp } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (session) return <Redirect href="/chats" />;
  const submit = async () => {
    setError('');
    if (name.trim().length < 2) return setError('Ismingizni kiriting.');
    if (!/^[a-z0-9_]{3,30}$/i.test(username.trim())) return setError('Username 3–30 ta harf, raqam yoki _ bo‘lishi kerak.');
    if (password.length < 8) return setError('Parol kamida 8 ta belgidan iborat bo‘lsin.');
    setBusy(true);
    try { await signUp(username, password, name); } catch (e) { setError(e instanceof Error ? e.message : 'Ro‘yxatdan o‘tish amalga oshmadi.'); } finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Text style={styles.brand}>Xabarim</Text><Text style={styles.title}>Yangi hisob yarating</Text><Text style={styles.subtitle}>Do‘stlaringiz bilan suhbatni boshlang</Text></View>
    <View style={styles.card}>
      <Text style={styles.label}>Ism</Text><TextInput placeholder="To‘liq ismingiz" placeholderTextColor="#9B9CAF" value={name} onChangeText={setName} style={styles.input} />
      <Text style={styles.label}>Username</Text><TextInput autoCapitalize="none" autoCorrect={false} placeholder="username" placeholderTextColor="#9B9CAF" value={username} onChangeText={setUsername} style={styles.input} />
      <Text style={styles.hint}>Faqat lotin harflari, raqam va pastki chiziq</Text>
      <Text style={styles.label}>Parol</Text><TextInput placeholder="Kamida 8 ta belgi" placeholderTextColor="#9B9CAF" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry onSubmitEditing={submit} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="button" onPress={submit} disabled={busy} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Hisob yaratish</Text>}</Pressable>
      <View style={styles.footer}><Text style={styles.footerText}>Hisobingiz bormi? </Text><Link href="/login" style={styles.link}>Kirish</Link></View>
    </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, justifyContent: 'center', padding: 24 }, header: { alignItems: 'center', marginBottom: 26 }, brand: { color: colors.blue, fontWeight: '900', fontSize: 18 }, title: { color: colors.blue, fontWeight: '800', fontSize: 25, marginTop: 18 }, subtitle: { color: colors.muted, fontSize: 14, marginTop: 7 }, card: { backgroundColor: colors.surface, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: colors.border }, label: { color: colors.muted, fontWeight: '700', fontSize: 13, marginBottom: 8, marginTop: 12 }, input: { height: 52, borderRadius: 14, backgroundColor: colors.background, paddingHorizontal: 15, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border }, hint: { color: colors.dim, fontSize: 12, marginTop: 6 }, error: { color: colors.red, fontSize: 13, lineHeight: 19, marginTop: 13 }, button: { height: 54, marginTop: 22, borderRadius: 15, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: 'white', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.82 }, footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 21 }, footerText: { color: colors.muted, fontSize: 14 }, link: { color: colors.blue, fontWeight: '800', fontSize: 14 } });
