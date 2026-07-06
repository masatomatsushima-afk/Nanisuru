import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type LoginPromptCardProps = {
  title?: string;
  description?: string;
  icon?: string;
  showLater?: boolean;
  onLater?: () => void;
};

export function LoginPromptCard({
  title = '保存するにはログインが必要です',
  description = 'ログインすると、旅行プランや思い出を安全に保存できます。',
  icon = '🔐',
  showLater = true,
  onLater,
}: LoginPromptCardProps) {
  return (
    <FadeInView>
      <PremiumCard style={styles.card}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.buttonWrap}>
          <PrimaryButton label="ログインする" onPress={() => router.push('/login')} />
        </View>
        {showLater ? (
          <Pressable style={styles.laterLink} onPress={onLater} hitSlop={8}>
            <Text style={styles.laterLinkText}>あとで</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.signUpLink} onPress={() => router.push('/sign-up')}>
          <Text style={styles.signUpLinkText}>新規登録</Text>
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
  buttonWrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  laterLink: {
    paddingVertical: Spacing.one,
  },
  laterLinkText: {
    color: NS.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  signUpLink: {
    paddingVertical: Spacing.one,
  },
  signUpLinkText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
