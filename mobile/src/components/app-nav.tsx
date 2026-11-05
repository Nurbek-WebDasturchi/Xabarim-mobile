import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useThemeColors, useThemeMode, type ThemeColors } from './theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/features/i18n/i18n';

export function AppNav() {
  const t = useT();
  const items = [
    { path: '/feed', label: t('posts'), icon: 'home' },
    { path: '/communities', label: t('groups'), icon: 'users' },
    { path: '/chats', label: t('chats'), icon: 'message-circle' },
    { path: '/friends', label: t('exploreFriends'), icon: 'search' },
    { path: '/profile', label: t('profile'), icon: 'user' },
  ] as const;
  const pathname = usePathname();
  const palette = useThemeColors();
  const mode = useThemeMode();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(palette);
  return <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + 10 }]}><BlurView intensity={86} tint={mode} style={styles.bar}>{items.map((item) => {
    const active = pathname === item.path;
    return <Pressable key={item.path} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => router.replace(item.path as never)} style={[styles.item, active && styles.selected]}>
      <Feather name={item.icon} size={20} color={active ? palette.blue : palette.muted} /><Text numberOfLines={1} style={[styles.label, active && styles.active]}>{item.label}</Text>
  </Pressable>;
  })}<View pointerEvents="none" style={styles.glassStroke} /></BlurView></View>;
}
const makeStyles = (palette: ThemeColors) => StyleSheet.create({ wrap: { position: 'absolute', bottom: 10, left: 16, right: 16, borderRadius: 38, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 18, elevation: 10 }, bar: { minHeight: 70, borderRadius: 38, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface + 'D9', borderWidth: 1, borderColor: palette.border }, item: { flex: 1, height: 60, borderRadius: 32, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 1 }, selected: { backgroundColor: palette.raised }, label: { color: palette.muted, fontSize: 8, fontWeight: '700' }, active: { color: palette.blue }, glassStroke: { ...StyleSheet.absoluteFill, borderRadius: 38, borderWidth: 1, borderTopColor: '#FFFFFF55', borderLeftColor: '#FFFFFF22', borderRightColor: '#FFFFFF11', borderBottomColor: '#FFFFFF22' } });
