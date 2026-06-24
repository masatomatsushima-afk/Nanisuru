import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getRatingTendencies } from '@/lib/plan-rating';
import type { RatingTendencies } from '@/types/plan-rating';

type RatingTendencySectionProps = {
  isLoggedIn: boolean;
  isConfigured: boolean;
};

function StarDisplay({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <View style={styles.starDisplayRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Text
          key={star}
          style={[styles.starDisplay, star <= rounded ? styles.starDisplayFilled : styles.starDisplayEmpty]}>
          {star <= rounded ? '★' : '☆'}
        </Text>
      ))}
    </View>
  );
}

export function RatingTendencySection({ isLoggedIn, isConfigured }: RatingTendencySectionProps) {
  const [tendencies, setTendencies] = useState<RatingTendencies | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTendencies = useCallback(async () => {
    if (!isLoggedIn || !isConfigured) {
      setTendencies(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setTendencies(await getRatingTendencies());
    } catch (err) {
      setError(err instanceof Error ? err.message : '評価傾向の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, isLoggedIn]);

  useFocusEffect(
    useCallback(() => {
      void loadTendencies();
    }, [loadTendencies]),
  );

  return (
    <PremiumCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>⭐</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>あなたの評価傾向</Text>
          <Text style={styles.subtitle}>プラン評価から学習した好み</Text>
        </View>
      </View>

      {!isConfigured ? (
        <Text style={styles.emptyText}>Supabase を設定すると評価傾向を表示できます</Text>
      ) : !isLoggedIn ? (
        <Text style={styles.emptyText}>ログインしてプランを評価すると、傾向がここに表示されます</Text>
      ) : isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={NS.colors.accent} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : !tendencies || tendencies.totalRatings === 0 ? (
        <Text style={styles.emptyText}>
          プラン生成後に「このプランどうだった？」から評価すると、ここに傾向が表示されます
        </Text>
      ) : (
        <View style={styles.body}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>平均評価</Text>
              {tendencies.averageStars != null ? (
                <>
                  <Text style={styles.summaryValue}>
                    {tendencies.averageStars.toFixed(1)}
                  </Text>
                  <StarDisplay value={tendencies.averageStars} />
                </>
              ) : null}
            </View>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>評価数</Text>
              <Text style={styles.summaryValue}>{tendencies.totalRatings}</Text>
              <Text style={styles.summaryHint}>件</Text>
            </View>
          </View>

          {tendencies.topFeedbackTags.length > 0 ? (
            <View style={styles.tagsSection}>
              <Text style={styles.sectionLabel}>よく選ぶフィードバック</Text>
              <View style={styles.tagRow}>
                {tendencies.topFeedbackTags.map(({ tag, count }) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>
                      {tag}
                      <Text style={styles.tagCount}> ×{count}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {tendencies.insights.length > 0 ? (
            <View style={styles.insightsSection}>
              <Text style={styles.sectionLabel}>傾向</Text>
              {tendencies.insights.map((insight) => (
                <View key={insight} style={styles.insightRow}>
                  <Text style={styles.insightBullet}>•</Text>
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  loadingWrap: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  emptyText: {
    color: NS.colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 14,
    lineHeight: 22,
  },
  body: {
    gap: Spacing.four,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryBlock: {
    flex: 1,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  summaryLabel: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    color: NS.colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summaryHint: {
    color: NS.colors.textSecondary,
    fontSize: 12,
  },
  starDisplayRow: {
    flexDirection: 'row',
    gap: 2,
  },
  starDisplay: {
    fontSize: 16,
    lineHeight: 18,
  },
  starDisplayFilled: {
    color: '#FBBF24',
  },
  starDisplayEmpty: {
    color: NS.colors.textMuted,
  },
  tagsSection: {
    gap: Spacing.two,
  },
  sectionLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tagChip: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  tagChipText: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  tagCount: {
    color: NS.colors.textMuted,
    fontWeight: '500',
  },
  insightsSection: {
    gap: Spacing.two,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  insightBullet: {
    color: NS.colors.accent,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
  },
  insightText: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
});
