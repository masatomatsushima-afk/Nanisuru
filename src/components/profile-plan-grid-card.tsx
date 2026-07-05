import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  formatPublicPlanDuration,
  getPublicPlanDestination,
  type PublicPlan,
} from '@/types/public-plan';

type ProfilePlanGridCardProps = {
  plan: PublicPlan;
  onPress: () => void;
};

export function ProfilePlanGridCard({ plan, onPress }: ProfilePlanGridCardProps) {
  const coverUrl = plan.images?.[0]?.imageUrl;
  const destination = getPublicPlanDestination(plan);
  const duration = formatPublicPlanDuration(plan);
  const companion = plan.payload.companion?.trim() || '未設定';
  const travelPurpose = plan.payload.travelPurpose?.trim() || plan.payload.mood?.trim() || '—';

  return (
    <View style={styles.card}>
      <Pressable onPress={onPress}>
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
          <Text style={styles.meta} numberOfLines={1}>
            📍 {destination}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            ⏱ {duration} · 👥 {companion}
          </Text>
          <Text style={styles.purpose} numberOfLines={1}>
            {travelPurpose}
          </Text>
          <Text style={styles.stat}>🔖 {plan.saveCount}</Text>
        </View>
      </Pressable>
      <Pressable style={styles.viewBtn} onPress={onPress}>
        <Text style={styles.viewBtnText}>プランを見る</Text>
      </Pressable>
    </View>
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
    gap: 3,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: NS.colors.text,
    lineHeight: 17,
  },
  meta: {
    fontSize: 11,
    color: NS.colors.textSecondary,
    fontWeight: '600',
  },
  purpose: {
    fontSize: 10,
    color: NS.colors.textMuted,
    fontWeight: '600',
  },
  stat: {
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
    marginTop: 2,
  },
  viewBtn: {
    marginHorizontal: Spacing.two,
    marginBottom: Spacing.two,
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    paddingVertical: Spacing.one + 2,
    alignItems: 'center',
  },
  viewBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: NS.colors.accent,
  },
});
