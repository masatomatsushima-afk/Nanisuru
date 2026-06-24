import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverSortBar } from '@/components/discover-sort-bar';
import { PublicPlanCard } from '@/components/public-plan-card';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { fetchPublicPlans } from '@/lib/public-plans';
import type { DiscoverSortOption, PublicPlan } from '@/types/public-plan';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { isConfigured, session } = useAuth();
  const currentUserId = session?.user.id ?? null;
  const [sort, setSort] = useState<DiscoverSortOption>('popular');
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(
    async (refresh = false) => {
      if (!isConfigured) {
        setPlans([]);
        setIsLoading(false);
        return;
      }

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        setPlans(await fetchPublicPlans(sort));
      } catch (err) {
        setError(err instanceof Error ? err.message : '公開プランの取得に失敗しました');
        setPlans([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isConfigured, sort],
  );

  useFocusEffect(
    useCallback(() => {
      void loadPlans();
    }, [loadPlans]),
  );

  useEffect(() => {
    if (isConfigured) {
      void loadPlans();
    }
  }, [sort, isConfigured, loadPlans]);

  const handleSortChange = (next: DiscoverSortOption) => {
    setSort(next);
  };

  const handleFollowChange = (
    planId: string,
    next: { isFollowing: boolean; followerCount: number },
  ) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              isFollowingCreator: next.isFollowing,
              creatorFollowerCount: next.followerCount,
            }
          : plan,
      ),
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadPlans(true)}
          tintColor={NS.colors.accent}
        />
      }>
      <FadeInView>
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>DISCOVER</Text>
        <Text style={styles.title}>発見</Text>
        <Text style={styles.subtitle}>
          みんなが作ったデート・旅行プランから、次のお出かけのヒントを見つけよう。
        </Text>
      </FadeInView>

      {!isConfigured ? (
        <PremiumCard style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Supabase の設定が必要です</Text>
          <Text style={styles.noticeText}>
            発見タブを使うには public_plans テーブルを作成してください。
          </Text>
        </PremiumCard>
      ) : (
        <>
          <DiscoverSortBar value={sort} onChange={handleSortChange} />

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={NS.colors.accent} />
              <Text style={styles.loadingText}>プランを読み込み中...</Text>
            </View>
          ) : error ? (
            <PremiumCard style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>読み込みに失敗しました</Text>
              <Text style={styles.noticeText}>{error}</Text>
              <PrimaryButton label="再試行" onPress={() => void loadPlans()} />
            </PremiumCard>
          ) : plans.length === 0 ? (
            <PremiumCard variant="accent" style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyTitle}>まだ公開プランがありません</Text>
              <Text style={styles.emptyText}>
                保存済みプランから「このプランを公開する」で、最初のプランを投稿してみましょう。
              </Text>
              <PrimaryButton label="プランを作る" onPress={() => router.push('/')} />
            </PremiumCard>
          ) : (
            <View style={styles.feed}>
              {plans.map((plan, index) => (
                <PublicPlanCard
                  key={plan.id}
                  plan={plan}
                  index={index}
                  currentUserId={currentUserId}
                  onPress={() => router.push(`/public-plan/${plan.id}`)}
                  onFollowChange={handleFollowChange}
                  onRequireLogin={() => router.push('/login')}
                />
              ))}
            </View>
          )}
        </>
      )}

      <FadeInView delay={180}>
        <PremiumCard variant="flat" style={styles.ctaCard} onPress={() => router.push('/')}>
          <Text style={styles.ctaTitle}>自分だけのプランを作る</Text>
          <Text style={styles.ctaText}>AIがあなたの好みに合わせて、オリジナルプランを提案します。</Text>
          <Text style={styles.ctaLink}>プランを生成 →</Text>
        </PremiumCard>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  heroGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: NS.colors.accentGlow,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.two,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.four,
    maxWidth: 340,
    lineHeight: 22,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  feed: {
    marginTop: Spacing.three,
  },
  noticeCard: {
    padding: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  noticeTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  noticeText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  emptyCard: {
    padding: Spacing.five,
    alignItems: 'center',
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  emptyText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  ctaCard: {
    padding: Spacing.four,
    marginTop: Spacing.two,
  },
  ctaTitle: {
    color: NS.colors.text,
    ...NS.typography.titleSm,
    marginBottom: Spacing.two,
  },
  ctaText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.three,
  },
  ctaLink: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
