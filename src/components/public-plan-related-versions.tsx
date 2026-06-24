import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { fetchRelatedPublicPlanVersions } from '@/lib/public-plan-versions';
import {
  getVersionShortLabel,
  type PublicPlanVersionWithPlan,
} from '@/types/public-plan-feedback';
import { formatPublicPlanDuration, getPublicPlanDestination } from '@/types/public-plan';

type PublicPlanRelatedVersionsProps = {
  publicPlanId: string;
  currentUserId: string | null;
};

export function PublicPlanRelatedVersions({
  publicPlanId,
  currentUserId,
}: PublicPlanRelatedVersionsProps) {
  const [versions, setVersions] = useState<PublicPlanVersionWithPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const related = await fetchRelatedPublicPlanVersions(publicPlanId, currentUserId);
      setVersions(related.filter((item) => item.versionPublicPlanId !== publicPlanId));
    } catch {
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  }, [publicPlanId, currentUserId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  if (isLoading) {
    return (
      <PremiumCard style={styles.card}>
        <Text style={styles.title}>🌿 このプランの別バージョン</Text>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={NS.colors.accent} />
        </View>
      </PremiumCard>
    );
  }

  if (versions.length === 0) return null;

  return (
    <PremiumCard style={styles.card}>
      <Text style={styles.title}>🌿 このプランの別バージョン</Text>
      <Text style={styles.lead}>リクエストをもとに作成された関連プランです。</Text>
      <View style={styles.list}>
        {versions.map((version) => {
          const isDraft = version.plan.visibility === 'private';
          const isOwner = currentUserId === version.plan.userId;
          return (
            <Pressable
              key={version.id}
              style={({ pressed }) => [styles.versionCard, pressed && styles.versionCardPressed]}
              onPress={() => {
                if (isDraft && isOwner) {
                  router.push(`/plan-version-draft/${version.plan.id}`);
                  return;
                }
                router.push(`/public-plan/${version.plan.id}`);
              }}>
              <View style={styles.versionHeader}>
                <View style={styles.versionBadge}>
                  <Text style={styles.versionBadgeText}>
                    {getVersionShortLabel(version.versionType)}
                  </Text>
                </View>
                {isDraft && isOwner ? (
                  <View style={styles.draftBadge}>
                    <Text style={styles.draftBadgeText}>下書き</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.versionTitle} numberOfLines={2}>
                {version.plan.title}
              </Text>
              <Text style={styles.versionMeta} numberOfLines={1}>
                {getPublicPlanDestination(version.plan)} · {formatPublicPlanDuration(version.plan)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.two,
  },
  lead: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  loadingWrap: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  versionCard: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  versionCardPressed: {
    opacity: 0.9,
    borderColor: NS.colors.accentBorder,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  versionBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  versionBadgeText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  draftBadge: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  draftBadgeText: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  versionTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  versionMeta: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
});
