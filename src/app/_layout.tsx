import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DevMvpAuditProbe } from '@/components/dev-mvp-audit-probe';
import { DevSupabaseSetupProbe } from '@/components/dev-supabase-setup-probe';
import { NS } from '@/constants/nanisuru-ui';
import { AuthProvider } from '@/contexts/auth-context';
import { UserLocationProvider } from '@/contexts/user-location-context';
import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';

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

function LoopTestMountLog({ name }: { name: string }) {
  useEffect(() => {
    loopTestLogOnce(`mount:${name}`, `mounted ${name}`);
  }, [name]);
  return null;
}

function MaybeAuthProvider({ children }: { children: ReactNode }) {
  if (!LOOP_TEST_RESTORE.authProvider) return <>{children}</>;
  loopTestLogOnce('restore:AuthProvider', 'restoring AuthProvider');
  return (
    <>
      <LoopTestMountLog name="AuthProvider" />
      <AuthProvider>{children}</AuthProvider>
    </>
  );
}

function MaybeUserLocationProvider({ children }: { children: ReactNode }) {
  if (!LOOP_TEST_RESTORE.userLocationProvider) return <>{children}</>;
  loopTestLogOnce('restore:UserLocationProvider', 'restoring UserLocationProvider');
  return (
    <>
      <LoopTestMountLog name="UserLocationProvider" />
      <UserLocationProvider>{children}</UserLocationProvider>
    </>
  );
}

function MaybeThemeProvider({ children }: { children: ReactNode }) {
  if (!LOOP_TEST_RESTORE.themeProvider) return <>{children}</>;
  loopTestLogOnce('restore:ThemeProvider', 'restoring ThemeProvider');
  return <ThemeProvider value={NanisuruTheme}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  loopTestLogOnce('boot', 'minimal root layout boot');

  let tree: ReactNode = (
    <>
      <LoopTestMountLog name="RootLayout" />
      <StatusBar style="dark" />
      {LOOP_TEST_RESTORE.animatedSplash ? <AnimatedSplashOverlay /> : null}
      {LOOP_TEST_RESTORE.devProbes && __DEV__ ? (
        <>
          <DevSupabaseSetupProbe />
          <DevMvpAuditProbe />
        </>
      ) : null}
      <Stack screenOptions={ROOT_STACK_SCREEN_OPTIONS}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        {LOOP_TEST_RESTORE.planDetailRoute ? (
          <>
            <Stack.Screen name="plan-detail" />
            <Stack.Screen name="today-schedule" />
          </>
        ) : null}
      </Stack>
    </>
  );

  if (LOOP_TEST_RESTORE.animatedSplash) {
    loopTestLogOnce('restore:AnimatedSplash', 'restoring AnimatedSplash');
  }
  if (LOOP_TEST_RESTORE.devProbes) {
    loopTestLogOnce('restore:DevProbes', 'restoring DevProbes');
  }
  if (LOOP_TEST_RESTORE.planDetailRoute) {
    loopTestLogOnce('restore:planDetailRoute', 'restoring plan-detail + today-schedule routes');
  }

  tree = <MaybeThemeProvider>{tree}</MaybeThemeProvider>;
  tree = <MaybeUserLocationProvider>{tree}</MaybeUserLocationProvider>;
  tree = <MaybeAuthProvider>{tree}</MaybeAuthProvider>;

  return tree;
}
