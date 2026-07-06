import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';

type ProfileSpotGridCardProps = {
  spot: LocalHiddenSpot;
  index: number;
  onPress: () => void;
};

export function ProfileSpotGridCard({ spot, index, onPress }: ProfileSpotGridCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <VisualCover
        height={96}
        imageUrl={spot.imageUrl}
        category={spot.category}
        seed={spot.id}
        theme="local"
        overlay="bottom"
        showEmoji={!spot.imageUrl}
        borderRadius={NS.lifestyle.tileRadius}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{spot.category}</Text>
        </View>
      </VisualCover>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {spot.name}
        </Text>
        <Text style={styles.area} numberOfLines={1}>
          📍 {spot.area}
        </Text>
        {spot.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {spot.tags.slice(0, 2).map((tag, tagIndex) => (
              <View key={`${spot.id}-tag-${tag}-${tagIndex}`} style={styles.tag}>
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
    borderRadius: NS.lifestyle.tileRadius,
    overflow: 'hidden',
    ...NS.shadow.cardLg,
    shadowOpacity: 0.1,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
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
    backgroundColor: NS.colors.mintSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
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
