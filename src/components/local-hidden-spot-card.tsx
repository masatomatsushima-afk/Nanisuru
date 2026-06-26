import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS, getChipPalette } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import { getLocalHiddenSpotCategoryIcon } from '@/types/local-hidden-spot';

type LocalHiddenSpotCardProps = {
  spot: LocalHiddenSpot;
  index?: number;
  compact?: boolean;
  onPress?: () => void;
};

export function LocalHiddenSpotCard({
  spot,
  index = 0,
  compact = false,
  onPress,
}: LocalHiddenSpotCardProps) {
  const palette = getChipPalette(index);
  const icon = getLocalHiddenSpotCategoryIcon(spot.category);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <PremiumCard style={compact ? styles.cardCompact : styles.card} onPress={onPress}>
        <View style={styles.topRow}>
          <View style={[styles.categoryPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Text style={styles.categoryIcon}>{icon}</Text>
            <Text style={[styles.categoryText, { color: palette.text }]}>{spot.category}</Text>
          </View>
          {spot.isLocalContributor ? (
            <View style={styles.localBadge}>
              <Text style={styles.localBadgeText}>🌟 ローカル投稿者</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.name} numberOfLines={compact ? 1 : 2}>
          {spot.name}
        </Text>
        <Text style={styles.area}>📍 {spot.area}</Text>
        {!compact ? (
          <Text style={styles.description} numberOfLines={2}>
            {spot.description}
          </Text>
        ) : null}

        {spot.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {spot.tags.slice(0, compact ? 2 : 4).map((tag, tagIndex) => (
              <View
                key={tag}
                style={[
                  styles.tagChip,
                  { backgroundColor: getChipPalette(index + tagIndex + 1).bg },
                ]}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.meta}>❤️ {spot.likeCount}</Text>
          <Text style={styles.meta}>🔖 {spot.saveCount}</Text>
          <Text style={styles.meta}>👀 {spot.wantCount}</Text>
          <Text style={styles.meta}>💬 {spot.commentCount}</Text>
        </View>

        <View style={styles.creatorRow}>
          <Text style={styles.creatorName}>{spot.creatorDisplayName}</Text>
          {spot.creatorArea ? (
            <Text style={styles.creatorArea}>· {spot.creatorArea}</Text>
          ) : null}
        </View>
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    width: 280,
    marginRight: Spacing.three,
  },
  cardCompact: {
    width: 240,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  categoryIcon: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
  },
  localBadge: {
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.yellow,
  },
  localBadgeText: {
    color: '#A16207',
    fontSize: 10,
    fontWeight: '800',
  },
  name: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  area: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  description: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.two,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.two,
  },
  tagChip: {
    borderRadius: NS.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: NS.colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  meta: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  creatorName: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  creatorArea: {
    color: NS.colors.textMuted,
    fontSize: 11,
  },
});
