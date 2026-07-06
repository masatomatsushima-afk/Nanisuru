import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/auth/auth-layout';
import { EmailAuthForm } from '@/components/auth/email-auth-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { LoadingState } from '@/components/ui/state-cards';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { toAuthErrorMessage } from '@/lib/auth-errors';
import {
  resetPasswordForEmail,
  signInWithApple,
  signInWithGoogle,
  signInWithMagicLink,
} from '@/lib/auth';

export default function LoginScreen() {
  const { isConfigured, session, isLoading: authLoading, signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (session) {
      router.replace('/(tabs)');
    }
  }, [authLoading, session]);

  const handleSuccess = () => {
    router.replace('/(tabs)');
  };

  const handleAuthError = (error: unknown, fallback: string) => {
    const message = toAuthErrorMessage(error, fallback);
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
      handleAuthError(error, 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleEmailLogin = async (email: string, password: string) => {
    if (!isConfigured) {
      Alert.alert('Supabase未設定', 'Supabaseの設定を確認してください。');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
      handleSuccess();
    } catch (error) {
      handleAuthError(error, 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (email: string) => {
    if (!isConfigured) return;
    setIsLoading(true);
    try {
      await signInWithMagicLink(email);
      Alert.alert(
        'メールを確認してください',
        'ログインリンクを送信しました。メール内のリンクからログインできます。',
      );
    } catch (error) {
      handleAuthError(error, '通信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    if (!isConfigured) return;
    setIsLoading(true);
    try {
      await resetPasswordForEmail(email);
      Alert.alert(
        'メールを確認してください',
        'パスワード再設定用のリンクを送信しました。',
      );
    } catch (error) {
      handleAuthError(error, '通信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <AuthLayout eyebrow="LOGIN" title="" subtitle="">
        <LoadingState message="確認中..." />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="LOGIN"
      title="おかえりなさい"
      subtitle="ログインして、保存したプランや思い出にアクセスしましょう"
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>アカウントをお持ちでない方</Text>
          <Pressable onPress={() => router.push('/sign-up')} hitSlop={8}>
            <Text style={styles.footerLink}>新規登録</Text>
          </Pressable>
        </View>
      }>
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>ログイン</Text>

        {!isConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Supabaseの設定が必要です</Text>
            <Text style={styles.noticeText}>
              .env に Supabase の URL と Anon Key を追加し、Expo を再起動してください。
            </Text>
          </View>
        ) : (
          <>
            <EmailAuthForm
              mode="login"
              onSubmitEmail={handleEmailLogin}
              onMagicLink={handleMagicLink}
              onForgotPassword={handleForgotPassword}
              isLoading={isLoading}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>または</Text>
              <View style={styles.dividerLine} />
            </View>

            <OAuthButtons
              onGooglePress={() => runSignIn('google', signInWithGoogle)}
              onApplePress={() => runSignIn('apple', signInWithApple)}
              isLoading={isLoading}
              loadingProvider={loadingProvider}
            />
          </>
        )}
      </PremiumCard>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.five,
    gap: Spacing.three,
  },
  cardTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: NS.colors.border,
  },
  dividerText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  notice: {
    backgroundColor: NS.colors.dangerSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
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
