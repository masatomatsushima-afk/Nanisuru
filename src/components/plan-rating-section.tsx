import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { SuccessOverlay } from '@/components/success-overlay';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { useAuth } from '@/contexts/auth-context';
import { savePlanRating } from '@/lib/plan-rating';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { PlanFeedbackTag, PlanRatingContext } from '@/types/plan-rating';
import { PLAN_FEEDBACK_TAGS } from '@/types/plan-rating';

type PlanRatingSectionProps = {
  context: PlanRatingContext;
  savedTripId?: string | null;
  onRated?: (ratingId: string) => void;
};

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <Pressable
            key={star}
            style={({ pressed }) => [
              styles.starButton,
              pressed && !disabled && styles.starButtonPressed,
            ]}
            onPress={() => onChange(star)}
            disabled={disabled}>
            <Text style={[styles.star, filled ? styles.starFilled : styles.starEmpty]}>
              {filled ? '★' : '☆'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FeedbackChip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: PlanFeedbackTag;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !disabled && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function PlanRatingSection({
  context,
  savedTripId,
  onRated,
}: PlanRatingSectionProps) {
  const { session, isConfigured } = useAuth();
  const [stars, setStars] = useState(0);
  const [selectedTags, setSelectedTags] = useState<PlanFeedbackTag[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const toggleTag = (tag: PlanFeedbackTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = async () => {
    if (stars === 0) {
      Alert.alert('星を選んでください', '1〜5の星で評価してください。');
      return;
    }

    if (!isConfigured) {
      Alert.alert(
        'Supabase未設定',
        '.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定してください。',
      );
      return;
    }

    if (!session) {
      Alert.alert('ログインが必要です', '評価を保存するにはログインしてください。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ログイン', onPress: () => router.push('/login') },
      ]);
      return;
    }

    if (isSubmitting || isSubmitted) return;

    setIsSubmitting(true);
    try {
      const rating = await savePlanRating({
        stars,
        feedbackTags: selectedTags,
        context,
        tripId: savedTripId ?? null,
      });
      setIsSubmitted(true);
      setShowSuccess(true);
      onRated?.(rating.id);
      setTimeout(() => setShowSuccess(false), 1600);
    } catch (error) {
      const message = error instanceof Error ? error.message : '評価の送信に失敗しました';
      Alert.alert('送信エラー', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SuccessOverlay visible={showSuccess} message="評価ありがとうございます！" />
      <PremiumCard style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.icon}>💬</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>このプランどうだった？</Text>
            <Text style={styles.subtitle}>
              評価は次回のプラン作成に反映されます
            </Text>
          </View>
        </View>

        <StarRating value={stars} onChange={setStars} disabled={isSubmitted} />

        <Text style={styles.feedbackLabel}>クイックフィードバック（任意・複数選択可）</Text>
        <View style={styles.chipGrid}>
          {PLAN_FEEDBACK_TAGS.map((tag) => (
            <FeedbackChip
              key={tag}
              label={tag}
              selected={selectedTags.includes(tag)}
              onPress={() => toggleTag(tag)}
              disabled={isSubmitted}
            />
          ))}
        </View>

        {savedTripId ? (
          <Text style={styles.linkedNote}>保存済みプランに紐づけて記録されます</Text>
        ) : (
          <Text style={styles.linkedNote}>
            プランを保存すると、評価と保存プランが紐づきます
          </Text>
        )}

        {isSubmitted ? (
          <View style={styles.thankYouBox}>
            <Text style={styles.thankYouText}>
              フィードバックを旅行メモリーに反映しました ✨
            </Text>
          </View>
        ) : (
          <PrimaryButton
            label={isSubmitting ? '送信中...' : '評価を送信'}
            onPress={handleSubmit}
            disabled={isSubmitting || stars === 0}
            variant="secondary"
          />
        )}
      </PremiumCard>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  icon: {
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
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  starButton: {
    padding: Spacing.one,
  },
  starButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  star: {
    fontSize: 36,
    lineHeight: 40,
  },
  starFilled: {
    color: '#FBBF24',
  },
  starEmpty: {
    color: NS.colors.textMuted,
  },
  feedbackLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  chip: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  chipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: NS.colors.accent,
  },
  linkedNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  thankYouBox: {
    backgroundColor: NS.colors.successSoft,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    padding: Spacing.three,
    alignItems: 'center',
  },
  thankYouText: {
    color: NS.colors.success,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
});
