import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  getPublicPlanDestination,
  type PublicPlan,
} from '@/types/public-plan';
import { getProfileInitial } from '@/types/user-profile';

type DiscoverCompactPlanCardProps = {
  plan: PublicPlan;
  variant?: 'featured' | 'grid';
  colorIndex?: number;
  onPress: () => void;
  onCreatorPress?: () => void;
};

export function DiscoverCompactPlanCard({
  plan,
  variant = 'grid',
  onPress,
  onCreatorPress,
}: DiscoverCompactPlanCardProps) {
  const destination = getPublicPlanDestination(plan);
  const coverUrl = plan.images?.[0]?.imageUrl;
  const tag = plan.tags[0] ?? plan.category;
  const isFeatured = variant === 'featured';
  const coverHeight = isFeatured ? 148 : 132;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isFeatured ? styles.cardFeatured : styles.cardGrid,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}>
      <VisualCover
        height={coverHeight}
        imageUrl={coverUrl}
        category={plan.category}
        seed={plan.id}
        overlay="bottom"
        showEmoji={!coverUrl}
        borderRadius={NS.lifestyle.tileRadius}>
        <View style={styles.coverTop}>
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>#{tag}</Text>
          </View>
          {isFeatured ? (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>人気</Text>
            </View>
          ) : null}
        </View>
      </VisualCover>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {plan.title}
        </Text>
        <Text style={styles.area} numberOfLines={1}>
          📍 {destination}
        </Text>
        <View style={styles.footer}>
          <Pressable
            style={styles.creatorRow}
            onPress={(event) => {
              event.stopPropagation?.();
              onCreatorPress?.();
            }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getProfileInitial(plan.creatorDisplayName)}</Text>
            </View>
            <Text style={styles.creatorName} numberOfLines={1}>
              {plan.creatorDisplayName}
            </Text>
          </Pressable>
          <View style={styles.stats}>
            <Text style={styles.stat}>♥ {plan.likeCount}</Text>
            <Text style={styles.stat}>📌 {plan.saveCount}</Text>
            {(plan.copyCount ?? 0) > 0 ? (
              <Text style={styles.stat}>📋 {plan.copyCount}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.lifestyle.tileRadius,
    overflow: 'hidden',
    ...NS.shadow.cardLg,
    shadowOpacity: 0.1,
  },
  cardFeatured: {
    width: 196,
  },
  cardGrid: {
    width: '48%',
    minWidth: '47%',
    maxWidth: '48%',
  },
  cardPressed: {
    opacity: 0.94,
  },
  coverTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  tagBadge: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    color: NS.colors.accent,
  },
  featuredBadge: {
    backgroundColor: NS.colors.coral,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  featuredBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  body: {
    padding: Spacing.two + 2,
    gap: 3,
  },
  title: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
    letterSpacing: -0.2,
  },
  area: {
    color: NS.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    marginTop: 4,
    gap: 4,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: NS.colors.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '900',
    color: NS.colors.accent,
  },
  creatorName: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stat: {
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
});
