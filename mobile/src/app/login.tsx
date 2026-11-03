import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { colors } from '@/components/theme';

export default function LoginScreen() {
  const { session, signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (session) return <Redirect href="/chats" />;
  const submit = async () => {
    setError('');
    if (!/^[a-z0-9_]{3,30}$/i.test(username.trim())) return setError('Username 3–30 ta harf, raqam yoki _ bo‘lishi kerak.');
    if (!password) return setError('Parolni kiriting.');
    setBusy(true);
    try { await signIn(username, password); } catch (e) { setError(e instanceof Error ? e.message : 'Kirish amalga oshmadi.'); } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>X</Text></View><Text style={styles.name}>Xabarim</Text><Text style={styles.tagline}>Yaqinlaringiz doim yoningizda</Text></View>
      <View style={styles.card}><Text style={styles.title}>Xush kelibsiz</Text><Text style={styles.subtitle}>Hisobingizga kiring</Text>
        <Text style={styles.label}>Username</Text><TextInput autoCapitalize="none" autoCorrect={false} placeholder="username" placeholderTextColor="#9B9CAF" value={username} onChangeText={setUsername} style={styles.input} returnKeyType="next" />
        <Text style={styles.label}>Parol</Text><TextInput placeholder="Parolingiz" placeholderTextColor="#9B9CAF" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry onSubmitEditing={submit} returnKeyType="go" />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" onPress={submit} disabled={busy} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Kirish</Text>}</Pressable>
        <View style={styles.footer}><Text style={styles.footerText}>Hisobingiz yo‘qmi? </Text><Link href="/register" style={styles.link}>Ro‘yxatdan o‘ting</Link></View>
      </View>
      <Text style={styles.footnote}>O‘zbekistondagi yaqinlaringiz bilan bog‘laning</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 }, brand: { alignItems: 'center', marginBottom: 32 }, logo: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', shadowColor: colors.blue, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 }, logoText: { color: 'white', fontSize: 34, fontWeight: '900' }, name: { marginTop: 13, color: colors.text, fontSize: 28, fontWeight: '800' }, tagline: { marginTop: 5, color: colors.muted, fontSize: 14 }, card: { padding: 24, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border }, title: { color: colors.blue, fontSize: 23, fontWeight: '800' }, subtitle: { marginTop: 5, marginBottom: 23, color: colors.muted, fontSize: 14 }, label: { color: colors.muted, fontWeight: '700', fontSize: 13, marginBottom: 8, marginTop: 12 }, input: { height: 52, borderRadius: 14, backgroundColor: colors.background, paddingHorizontal: 15, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border }, error: { color: colors.red, fontSize: 13, lineHeight: 19, marginTop: 13 }, button: { height: 54, marginTop: 22, borderRadius: 15, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: 'white', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.82 }, footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 21 }, footerText: { color: colors.muted, fontSize: 14 }, link: { color: colors.blue, fontWeight: '800', fontSize: 14 }, footnote: { marginTop: 22, textAlign: 'center', color: colors.dim, fontSize: 12 } });
