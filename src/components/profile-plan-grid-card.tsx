import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getPublicPlanDestination, type PublicPlan } from '@/types/public-plan';

type ProfilePlanGridCardProps = {
  plan: PublicPlan;
  onPress: () => void;
};

export function ProfilePlanGridCard({ plan, onPress }: ProfilePlanGridCardProps) {
  const coverUrl = plan.images?.[0]?.imageUrl;
  const destination = getPublicPlanDestination(plan);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.coverWrap}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverEmoji}>🗺️</Text>
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{plan.category}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {plan.title}
        </Text>
        <Text style={styles.area} numberOfLines={1}>
          📍 {destination}
        </Text>
        <View style={styles.statsRow}>
          <Text style={styles.stat}>♥ {plan.likeCount}</Text>
          <Text style={styles.stat}>🔖 {plan.saveCount}</Text>
          {(plan.copyCount ?? 0) > 0 ? (
            <Text style={styles.stat}>📋 {plan.copyCount}</Text>
          ) : null}
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
  coverWrap: {
    height: 130,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    backgroundColor: NS.colors.skySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 28,
  },
  categoryBadge: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: NS.colors.accent,
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
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  stat: {
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
});
