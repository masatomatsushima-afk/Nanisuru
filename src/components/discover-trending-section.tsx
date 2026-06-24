import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PublicPlanCard } from '@/components/public-plan-card';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { formatRankBadge } from '@/types/discover-ranking';
import type { RankedPublicPlan } from '@/types/discover-ranking';

type DiscoverTrendingSectionProps = {
  trending: RankedPublicPlan[];
  popularCreatorIds: Set<string>;
  currentUserId: string | null;
  onFollowChange: (planId: string, next: { isFollowing: boolean; followerCount: number }) => void;
  onRequireLogin: () => void;
};

export function DiscoverTrendingSection({
  trending,
  popularCreatorIds,
  currentUserId,
  onFollowChange,
  onRequireLogin,
}: DiscoverTrendingSectionProps) {
  if (trending.length === 0) return null;

  return (
    <PremiumCard variant="accent" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.fire}>🔥</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>今人気のプラン</Text>
          <Text style={styles.subtitle}>今週のいいね・保存・コピーが伸びているプラン</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {trending.map((item) => (
          <View key={item.plan.id} style={styles.trendingCardWrap}>
            <PublicPlanCard
              plan={item.plan}
              index={item.rank}
              currentUserId={currentUserId}
              rankBadge={formatRankBadge(item.rank)}
              rankingScore={item.score}
              showPopularCreatorBadge={popularCreatorIds.has(item.plan.userId)}
              compact
              onPress={() => router.push(`/public-plan/${item.plan.id}`)}
              onFollowChange={onFollowChange}
              onRequireLogin={onRequireLogin}
            />
          </View>
        ))}
      </ScrollView>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  fire: {
    fontSize: 28,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  scrollContent: {
    gap: Spacing.three,
  },
  trendingCardWrap: {
    width: 300,
  },
});
