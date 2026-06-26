import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS, getChipPalette } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import { getLocalHiddenSpotCategoryIcon } from '@/types/local-hidden-spot';

type ProfileSpotGridCardProps = {
  spot: LocalHiddenSpot;
  index: number;
  onPress: () => void;
};

export function ProfileSpotGridCard({ spot, index, onPress }: ProfileSpotGridCardProps) {
  const palette = getChipPalette(index);
  const icon = getLocalHiddenSpotCategoryIcon(spot.category);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.hero, { backgroundColor: palette.bg }]}>
        <Text style={styles.heroIcon}>{icon}</Text>
        <View style={[styles.categoryBadge, { borderColor: palette.border }]}>
          <Text style={[styles.categoryText, { color: palette.text }]}>{spot.category}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {spot.name}
        </Text>
        <Text style={styles.area} numberOfLines={1}>
          📍 {spot.area}
        </Text>
        {spot.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {spot.tags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.statsRow}>
          <Text style={styles.stat}>♥ {spot.likeCount}</Text>
          <Text style={styles.stat}>🔖 {spot.saveCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '48%',
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  hero: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroIcon: {
    fontSize: 30,
  },
  categoryBadge: {
    position: 'absolute',
    right: Spacing.two,
    top: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
  },
  body: {
    padding: Spacing.two,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: NS.colors.text,
    lineHeight: 17,
  },
  area: {
    fontSize: 11,
    color: NS.colors.textSecondary,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  stat: {
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
});
