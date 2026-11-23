import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { AppNav } from '@/components/app-nav';
import { useThemeColors, type ThemeColors } from '@/components/theme';
import { useLanguage, useUiText } from '@/features/i18n/i18n';

const policy = {
  uz: ['Xabarim Maxfiylik siyosati', 'Xabarim hisobingizni yuritish, xabarlar va ijtimoiy funksiyalarni taqdim etish uchun hisob va profil ma’lumotlarini qayta ishlaydi.', 'Xabarlar, postlar, izohlar, obunalar va bildirishnomalar xizmat ishlashi uchun Supabase serverlarida saqlanadi. Push bildirishnomalari uchun qurilma tokeni ishlatiladi.', 'Ilovadagi Maxfiy akkaunt sozlamasi postlaringizni kim ko‘rishini boshqaradi. Parolingizni Xabarim ko‘rmaydi; uni Supabase Auth himoyalaydi.', 'Hisobni o‘chirish yoki ma’lumotlar bo‘yicha murojaat uchun Xabarim saytidagi rasmiy aloqa sahifasidan foydalaning.'],
  ru: ['Политика конфиденциальности Xabarim', 'Xabarim обрабатывает данные аккаунта и профиля, чтобы предоставлять сообщения и социальные функции.', 'Сообщения, публикации, комментарии, подписки и уведомления хранятся на серверах Supabase. Для push уведомлений используется токен устройства.', 'Настройка закрытого аккаунта управляет тем, кто видит ваши публикации. Пароль защищает Supabase Auth.', 'Для удаления аккаунта или запросов о данных обратитесь через официальную страницу контактов Xabarim.'],
  en: ['Xabarim Privacy Policy', 'Xabarim processes account and profile data to provide messaging and social features.', 'Messages, posts, comments, follows, and notifications are stored on Supabase servers. A device token is used to deliver push notifications.', 'The private account setting controls who can see your posts. Your password is protected by Supabase Auth.', 'For account deletion or data requests, use the official contact page on the Xabarim website.'],
} as const;

export default function PrivacyScreen() {
  const palette = useThemeColors(); const styles = makeStyles(palette); const { language } = useLanguage(); const ui = useUiText();
  return <View style={styles.page}><AppHeader title={ui.privacyPolicy} /><ScrollView contentContainerStyle={styles.content}>{policy[language].map((paragraph, index) => <Text key={index} style={index === 0 ? styles.title : styles.copy}>{paragraph}</Text>)}</ScrollView><AppNav /></View>;
}
const makeStyles = (palette: ThemeColors) => StyleSheet.create({ page: { flex: 1, backgroundColor: palette.background }, content: { padding: 20, paddingBottom: 110, gap: 17 }, title: { color: palette.text, fontSize: 22, fontWeight: '800' }, copy: { color: palette.muted, fontSize: 15, lineHeight: 23 } });
