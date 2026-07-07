import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DevMvpAuditProbe } from '@/components/dev-mvp-audit-probe';
import { DevSupabaseSetupProbe } from '@/components/dev-supabase-setup-probe';
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

const ROOT_STACK_SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: NS.colors.bg },
} as const;

export default function RootLayout() {
  return (
    <AuthProvider>
      <UserLocationProvider>
        <ThemeProvider value={NanisuruTheme}>
        <StatusBar style="dark" />
        <AnimatedSplashOverlay />
        {__DEV__ ? (
          <>
            <DevSupabaseSetupProbe />
            <DevMvpAuditProbe />
          </>
        ) : null}
        <Stack screenOptions={ROOT_STACK_SCREEN_OPTIONS}>
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
          <Stack.Screen
            name="profile-edit"
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
            name="feedback"
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
            name="my-trips"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="trip-folder/[id]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="trip-assistant/[folderId]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="trip-day-mode"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="preference-onboarding"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="local-gems"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="local-spot/submit"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="local-spot/[id]"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="trip-memories"
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
