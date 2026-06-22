import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/auth/auth-layout';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { signInWithApple, signInWithGoogle } from '@/lib/auth';

export default function LoginScreen() {
  const { isConfigured } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  const handleSuccess = () => {
    router.replace('/(tabs)');
  };

  const handleAuthError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'ログインに失敗しました。もう一度お試しください。';

    if (message.includes('キャンセル')) return;

    Alert.alert('ログインエラー', message);
  };

  const runSignIn = async (provider: 'google' | 'apple', action: () => Promise<void>) => {
    if (!isConfigured) {
      Alert.alert(
        'Supabase未設定',
        '.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定してください。',
      );
      return;
    }

    setIsLoading(true);
    setLoadingProvider(provider);

    try {
      await action();
      handleSuccess();
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <AuthLayout
      eyebrow="LOGIN"
      title="おかえりなさい"
      subtitle="ログインして、保存したプランやお気に入りにアクセスしましょう"
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>アカウントをお持ちでない方</Text>
          <Pressable onPress={() => router.push('/sign-up')} hitSlop={8}>
            <Text style={styles.footerLink}>新規登録はこちら</Text>
          </Pressable>
        </View>
      }>
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>ログイン</Text>
        <Text style={styles.cardSubtitle}>Google または Apple アカウントでサインイン</Text>

        {!isConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Supabaseの設定が必要です</Text>
            <Text style={styles.noticeText}>
              .env に Supabase の URL と Anon Key を追加し、Expo を再起動してください。
            </Text>
          </View>
        ) : null}

        <OAuthButtons
          onGooglePress={() => runSignIn('google', signInWithGoogle)}
          onApplePress={() => runSignIn('apple', signInWithApple)}
          isLoading={isLoading}
          loadingProvider={loadingProvider}
        />
      </PremiumCard>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.five,
  },
  cardTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.one,
  },
  cardSubtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.five,
    lineHeight: 22,
  },
  notice: {
    backgroundColor: NS.colors.dangerSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  noticeTitle: {
    color: NS.colors.danger,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  noticeText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  footerText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
