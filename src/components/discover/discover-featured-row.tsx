import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DiscoverCompactPlanCard } from '@/components/discover/discover-compact-plan-card';
import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { RankedPublicPlan } from '@/types/discover-ranking';

type DiscoverFeaturedRowProps = {
  trending: RankedPublicPlan[];
};

export function DiscoverFeaturedRow({ trending }: DiscoverFeaturedRowProps) {
  if (trending.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <VisualCover
          height={88}
          theme="popular"
          overlay="full"
          showEmoji={false}
          borderRadius={NS.lifestyle.cardRadius}>
          <View style={styles.headerOverlay}>
            <Text style={styles.kicker}>CURATED</Text>
            <Text style={styles.title}>今人気のプラン</Text>
            <Text style={styles.subtitle}>みんなが保存している定番</Text>
          </View>
        </VisualCover>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {trending.slice(0, 3).map((item, index) => (
          <DiscoverCompactPlanCard
            key={`featured-${item.plan.id}-${index}`}
            plan={item.plan}
            variant="featured"
            colorIndex={index}
            onPress={() => router.push(`/public-plan/${item.plan.id}`)}
            onCreatorPress={() => router.push(`/creator/${item.plan.userId}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  headerCard: {
    marginHorizontal: Spacing.one,
    borderRadius: NS.lifestyle.cardRadius,
    overflow: 'hidden',
    ...NS.shadow.card,
    shadowOpacity: 0.08,
  },
  headerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.three,
    gap: 2,
  },
  kicker: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(15, 23, 42, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
  },
  scroll: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.one,
  },
});
