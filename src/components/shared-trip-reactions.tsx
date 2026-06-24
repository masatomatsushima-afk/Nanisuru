import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  addSharedReaction,
  getLocalReactionTypes,
  getSharedReactionCounts,
} from '@/lib/shared-trip-reactions';
import {
  SHARED_REACTION_META,
  type SharedReactionCounts,
  type SharedReactionType,
} from '@/types/shared-reaction';

type SharedTripReactionsProps = {
  sharedPlanId: string;
};

function ReactionButton({
  emoji,
  label,
  count,
  selected,
  disabled,
  onPress,
}: {
  emoji: string;
  label: SharedReactionType;
  count: number;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.reactionButton,
        selected && styles.reactionButtonSelected,
        pressed && !disabled && styles.reactionButtonPressed,
        disabled && styles.reactionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={styles.reactionEmoji}>{emoji}</Text>
      <View style={styles.reactionTextWrap}>
        <Text style={[styles.reactionLabel, selected && styles.reactionLabelSelected]}>
          {label}
        </Text>
        <Text style={[styles.reactionCount, selected && styles.reactionCountSelected]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

export function SharedTripReactions({ sharedPlanId }: SharedTripReactionsProps) {
  const [counts, setCounts] = useState<SharedReactionCounts | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<SharedReactionType[]>([]);
  const [submittingType, setSubmittingType] = useState<SharedReactionType | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadReactions = useCallback(async () => {
    const [nextCounts, localTypes] = await Promise.all([
      getSharedReactionCounts(sharedPlanId),
      getLocalReactionTypes(sharedPlanId),
    ]);
    setCounts(nextCounts);
    setSelectedTypes(localTypes);
  }, [sharedPlanId]);

  useEffect(() => {
    void loadReactions();
  }, [loadReactions]);

  const handleReact = async (reactionType: SharedReactionType) => {
    if (submittingType || selectedTypes.includes(reactionType)) return;

    setSubmittingType(reactionType);
    setFeedback(null);
    try {
      const result = await addSharedReaction(sharedPlanId, reactionType);
      setCounts(result.counts);
      if (result.alreadyReacted) {
        setSelectedTypes((prev) =>
          prev.includes(reactionType) ? prev : [...prev, reactionType],
        );
        setFeedback('このリアクションは送信済みです');
        return;
      }
      setSelectedTypes((prev) => [...prev, reactionType]);
      setFeedback('リアクションを送りました！');
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback('送信に失敗しました。もう一度お試しください');
    } finally {
      setSubmittingType(null);
    }
  };

  const totalReactions = counts
    ? SHARED_REACTION_META.reduce((sum, item) => sum + counts[item.type], 0)
    : 0;

  return (
    <PremiumCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>💬</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>このプラン、どう思う？</Text>
          <Text style={styles.subtitle}>
            ログイン不要 · タップでリアクション（各1回まで）
          </Text>
        </View>
      </View>

      {!counts ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={NS.colors.accent} />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {SHARED_REACTION_META.map(({ type, emoji }) => (
              <ReactionButton
                key={type}
                emoji={emoji}
                label={type}
                count={counts[type]}
                selected={selectedTypes.includes(type)}
                disabled={submittingType != null || selectedTypes.includes(type)}
                onPress={() => void handleReact(type)}
              />
            ))}
          </View>

          {totalReactions > 0 ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>みんなの反応</Text>
              <View style={styles.summaryList}>
                {SHARED_REACTION_META.filter(({ type }) => counts[type] > 0).map(
                  ({ type, emoji }) => (
                    <View key={type} style={styles.summaryRow}>
                      <Text style={styles.summaryEmoji}>{emoji}</Text>
                      <Text style={styles.summaryText}>
                        {type} {counts[type]}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyHint}>最初のリアクションを送ってみましょう</Text>
          )}
        </>
      )}

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
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
  headerEmoji: {
    fontSize: 28,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  reactionButton: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 64,
  },
  reactionButtonSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  reactionButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  reactionButtonDisabled: {
    opacity: 0.72,
  },
  reactionEmoji: {
    fontSize: 24,
  },
  reactionTextWrap: {
    flex: 1,
    gap: 2,
  },
  reactionLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  reactionLabelSelected: {
    color: NS.colors.accent,
  },
  reactionCount: {
    color: NS.colors.textMuted,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  reactionCountSelected: {
    color: NS.colors.text,
  },
  summaryBox: {
    marginTop: Spacing.four,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  summaryTitle: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  summaryList: {
    gap: Spacing.one + 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  summaryEmoji: {
    fontSize: 16,
  },
  summaryText: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyHint: {
    color: NS.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  feedback: {
    color: NS.colors.success,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
