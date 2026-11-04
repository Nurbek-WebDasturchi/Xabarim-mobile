import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toggleTheme, useThemeColors, useThemeMode, type ThemeColors } from './theme';

export function AppHeader({ title = 'Xabarim' }: { title?: string }) {
  const insets = useSafeAreaInsets();
  const palette = useThemeColors();
  const mode = useThemeMode();
  const styles = makeStyles(palette);
  return <View style={[styles.bar, { paddingTop: insets.top, height: 64 + insets.top }]}>
    <View style={styles.brand}><Image source={require('../../assets/xabarim-logo.png')} style={styles.logo} /><Text style={styles.title}>{title}</Text></View>
    <View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel="Bildirishnomalar" hitSlop={8} onPress={() => Alert.alert('Bildirishnomalar', 'Hozircha yangi bildirishnoma yo‘q.')} style={styles.action}><Feather name="bell" size={21} color="white" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={mode === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'} hitSlop={8} onPress={toggleTheme} style={styles.action}><Feather name={mode === 'dark' ? 'sun' : 'moon'} size={22} color="white" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Sozlamalar" hitSlop={8} onPress={() => router.push('/profile')} style={styles.action}><Feather name="settings" size={22} color="white" /></Pressable></View>
  </View>;
}
const makeStyles = (palette: ThemeColors) => StyleSheet.create({ bar: { height: 64, paddingHorizontal: 16, backgroundColor: palette.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 32, height: 32, borderRadius: 12 }, title: { fontSize: 16, color: 'white', fontWeight: '800' }, actions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, action: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' } });
