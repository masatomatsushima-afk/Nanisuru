import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { NS } from '@/constants/nanisuru-ui';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

async function handleDeepLink(url: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabase();
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }
}

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const processInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleDeepLink(initialUrl);
      }
      router.replace('/(tabs)');
    };

    processInitialUrl();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url).finally(() => router.replace('/(tabs)'));
    });

    return () => subscription.remove();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={NS.colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
