import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0A0B' },
        }}>
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
