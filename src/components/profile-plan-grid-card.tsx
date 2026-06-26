import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
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
      <VisualCover
        height={120}
        imageUrl={coverUrl}
        category={plan.category}
        seed={plan.id}
        overlay="bottom"
        showEmoji={!coverUrl}
        borderRadius={NS.lifestyle.tileRadius}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{plan.category}</Text>
        </View>
      </VisualCover>
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
