import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  isDiscoverPlanSavedLocally,
  toggleDiscoverPlanSavedLocally,
} from '@/lib/discover-local-saves';
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
  const tags = plan.tags.length ? plan.tags.slice(0, 2) : [plan.category];
  const isFeatured = variant === 'featured';
  const coverHeight = isFeatured ? 148 : 132;
  const [savedLocally, setSavedLocally] = useState(() => isDiscoverPlanSavedLocally(plan.id));
  const saveCount = plan.saveCount + (savedLocally ? 1 : 0);

  const handleSave = () => {
    const next = toggleDiscoverPlanSavedLocally(plan.id);
    setSavedLocally(next);
  };

  return (
    <View
      style={[
        styles.card,
        isFeatured ? styles.cardFeatured : styles.cardGrid,
      ]}>
      <Pressable style={({ pressed }) => [pressed && styles.cardPressed]} onPress={onPress}>
        <VisualCover
          height={coverHeight}
          imageUrl={coverUrl}
          category={plan.category}
          seed={plan.id}
          overlay="bottom"
          showEmoji={!coverUrl}
          borderRadius={NS.lifestyle.tileRadius}>
          <View style={styles.coverTop}>
            <View style={styles.tagRow}>
              {tags.map((tag, index) => (
                <View key={`${plan.id}-tag-${tag}-${index}`} style={styles.tagBadge}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
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
            <Text style={styles.stat}>📌 {saveCount}</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, savedLocally && styles.actionBtnSaved]}
          onPress={handleSave}>
          <Text style={[styles.actionBtnText, savedLocally && styles.actionBtnTextSaved]}>
            {savedLocally ? '保存済み' : '保存'}
          </Text>
        </Pressable>
        <Pressable style={styles.actionBtnPrimary} onPress={onPress}>
          <Text style={styles.actionBtnPrimaryText}>詳しく見る</Text>
        </Pressable>
      </View>
    </View>
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
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
  stat: {
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.one + 2,
    alignItems: 'center',
    backgroundColor: NS.colors.bgInput,
  },
  actionBtnSaved: {
    borderColor: NS.colors.accent,
    backgroundColor: NS.colors.accentSoft,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: NS.colors.textSecondary,
  },
  actionBtnTextSaved: {
    color: NS.colors.accent,
  },
  actionBtnPrimary: {
    flex: 1,
    borderRadius: NS.radius.md,
    paddingVertical: Spacing.one + 2,
    alignItems: 'center',
    backgroundColor: NS.colors.accent,
  },
  actionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
