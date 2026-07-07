import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { getOnboardingCompleted } from '@/lib/onboarding-storage';
import { NS } from '@/constants/nanisuru-ui';

const accent = NS.colors.accent;

export default function IndexScreen() {
  const { isLoading: authLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    let mounted = true;

    void getOnboardingCompleted().then((onboarding) => {
      if (!mounted) return;
      setHasCompletedOnboarding(onboarding);
      setIsReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!isReady || authLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={accent} />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: NS.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
