import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverRankingSection } from '@/components/discover-ranking-section';
import { DiscoverRecommendationsSection } from '@/components/discover-recommendations-section';
import { DiscoverSearchFilters } from '@/components/discover-search-filters';
import { DiscoverTrendingSection } from '@/components/discover-trending-section';
import { PublicPlanCard } from '@/components/public-plan-card';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useUserLocation } from '@/contexts/user-location-context';
import { applyDiscoverFilters, countActiveDiscoverFilters } from '@/lib/discover-filters';
import { buildDiscoverRecommendations } from '@/lib/discover-recommendations';
import {
  buildPopularCreatorIds,
  buildRankedPlans,
  buildTrendingPlans,
} from '@/lib/discover-ranking';
import { notifyRankingEntries } from '@/lib/notifications';
import { fetchPublicPlans } from '@/lib/public-plans';
import {
  DEFAULT_DISCOVER_FILTERS,
  type DiscoverFilterState,
} from '@/types/discover-filters';
import type { RankedPublicPlan } from '@/types/discover-ranking';
import type { DiscoverRecommendationsResult } from '@/types/discover-recommendations';
import type { PublicPlan } from '@/types/public-plan';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { isConfigured, session } = useAuth();
  const { location, fetchLocation } = useUserLocation();
  const currentUserId = session?.user.id ?? null;
  const [allPlans, setAllPlans] = useState<PublicPlan[]>([]);
  const [filters, setFilters] = useState<DiscoverFilterState>(DEFAULT_DISCOVER_FILTERS);
  const [trending, setTrending] = useState<RankedPublicPlan[]>([]);
  const [recommendations, setRecommendations] = useState<DiscoverRecommendationsResult | null>(null);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
  const [popularCreatorIds, setPopularCreatorIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayedPlans = useMemo(
    () => applyDiscoverFilters(allPlans, filters),
    [allPlans, filters],
  );

  const hasActiveFilters = countActiveDiscoverFilters(filters) > 0;

  const loadRecommendations = useCallback(
    async (plans: PublicPlan[], trendingPlans: RankedPublicPlan[]) => {
      setIsRecommendationsLoading(true);
      try {
        setRecommendations(
          await buildDiscoverRecommendations({
            plans,
            trendingPlans,
            currentUserId,
            filters,
            location,
          }),
        );
      } catch {
        setRecommendations(null);
      } finally {
        setIsRecommendationsLoading(false);
      }
    },
    [currentUserId, filters, location],
  );

  const loadRankingMeta = useCallback(async (plans: PublicPlan[]) => {
    const [trendingPlans, overallRanked] = await Promise.all([
      buildTrendingPlans(plans),
      buildRankedPlans(plans, 'overall', 'week'),
    ]);
    setTrending(trendingPlans);
    setPopularCreatorIds(buildPopularCreatorIds(overallRanked));

    if (currentUserId) {
      void notifyRankingEntries(
        trendingPlans.map((item) => ({ plan: item.plan, rank: item.rank })),
      );
    }
  }, [currentUserId]);

  const loadPlans = useCallback(
    async (refresh = false) => {
      if (!isConfigured) {
        setAllPlans([]);
        setTrending([]);
        setRecommendations(null);
        setPopularCreatorIds(new Set());
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
        const plans = await fetchPublicPlans();
        setAllPlans(plans);
        await loadRankingMeta(plans);
      } catch (err) {
        setError(err instanceof Error ? err.message : '公開プランの取得に失敗しました');
        setAllPlans([]);
        setTrending([]);
        setRecommendations(null);
        setPopularCreatorIds(new Set());
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isConfigured, loadRankingMeta],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchLocation();
      void loadPlans();
    }, [fetchLocation, loadPlans]),
  );

  useEffect(() => {
    if (isConfigured) {
      void loadPlans();
    }
  }, [isConfigured, loadPlans]);

  useEffect(() => {
    if (!isConfigured || allPlans.length === 0) return;
    void loadRecommendations(allPlans, trending);
  }, [filters, location, isConfigured, allPlans, trending, loadRecommendations]);

  const handleFollowChange = (
    planId: string,
    next: { isFollowing: boolean; followerCount: number },
  ) => {
    setAllPlans((prev) =>
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
      keyboardShouldPersistTaps="handled"
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
      ) : isLoading ? (
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
      ) : allPlans.length === 0 ? (
        <PremiumCard variant="accent" style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyTitle}>まだ公開プランがありません</Text>
          <Text style={styles.emptyText}>
            保存済みプランから「このプランを公開する」で、最初のプランを投稿してみましょう。
          </Text>
          <PrimaryButton label="プランを作る" onPress={() => router.push('/')} />
        </PremiumCard>
      ) : (
        <>
          <DiscoverRecommendationsSection
            recommendations={recommendations}
            isLoading={isRecommendationsLoading}
            allPlans={allPlans}
            currentUserId={currentUserId}
            filters={filters}
            location={location}
            popularCreatorIds={popularCreatorIds}
            onFollowChange={handleFollowChange}
            onRequireLogin={() => router.push('/login')}
          />

          <DiscoverTrendingSection
            trending={trending}
            popularCreatorIds={popularCreatorIds}
            currentUserId={currentUserId}
            onFollowChange={handleFollowChange}
            onRequireLogin={() => router.push('/login')}
          />

          <DiscoverRankingSection
            plans={allPlans}
            popularCreatorIds={popularCreatorIds}
            currentUserId={currentUserId}
            onFollowChange={handleFollowChange}
            onRequireLogin={() => router.push('/login')}
            onPressPlan={(planId) => router.push(`/public-plan/${planId}`)}
          />

          <DiscoverSearchFilters value={filters} onChange={setFilters} />

          {displayedPlans.length === 0 ? (
            <PremiumCard style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>
                条件に合うプランが見つかりませんでした。条件を変えて探してみてください。
              </Text>
              {hasActiveFilters ? (
                <PrimaryButton
                  label="フィルターをリセット"
                  variant="secondary"
                  onPress={() => setFilters(DEFAULT_DISCOVER_FILTERS)}
                />
              ) : null}
            </PremiumCard>
          ) : (
            <View style={styles.feed}>
              <Text style={styles.resultCount}>{displayedPlans.length}件のプラン</Text>
              {displayedPlans.map((plan, index) => (
                <PublicPlanCard
                  key={plan.id}
                  plan={plan}
                  index={index}
                  currentUserId={currentUserId}
                  showPopularCreatorBadge={popularCreatorIds.has(plan.userId)}
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
  resultCount: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: Spacing.three,
    letterSpacing: 0.4,
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.three,
    textAlign: 'center',
    lineHeight: 24,
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
