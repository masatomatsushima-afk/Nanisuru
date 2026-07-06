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
import { signInWithApple, signInWithGoogle } from '@/lib/auth';

export default function SignUpScreen() {
  const { isConfigured, session, isLoading: authLoading, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (session) {
      router.replace('/(tabs)');
    }
  }, [authLoading, session]);

  if (authLoading) {
    return <LoadingState message="読み込み中..." />;
  }

  const handleSuccess = () => {
    router.replace('/(tabs)');
  };

  const handleAuthError = (error: unknown) => {
    const message = toAuthErrorMessage(error, '新規登録に失敗しました');
    if (message.includes('キャンセル')) return;
    Alert.alert('登録エラー', message);
  };

  const runSignUp = async (provider: 'google' | 'apple', action: () => Promise<void>) => {
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

  const handleEmailSignUp = async (email: string, password: string) => {
    if (!isConfigured) {
      Alert.alert('Supabase未設定', 'Supabaseの設定を確認してください。');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password);
      Alert.alert(
        '登録完了',
        'アカウントを作成しました。確認メールが届く場合は、リンクを開いて有効化してください。',
      );
      handleSuccess();
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="SIGN UP"
      title="Nanisuruをはじめる"
      subtitle="無料でアカウントを作成し、あなただけの旅行プランを保存・管理できます"
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>すでにアカウントをお持ちの方</Text>
          <Pressable onPress={() => router.push('/login')} hitSlop={8}>
            <Text style={styles.footerLink}>ログイン</Text>
          </Pressable>
        </View>
      }>
      <PremiumCard style={styles.card}>
        <Text style={styles.cardTitle}>新規登録</Text>

        <View style={styles.benefits}>
          <Text style={styles.benefitItem}>☁️ プランをクラウドに保存</Text>
          <Text style={styles.benefitItem}>✈️ どの端末からでもアクセス</Text>
          <Text style={styles.benefitItem}>🔒 安全なログイン</Text>
        </View>

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
              mode="signup"
              onSubmitEmail={handleEmailSignUp}
              isLoading={isLoading}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>または</Text>
              <View style={styles.dividerLine} />
            </View>

            <OAuthButtons
              onGooglePress={() => runSignUp('google', signInWithGoogle)}
              onApplePress={() => runSignUp('apple', signInWithApple)}
              isLoading={isLoading}
              loadingProvider={loadingProvider}
            />
          </>
        )}

        <Text style={styles.terms}>
          登録することで、Nanisuruの利用規約およびプライバシーポリシーに同意したものとみなされます。
        </Text>
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
  benefits: {
    gap: Spacing.two,
    padding: Spacing.three,
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  benefitItem: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
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
  terms: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
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
