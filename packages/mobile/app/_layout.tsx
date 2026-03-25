import '../global.css';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '@/store/auth.store';
import { queryClient } from '@/lib/queryClient';
import { COLORS } from '@/constants/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadFromStorage().finally(() => setReady(true));
  }, [loadFromStorage]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="game/[slug]" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
          <Stack.Screen name="library/[slug]" options={{ animation: 'slide_from_right', headerShown: false }} />
          <Stack.Screen name="library/new" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
          <Stack.Screen name="user/[username]" options={{ animation: 'slide_from_right', headerShown: false }} />
          <Stack.Screen name="recommendations" options={{ animation: 'slide_from_right', headerShown: false }} />
          <Stack.Screen name="steam" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
          <Stack.Screen name="billing/upgrade" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
          <Stack.Screen name="profile/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right', headerShown: false }} />
        </Stack>
        <Toast />
      </AuthGate>
    </QueryClientProvider>
  );
}
