import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoginPromptCard } from '@/components/login-prompt-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

type RequireAuthGateProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  loadingMessage?: string;
};

export function RequireAuthGate({
  children,
  title,
  description,
  loadingMessage = '認証状態を確認中...',
}: RequireAuthGateProps) {
  const insets = useSafeAreaInsets();
  const { user, isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={NS.colors.accent} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  if (!user && !session) {
    return (
      <View
        style={[
          styles.guestWrap,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}>
        <LoginPromptCard title={title} description={description} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: NS.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  guestWrap: {
    flex: 1,
    backgroundColor: NS.colors.bg,
    paddingHorizontal: Spacing.four,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    marginTop: Spacing.three,
  },
});
