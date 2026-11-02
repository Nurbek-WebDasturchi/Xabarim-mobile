import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { useEffect } from 'react';
import { router, useSegments } from 'expo-router';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  useEffect(() => {
    if (loading) return;
    const onAuthRoute = segments[0] === 'login' || segments[0] === 'register';
    if (!session && !onAuthRoute) router.replace('/login');
    if (session && onAuthRoute) router.replace('/chats');
  }, [session, loading, segments]);
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F8FC' } }} /></>;
}
