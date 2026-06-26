import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeStoryCircle } from '@/components/home/home-story-circle';
import { HOME_LAYOUT } from '@/constants/home-layout';
import { NS, getChipPalette } from '@/constants/nanisuru-ui';
import { VISUAL_PRESETS, type VisualTheme } from '@/lib/visual-placeholders';

const STORY_ITEMS: Array<{ id: string; label: string; theme: VisualTheme; imageUrl: string }> = [
  { id: 'recommend', label: 'おすすめ', theme: 'popular', imageUrl: VISUAL_PRESETS.popular.imageUrl },
  { id: 'cafe', label: 'カフェ', theme: 'cafe', imageUrl: VISUAL_PRESETS.cafe.imageUrl },
  { id: 'travel', label: '旅行', theme: 'travel', imageUrl: VISUAL_PRESETS.travel.imageUrl },
  { id: 'night', label: '夜遊び', theme: 'night', imageUrl: VISUAL_PRESETS.night.imageUrl },
  { id: 'outing', label: 'おでかけ', theme: 'outing', imageUrl: VISUAL_PRESETS.outing.imageUrl },
  { id: 'food', label: 'グルメ', theme: 'food', imageUrl: VISUAL_PRESETS.food.imageUrl },
];

type HomeStoryRowProps = {
  onCategoryPress?: (id: string) => void;
};

export function HomeStoryRow({ onCategoryPress }: HomeStoryRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}>
      {STORY_ITEMS.map((item, index) => {
        const palette = getChipPalette(index);

        return (
          <HomeStoryCircle
            key={item.id}
            label={item.label}
            labelColor={palette.text}
            ringColor={palette.dot}
            theme={item.theme}
            imageUrl={item.imageUrl}
            onPress={() => {
              onCategoryPress?.(item.id);
              if (item.id === 'night') {
                router.push('/after-plan');
                return;
              }
              router.push('/(tabs)/explore');
            }}
          />
        );
      })}

      <HomeStoryCircle
        label="すべて"
        labelColor={NS.colors.textSecondary}
        ringColor="#CBD5E1"
        onPress={() => router.push('/(tabs)/explore')}>
        <View style={styles.allPhoto}>
          <View style={styles.allGrid}>
            <View style={[styles.allDot, styles.allDotA]} />
            <View style={[styles.allDot, styles.allDotB]} />
            <View style={[styles.allDot, styles.allDotC]} />
            <View style={[styles.allDot, styles.allDotD]} />
          </View>
        </View>
      </HomeStoryCircle>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 10,
    paddingVertical: 1,
    paddingRight: 4,
    marginTop: -2,
  },
  allPhoto: {
    width: HOME_LAYOUT.categoryPhoto,
    height: HOME_LAYOUT.categoryPhoto,
    borderRadius: HOME_LAYOUT.categoryPhoto / 2,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allGrid: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    justifyContent: 'center',
    alignContent: 'center',
  },
  allDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  allDotA: { backgroundColor: '#FDBA74' },
  allDotB: { backgroundColor: '#93C5FD' },
  allDotC: { backgroundColor: '#C4B5FD' },
  allDotD: { backgroundColor: '#6EE7B7' },
});
