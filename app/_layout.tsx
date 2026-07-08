import { AuthProvider, useAuth } from '@/contexts/auth-context';
import {
  requestNotificationPermission,
} from '@/services/notifications';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { DuesProvider } from '@/contexts/dues-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

if (clerkPublishableKey.length === 0) {
  throw new Error(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing.'
  );
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <DuesProvider>
            <ThemeProvider
              value={
                colorScheme === 'dark'
                  ? DarkTheme
                  : DefaultTheme
              }
            >
              <RootNavigator />
              <StatusBar style="auto" />
            </ThemeProvider>
          </DuesProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}

function RootNavigator() {
  const { accessToken, isAuthLoading } = useAuth();
  useEffect(() => {
  if (accessToken === null) {
    return;
  }

  requestNotificationPermission().catch((error) => {
    console.warn(
      'Could not request notification permission.',
      error
    );
  });
}, [accessToken]);

  if (isAuthLoading) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={accessToken === null}>
        <Stack.Screen name="auth" />
      </Stack.Protected>

      <Stack.Protected guard={accessToken !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" />
      </Stack.Protected>
    </Stack>
  );
}
