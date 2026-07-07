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
import { loopTestLogOnce } from '@/lib/loop-test-config';
import {
  filtersForDiscoverCategory,
  isMemoryCategory,
} from '@/lib/discover-top-category';
import { notifyRankingEntries } from '@/lib/notifications';
import { safeKey, safeText } from '@/lib/safe-text';
import {
  DEFAULT_DISCOVER_FILTERS,
  type DiscoverFilterState,
} from '@/types/discover-filters';
import type { RankedPublicPlan } from '@/types/discover-ranking';
import type { PublicPlan } from '@/types/public-plan';

function samePublicPlans(left: PublicPlan[], right: PublicPlan[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameFeedSections(left: DiscoverFeedSection[], right: DiscoverFeedSection[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameTrending(left: RankedPublicPlan[], right: RankedPublicPlan[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function DiscoverScreen() {
  loopTestLogOnce('restore:Discover', 'restoring Discover');

  const insets = useSafeAreaInsets();
  const { isConfigured, session } = useAuth();
  const { location, fetchLocation } = useUserLocation();
  const currentUserId = session?.user.id ?? null;
  const scrollRef = useRef<ScrollView>(null);
  const memoriesAnchorY = useRef(0);
  const didFetchLocationRef = useRef(false);

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

  const areaHint = safeText(location?.city ?? location?.label);

  const displayedPlans = useMemo(
    () => applyDiscoverFilters(allPlans, filters),
    [allPlans, filters],
  );

  const hasActiveFilters = countActiveDiscoverFilters(filters) > 0;
  const showMemoriesSection = isMemoryCategory(topCategory);

  const loadInFlightRef = useRef(false);

  const loadPlans = useCallback(
    async (refresh = false) => {
      if (loadInFlightRef.current && !refresh) return;
      loadInFlightRef.current = true;

      if (refresh) setIsRefreshing((prev) => (prev ? prev : true));
      else setIsLoading((prev) => (prev ? prev : true));
      setError((prev) => (prev ? null : prev));

      try {
        const feed = await loadDiscoverFeed(undefined, null);
        setAllPlans((prev) => (samePublicPlans(prev, feed.plans) ? prev : feed.plans));
        setFeedSections((prev) =>
          sameFeedSections(prev, feed.sections) ? prev : feed.sections,
        );
        setFromMock((prev) => (prev === feed.fromMock ? prev : feed.fromMock));
        setTrending((prev) => (sameTrending(prev, feed.trending) ? prev : feed.trending));
        if (currentUserId) {
          void notifyRankingEntries(
            feed.trending.map((item) => ({ plan: item.plan, rank: item.rank })),
          );
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '公開プランの取得に失敗しました';
        setError((prev) => (prev === message ? prev : message));
        setAllPlans((prev) => (prev.length === 0 ? prev : []));
        setFeedSections((prev) => (prev.length === 0 ? prev : []));
        setTrending((prev) => (prev.length === 0 ? prev : []));
      } finally {
        loadInFlightRef.current = false;
        setIsLoading((prev) => (prev ? false : prev));
        setIsRefreshing((prev) => (prev ? false : prev));
      }
    },
    [currentUserId],
  );

  useFocusEffect(
    useCallback(() => {
      if (!didFetchLocationRef.current) {
        didFetchLocationRef.current = true;
        void fetchLocation();
      }
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
            areaHint={areaHint || undefined}
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

            {feedSections.map((section, sectionIndex) => (
              <View
                key={safeKey(section.id, `discover-section-${sectionIndex}`)}
                style={styles.section}>
                <LifestyleSectionHeader title={safeText(section.title)} />
                <View style={styles.feedGrid}>
                  {section.plans.map((plan, index) => (
                    <DiscoverCompactPlanCard
                      key={`${safeKey(section.id, 'section')}-${safeKey(plan.id, `plan-${index}`)}-${index}`}
                      plan={plan}
                      variant="grid"
                      colorIndex={index}
                      onPress={() => router.push(`/public-plan/${safeText(plan.id)}`)}
                      onCreatorPress={() =>
                        router.push(`/creator/${safeText(plan.userId)}`)
                      }
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
                        key={`search-${safeKey(plan.id, `plan-${index}`)}-${index}`}
                        plan={plan}
                        variant="grid"
                        colorIndex={index}
                        onPress={() => router.push(`/public-plan/${safeText(plan.id)}`)}
                        onCreatorPress={() =>
                          router.push(`/creator/${safeText(plan.userId)}`)
                        }
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
          areaHint={areaHint || undefined}
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
