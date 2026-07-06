import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DiscoverCategoryChips,
  type DiscoverTopCategoryId,
} from '@/components/discover/discover-category-chips';
import { DiscoverCompactPlanCard } from '@/components/discover/discover-compact-plan-card';
import { DiscoverEmptyState } from '@/components/discover/discover-empty-state';
import { DiscoverFeaturedRow } from '@/components/discover/discover-featured-row';
import { DiscoverHeader } from '@/components/discover/discover-header';
import { DiscoverLocalCompact } from '@/components/discover/discover-local-compact';
import { DiscoverMemoriesCompact } from '@/components/discover/discover-memories-compact';
import { DiscoverSearchFilters } from '@/components/discover-search-filters';
import { LifestyleSectionHeader } from '@/components/ui/lifestyle-section-header';
import { ScreenBackground } from '@/components/ui/screen-background';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useUserLocation } from '@/contexts/user-location-context';
import { applyDiscoverFilters, countActiveDiscoverFilters } from '@/lib/discover-filters';
import { loadDiscoverFeed, type DiscoverFeedSection } from '@/lib/discover-feed';
import { getTravelUserPreferences } from '@/lib/travel-user-preferences';
import {
  filtersForDiscoverCategory,
  isMemoryCategory,
} from '@/lib/discover-top-category';
import { notifyRankingEntries } from '@/lib/notifications';
import {
  DEFAULT_DISCOVER_FILTERS,
  type DiscoverFilterState,
} from '@/types/discover-filters';
import type { RankedPublicPlan } from '@/types/discover-ranking';
import type { PublicPlan } from '@/types/public-plan';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { isConfigured, session } = useAuth();
  const { location, fetchLocation } = useUserLocation();
  const currentUserId = session?.user.id ?? null;
  const scrollRef = useRef<ScrollView>(null);
  const memoriesAnchorY = useRef(0);

  const [allPlans, setAllPlans] = useState<PublicPlan[]>([]);
  const [feedSections, setFeedSections] = useState<DiscoverFeedSection[]>([]);
  const [fromMock, setFromMock] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilterState>(DEFAULT_DISCOVER_FILTERS);
  const [topCategory, setTopCategory] = useState<DiscoverTopCategoryId>('recommend');
  const [trending, setTrending] = useState<RankedPublicPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const displayedPlans = useMemo(
    () => applyDiscoverFilters(allPlans, filters),
    [allPlans, filters],
  );

  const hasActiveFilters = countActiveDiscoverFilters(filters) > 0;
  const showMemoriesSection = isMemoryCategory(topCategory);

  const loadRankingMeta = useCallback(async (plans: PublicPlan[]) => {
    const { buildTrendingPlans } = await import('@/lib/discover-ranking');
    const trendingPlans = await buildTrendingPlans(plans);
    setTrending(trendingPlans);

    if (currentUserId) {
      void notifyRankingEntries(
        trendingPlans.map((item) => ({ plan: item.plan, rank: item.rank })),
      );
    }
  }, [currentUserId]);

  const loadInFlightRef = useRef(false);

  const loadPlans = useCallback(
    async (refresh = false) => {
      if (loadInFlightRef.current && !refresh) return;
      loadInFlightRef.current = true;

      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const feed = await loadDiscoverFeed(undefined, await getTravelUserPreferences());
        setAllPlans(feed.plans);
        setFeedSections(feed.sections);
        setFromMock(feed.fromMock);
        setTrending(feed.trending);
        if (currentUserId) {
          void notifyRankingEntries(
            feed.trending.map((item) => ({ plan: item.plan, rank: item.rank })),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '公開プランの取得に失敗しました');
        setAllPlans([]);
        setFeedSections([]);
        setTrending([]);
      } finally {
        loadInFlightRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUserId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchLocation();
      void loadPlans();
    }, [fetchLocation, loadPlans]),
  );

  const handleTopCategoryChange = (categoryId: DiscoverTopCategoryId) => {
    setTopCategory(categoryId);
    setFilters(filtersForDiscoverCategory(categoryId));
    if (isMemoryCategory(categoryId)) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(memoriesAnchorY.current - Spacing.four, 0),
          animated: true,
        });
      });
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={NS.colors.accent} />
          <Text style={styles.loadingText}>読み込み中…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <DiscoverEmptyState
          emoji="⚠️"
          title="読み込みに失敗しました"
          description={error}
          buttonLabel="もう一度試す"
          onAction={() => void loadPlans()}
        />
      );
    }

    if (allPlans.length === 0) {
      return (
        <>
          <DiscoverEmptyState
            title="まだ投稿がありません"
            description="最初のおすすめプランを投稿してみませんか？"
            buttonLabel="投稿する"
            onAction={() => {
              if (!session) router.push('/login');
              else router.push('/(tabs)');
            }}
          />
          <DiscoverLocalCompact
            isConfigured={isConfigured}
            isLoggedIn={Boolean(session)}
            areaHint={location?.city ?? location?.label}
            onRequireLogin={() => router.push('/login')}
          />
        </>
      );
    }

    return (
      <>
        {fromMock ? (
          <View style={styles.mockNotice}>
            <Text style={styles.mockNoticeText}>
              サンプルデータを表示しています。公開プランを投稿すると、ここに表示されます。
            </Text>
          </View>
        ) : null}

        {!showMemoriesSection ? (
          <>
            <DiscoverFeaturedRow trending={trending} />

            {feedSections.map((section) => (
              <View key={section.id} style={styles.section}>
                <LifestyleSectionHeader title={section.title} />
                <View style={styles.feedGrid}>
                  {section.plans.map((plan, index) => (
                    <DiscoverCompactPlanCard
                      key={plan.id}
                      plan={plan}
                      variant="grid"
                      colorIndex={index}
                      onPress={() => router.push(`/public-plan/${plan.id}`)}
                      onCreatorPress={() => router.push(`/creator/${plan.userId}`)}
                    />
                  ))}
                </View>
              </View>
            ))}

            {hasActiveFilters ? (
              <View style={styles.section}>
                <LifestyleSectionHeader
                  title="検索結果"
                  subtitle={`${displayedPlans.length}件のプラン`}
                />
                {displayedPlans.length === 0 ? (
                  <DiscoverEmptyState
                    emoji="🔍"
                    title="条件に合うプランがありません"
                    description="フィルターを変えて、もう一度探してみてください。"
                    buttonLabel="フィルターをリセット"
                    onAction={() => setFilters(DEFAULT_DISCOVER_FILTERS)}
                  />
                ) : (
                  <View style={styles.feedGrid}>
                    {displayedPlans.map((plan, index) => (
                      <DiscoverCompactPlanCard
                        key={plan.id}
                        plan={plan}
                        variant="grid"
                        colorIndex={index}
                        onPress={() => router.push(`/public-plan/${plan.id}`)}
                        onCreatorPress={() => router.push(`/creator/${plan.userId}`)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </>
        ) : null}

        <View
          onLayout={(event) => {
            memoriesAnchorY.current = event.nativeEvent.layout.y;
          }}>
          <DiscoverMemoriesCompact />
        </View>

        <DiscoverLocalCompact
          isConfigured={isConfigured}
          isLoggedIn={Boolean(session)}
          areaHint={location?.city ?? location?.label}
          onRequireLogin={() => router.push('/login')}
        />
      </>
    );
  };

  return (
    <ScreenBackground>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
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
        <DiscoverHeader
          onSearchPress={() => {
            setShowSearch((prev) => !prev);
            if (!showSearch) setShowFilters(false);
          }}
          onFilterPress={() => {
            setShowFilters((prev) => !prev);
            if (!showFilters) setShowSearch(false);
          }}
          filterActive={hasActiveFilters || showFilters}
          isLoggedIn={Boolean(session)}
          onRequireLogin={() => router.push('/login')}
        />

        <DiscoverCategoryChips activeId={topCategory} onChange={handleTopCategoryChange} />

        {showSearch || showFilters ? (
          <View style={styles.filtersWrap}>
            <DiscoverSearchFilters value={filters} onChange={setFilters} />
          </View>
        ) : null}

        {renderBody()}

        {allPlans.length > 0 ? (
          <View style={styles.bottomCta}>
            <PrimaryButton
              label="自分だけのプランを作る"
              onPress={() => router.push('/(tabs)')}
              variant="warm"
            />
          </View>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  filtersWrap: {
    marginTop: -Spacing.one,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
  section: {
    gap: Spacing.two,
  },
  mockNotice: {
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
  },
  mockNoticeText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  feedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  bottomCta: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
});
