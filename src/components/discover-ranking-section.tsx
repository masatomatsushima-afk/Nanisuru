import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PublicPlanCard } from '@/components/public-plan-card';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { buildRankedPlans } from '@/lib/discover-ranking';
import {
  DISCOVER_RANKING_TABS,
  DISCOVER_TIME_FILTERS,
  formatRankBadge,
  type DiscoverRankingTab,
  type DiscoverTimeFilter,
  type RankedPublicPlan,
} from '@/types/discover-ranking';
import type { PublicPlan } from '@/types/public-plan';

type DiscoverRankingSectionProps = {
  plans: PublicPlan[];
  popularCreatorIds: Set<string>;
  currentUserId: string | null;
  onFollowChange: (planId: string, next: { isFollowing: boolean; followerCount: number }) => void;
  onRequireLogin: () => void;
  onPressPlan: (planId: string) => void;
};

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
      onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function DiscoverRankingSection({
  plans,
  popularCreatorIds,
  currentUserId,
  onFollowChange,
  onRequireLogin,
  onPressPlan,
}: DiscoverRankingSectionProps) {
  const [tab, setTab] = useState<DiscoverRankingTab>('overall');
  const [timeFilter, setTimeFilter] = useState<DiscoverTimeFilter>('week');
  const [ranked, setRanked] = useState<RankedPublicPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void buildRankedPlans(plans, tab, timeFilter).then((result) => {
      if (!cancelled) {
        setRanked(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [plans, tab, timeFilter]);

  return (
    <PremiumCard style={styles.card}>
      <Text style={styles.title}>🏆 ランキング</Text>
      <Text style={styles.subtitle}>人気プランをカテゴリー別・期間別にチェック</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}>
        {DISCOVER_RANKING_TABS.map((item) => (
          <FilterChip
            key={item.id}
            label={item.label}
            selected={tab === item.id}
            onPress={() => setTab(item.id)}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeRow}>
        {DISCOVER_TIME_FILTERS.map((item) => (
          <FilterChip
            key={item.id}
            label={item.label}
            selected={timeFilter === item.id}
            onPress={() => setTimeFilter(item.id)}
          />
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={NS.colors.accent} />
          <Text style={styles.loadingText}>ランキングを集計中...</Text>
        </View>
      ) : ranked.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>まだランキングに表示できるプランがありません</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {ranked.slice(0, 20).map((item, index) => (
            <PublicPlanCard
              key={item.plan.id}
              plan={item.plan}
              index={index}
              currentUserId={currentUserId}
              rankBadge={formatRankBadge(item.rank)}
              rankingScore={item.score}
              showPopularCreatorBadge={popularCreatorIds.has(item.plan.userId)}
              onPress={() => onPressPlan(item.plan.id)}
              onFollowChange={onFollowChange}
              onRequireLogin={onRequireLogin}
            />
          ))}
        </View>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.one,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.four,
  },
  tabRow: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  timeRow: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  chip: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  chipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelSelected: {
    color: NS.colors.accent,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  list: {
    gap: 0,
  },
});
