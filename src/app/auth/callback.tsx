import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { ErrorStateCard } from '@/components/ui/state-cards';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  clearWebOAuthCallbackUrl,
  completeOAuthCallback,
  getUserDisplayName,
} from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ensureProfileForUserId } from '@/lib/user-profiles';

async function tryEnsureProfile(userId: string, displayName: string): Promise<void> {
  try {
    await ensureProfileForUserId(userId, displayName);
  } catch (error) {
    console.warn('[auth] プロフィール作成に失敗しました（ログインは継続します）:', error);
  }
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const finishLogin = async (initialUrl: string | null) => {
      if (!isSupabaseConfigured()) {
        setError('Supabase の設定を確認してください。');
        return;
      }

      try {
        const session = await completeOAuthCallback(initialUrl);

        if (!session) {
          setError('ログインに失敗しました。もう一度お試しください。');
          return;
        }

        await tryEnsureProfile(session.user.id, getUserDisplayName(session.user));
        clearWebOAuthCallbackUrl();

        router.replace('/(tabs)');
      } catch (callbackError) {
        const message =
          callbackError instanceof Error
            ? callbackError.message
            : 'ログインに失敗しました。もう一度お試しください。';
        setError(message);
      }
    };

    void Linking.getInitialURL().then((initialUrl) => finishLogin(initialUrl));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void completeOAuthCallback(url).then(async (session) => {
        if (!session) {
          setError('ログインに失敗しました。もう一度お試しください。');
          return;
        }

        await tryEnsureProfile(session.user.id, getUserDisplayName(session.user));
        clearWebOAuthCallbackUrl();
        router.replace('/(tabs)');
      });
    });

    return () => subscription.remove();
  }, [router]);

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorStateCard
          title="ログインできませんでした"
          message={error}
          onRetry={() => router.replace('/login')}
          retryLabel="ログイン画面へ"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={NS.colors.accent} />
      <Text style={styles.loadingText}>ログイン処理中...</Text>
      <Text style={styles.loadingHint}>認証情報を確認しています</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    marginTop: Spacing.three,
  },
  loadingHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    marginTop: Spacing.one,
  },
});
