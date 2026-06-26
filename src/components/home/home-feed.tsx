import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { HomeActionGrid } from '@/components/home/home-action-grid';
import { HomeDiscoverPreview } from '@/components/home/home-discover-preview';
import { HomeFeaturedHero } from '@/components/home/home-featured-hero';
import { HomeHeader } from '@/components/home/home-header';
import { HomeStoryRow } from '@/components/home/home-story-row';
import { TravelMemoryHomeCard } from '@/components/travel-memory-home-card';
import { HOME_UI } from '@/constants/home-ui';
import { NS } from '@/constants/nanisuru-ui';
import type { TravelMemoryDisplayData } from '@/lib/travel-memory-display';
import type { PlanCreationType } from '@/types/plan-creation';

type HomeFeedProps = {
  onScrollToForm: (planType?: PlanCreationType) => void;
  onTravelPress: () => void;
  afterPlanLocation?: string;
  memoryDisplay?: TravelMemoryDisplayData | null;
  isMemoryLoading?: boolean;
};

export function HomeFeed({
  onScrollToForm,
  onTravelPress,
  afterPlanLocation,
  memoryDisplay,
  isMemoryLoading = false,
}: HomeFeedProps) {
  const handleChipPress = (planType?: PlanCreationType, route?: string) => {
    if (route) {
      router.push(route as '/after-plan');
      return;
    }
    onScrollToForm(planType);
  };

  return (
    <View style={styles.feed}>
      <HomeHeader />
      <View style={styles.heroBlock}>
        <Text style={styles.recLabel}>✨ 今日のおすすめ</Text>
        <HomeFeaturedHero
          onPress={() => onScrollToForm('今日のお出かけ')}
          onChipPress={handleChipPress}
        />
      </View>
      <HomeStoryRow />
      <HomeActionGrid onTravelPress={onTravelPress} afterPlanLocation={afterPlanLocation} />
      <View style={styles.discoverBlock}>
        <HomeDiscoverPreview />
      </View>
      <TravelMemoryHomeCard
        preferenceChips={memoryDisplay?.preferenceChips ?? []}
        hasMemory={memoryDisplay?.hasMemory ?? false}
        isLoading={isMemoryLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  feed: {
    gap: HOME_UI.spacing.sectionGap,
  },
  heroBlock: {
    gap: 4,
    marginTop: -1,
  },
  recLabel: {
    color: NS.colors.orange,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
    paddingLeft: 1,
  },
  discoverBlock: {
    paddingBottom: 4,
  },
});
