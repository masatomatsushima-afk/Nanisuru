import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { NS } from '@/constants/nanisuru-ui';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
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
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="plan-detail"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="today-schedule"
          options={{
            animation: 'fade_from_bottom',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
