import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { NS, getChipPalette } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

export type DiscoverTopCategoryId =
  | 'recommend'
  | 'popular'
  | 'date'
  | 'cafe'
  | 'night'
  | 'travel'
  | 'hidden'
  | 'memory';

export const DISCOVER_TOP_CATEGORIES: Array<{ id: DiscoverTopCategoryId; label: string }> = [
  { id: 'recommend', label: 'おすすめ' },
  { id: 'popular', label: '人気' },
  { id: 'date', label: 'デート' },
  { id: 'cafe', label: 'カフェ' },
  { id: 'night', label: '夜遊び' },
  { id: 'travel', label: '旅行' },
  { id: 'hidden', label: '穴場' },
  { id: 'memory', label: '思い出' },
];

type DiscoverCategoryChipsProps = {
  activeId: DiscoverTopCategoryId;
  onChange: (id: DiscoverTopCategoryId) => void;
};

export function DiscoverCategoryChips({ activeId, onChange }: DiscoverCategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}>
      {DISCOVER_TOP_CATEGORIES.map((item, index) => {
        const active = activeId === item.id;
        const palette = getChipPalette(index);
        return (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.chip,
              active
                ? [styles.chipActive, { backgroundColor: palette.bg, borderColor: palette.border }]
                : styles.chipIdle,
              pressed && styles.chipPressed,
            ]}
            onPress={() => onChange(item.id)}>
            <Text
              style={[
                styles.chipLabel,
                active ? { color: palette.text, fontWeight: '900' } : null,
              ]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.one + 2,
    paddingVertical: Spacing.one,
  },
  chip: {
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
  },
  chipActive: {
    ...NS.shadow.card,
    shadowOpacity: 0.08,
  },
  chipIdle: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderColor: 'transparent',
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
