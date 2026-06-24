import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/contexts/auth-context';
import { UserLocationProvider } from '@/contexts/user-location-context';
import { NS } from '@/constants/nanisuru-ui';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <UserLocationProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: NS.colors.bg },
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="onboarding"
            options={{
              animation: 'fade',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="login"
            options={{
              animation: 'fade',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="sign-up"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="plan-detail"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="imafima"
            options={{
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="best-day"
            options={{
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="today-schedule"
            options={{
              animation: 'fade_from_bottom',
            }}
          />
          <Stack.Screen
            name="saved-trip/[id]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="share/[id]"
            options={{
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="public-plan/[id]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="plan-copy/[id]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="plan-version-draft/[id]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="creator/[id]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              animation: 'slide_from_right',
            }}
          />
        </Stack>
      </ThemeProvider>
      </UserLocationProvider>
    </AuthProvider>
  );
}
