import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/contexts/auth-context';
import { UserLocationProvider } from '@/contexts/user-location-context';
import { NS } from '@/constants/nanisuru-ui';

const NanisuruTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: NS.colors.accent,
    background: NS.colors.bg,
    card: NS.colors.bgElevated,
    text: NS.colors.text,
    border: NS.colors.border,
    notification: NS.colors.coral,
  },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <UserLocationProvider>
        <ThemeProvider value={NanisuruTheme}>
        <StatusBar style="dark" />
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
            name="after-plan"
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
          <Stack.Screen
            name="beta-test"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="memories/index"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="memory/[id]"
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
