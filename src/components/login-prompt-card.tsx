import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type LoginPromptCardProps = {
  title?: string;
  description?: string;
  icon?: string;
};

export function LoginPromptCard({
  title = 'ログインが必要です',
  description = 'この機能を使うにはログインしてください。アカウントに保存されたデータを安全に利用できます。',
  icon = '🔐',
}: LoginPromptCardProps) {
  return (
    <FadeInView>
      <PremiumCard style={styles.card}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <PrimaryButton label="ログイン" onPress={() => router.push('/login')} />
        <Pressable style={styles.signUpLink} onPress={() => router.push('/sign-up')}>
          <Text style={styles.signUpLinkText}>新規登録はこちら</Text>
        </Pressable>
      </PremiumCard>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  icon: {
    fontSize: 44,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    textAlign: 'center',
  },
  description: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.one,
  },
  signUpLink: {
    paddingVertical: Spacing.two,
  },
  signUpLinkText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
