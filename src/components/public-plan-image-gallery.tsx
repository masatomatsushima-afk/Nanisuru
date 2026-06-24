import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { PublicPlanImage } from '@/types/public-plan-image';

type PublicPlanImageGalleryProps = {
  images?: PublicPlanImage[];
  title?: string;
  category?: string;
  destination?: string;
  variant?: 'card' | 'detail' | 'profile';
};

function PlanImagePlaceholder({
  title,
  category,
  destination,
  height,
}: {
  title?: string;
  category?: string;
  destination?: string;
  height: number;
}) {
  return (
    <View style={[styles.placeholderRoot, { height }]}>
      <View style={styles.placeholderGlowTop} />
      <View style={styles.placeholderGlowBottom} />
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderEmoji}>🗺️</Text>
        {category ? <Text style={styles.placeholderCategory}>{category}</Text> : null}
        {destination ? (
          <Text style={styles.placeholderDestination} numberOfLines={1}>
            {destination}
          </Text>
        ) : null}
        {title ? (
          <Text style={styles.placeholderTitle} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function PublicPlanImageGallery({
  images = [],
  title,
  category,
  destination,
  variant = 'card',
}: PublicPlanImageGalleryProps) {
  const { width } = useWindowDimensions();
  const sorted = [...images].sort((a, b) => a.orderIndex - b.orderIndex);
  const cardHeight = variant === 'profile' ? 168 : variant === 'detail' ? 280 : 196;
  const detailWidth = Math.min(width - Spacing.four * 2, 480);

  if (sorted.length === 0) {
    return (
      <PlanImagePlaceholder
        title={title}
        category={category}
        destination={destination}
        height={cardHeight}
      />
    );
  }

  if (variant === 'detail') {
    return (
      <View style={styles.detailWrap}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={detailWidth}
          contentContainerStyle={styles.detailScrollContent}>
          {sorted.map((image) => (
            <Image
              key={image.id}
              source={{ uri: image.imageUrl }}
              style={[styles.detailImage, { width: detailWidth, height: cardHeight }]}
              contentFit="cover"
              transition={200}
            />
          ))}
        </ScrollView>
        {sorted.length > 1 ? (
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{sorted.length}枚</Text>
          </View>
        ) : null}
      </View>
    );
  }

  const primary = sorted[0];

  return (
    <View style={[styles.cardWrap, { height: cardHeight }]}>
      <Image
        source={{ uri: primary.imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.cardOverlayTop} />
      <View style={styles.cardOverlayBottom} />
      {sorted.length > 1 ? (
        <View style={styles.multiBadge}>
          <Text style={styles.multiBadgeText}>+{sorted.length - 1}</Text>
        </View>
      ) : null}
      {category ? (
        <View style={styles.categoryFloating}>
          <Text style={styles.categoryFloatingText}>{category}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholderRoot: {
    borderTopLeftRadius: NS.radius.lg,
    borderTopRightRadius: NS.radius.lg,
    overflow: 'hidden',
    backgroundColor: '#1B2440',
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  placeholderGlowTop: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(129, 140, 248, 0.35)',
  },
  placeholderGlowBottom: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(96, 165, 250, 0.22)',
  },
  placeholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: 6,
  },
  placeholderEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  placeholderCategory: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  placeholderDestination: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '100%',
  },
  placeholderTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: '100%',
  },
  cardWrap: {
    borderTopLeftRadius: NS.radius.lg,
    borderTopRightRadius: NS.radius.lg,
    overflow: 'hidden',
    backgroundColor: NS.colors.bgElevated,
    marginBottom: 0,
  },
  cardOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  cardOverlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  multiBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  multiBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryFloating: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  categoryFloatingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  detailWrap: {
    borderRadius: NS.radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  detailScrollContent: {
    alignItems: 'stretch',
  },
  detailImage: {
    backgroundColor: NS.colors.bgElevated,
  },
  counterPill: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
