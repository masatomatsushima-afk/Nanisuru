import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FollowButton } from '@/components/follow-button';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  formatPublicPlanBudget,
  formatPublicPlanDuration,
  getPublicPlanDestination,
  type PublicPlan,
} from '@/types/public-plan';
import { getProfileInitial } from '@/types/user-profile';

type PublicPlanCardProps = {
  plan: PublicPlan;
  index: number;
  currentUserId?: string | null;
  onPress: () => void;
  onCreatorPress?: () => void;
  onFollowChange?: (planId: string, next: { isFollowing: boolean; followerCount: number }) => void;
  onRequireLogin?: () => void;
};

export function PublicPlanCard({
  plan,
  index,
  currentUserId,
  onPress,
  onCreatorPress,
  onFollowChange,
  onRequireLogin,
}: PublicPlanCardProps) {
  const destination = getPublicPlanDestination(plan);
  const budget = formatPublicPlanBudget(plan);
  const duration = formatPublicPlanDuration(plan);
  const isSelf = currentUserId === plan.userId;
  const followerCount = plan.creatorFollowerCount ?? 0;

  const openCreator = () => {
    if (onCreatorPress) {
      onCreatorPress();
      return;
    }
    router.push(`/creator/${plan.userId}`);
  };

  const requireLogin = () => {
    if (onRequireLogin) {
      onRequireLogin();
      return;
    }
    router.push('/login');
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(420).springify()}>
      <PremiumCard style={styles.card}>
        <Pressable style={({ pressed }) => [pressed && styles.bodyPressed]} onPress={onPress}>
          <View style={styles.header}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{plan.category}</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statText}>♥ {plan.likeCount}</Text>
              <Text style={styles.statDivider}>·</Text>
              <Text style={styles.statText}>📌 {plan.saveCount}</Text>
            </View>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {plan.title}
          </Text>

          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {destination}
            </Text>
          </View>

          {plan.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {plan.description}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>💰 {budget}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>🗓 {duration}</Text>
            </View>
          </View>

          {plan.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {plan.tags.slice(0, 4).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.creatorPressable, pressed && styles.bodyPressed]}
            onPress={openCreator}>
            <View style={styles.creatorAvatar}>
              <Text style={styles.creatorInitial}>
                {getProfileInitial(plan.creatorDisplayName)}
              </Text>
            </View>
            <View style={styles.creatorTextWrap}>
              <Text style={styles.creatorName} numberOfLines={1}>
                {plan.creatorDisplayName}
              </Text>
              {followerCount > 0 ? (
                <Text style={styles.followerText}>フォロワー {followerCount}</Text>
              ) : null}
            </View>
          </Pressable>

          {!isSelf ? (
            <FollowButton
              userId={plan.userId}
              isFollowing={Boolean(plan.isFollowingCreator)}
              isSelf={false}
              isLoggedIn={Boolean(currentUserId)}
              compact
              onRequireLogin={requireLogin}
              onFollowChange={(next) => onFollowChange?.(plan.id, next)}
            />
          ) : (
            <Pressable onPress={onPress}>
              <Text style={styles.openHint}>詳細 →</Text>
            </Pressable>
          )}
        </View>
      </PremiumCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  bodyPressed: {
    opacity: 0.92,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  categoryBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  categoryBadgeText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  statDivider: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
  title: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 28,
    marginBottom: Spacing.two,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  locationIcon: {
    fontSize: 13,
  },
  locationText: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  metaPill: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  metaPillText: {
    color: NS.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tag: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  tagText: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    marginTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  creatorPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: 0,
  },
  creatorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInitial: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  creatorTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  creatorName: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  followerText: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  openHint: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
