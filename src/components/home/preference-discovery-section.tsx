/**
 * Preference Discovery Phase 2 — short preference questions inside the travel plan form.
 * Local draft only: no Supabase / Places / OpenAI wiring.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SelectChip } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { MIN_TOUCH_TARGET } from '@/constants/mobile-layout';
import { Spacing } from '@/constants/theme';
import {
  buildPreferenceProfileFromDraftAnswers,
  getPreferenceChoiceLabel,
  getPreferenceQuestionPrompt,
  isChoiceSelected,
  isQuestionSkipped,
  selectOnboardingPreferenceQuestions,
  upsertPreferenceDraftAnswer,
  type PreferenceDraftAnswers,
} from '@/lib/preference-discovery/preference-onboarding';
import { createEmptyPreferenceProfile } from '@/lib/preference-discovery/preference-profile';
import { safeChipKey, safeText } from '@/lib/safe-text';
import type { PreferenceProfile, PreferenceQuestion } from '@/types/preference-discovery';

type PreferenceDiscoverySectionProps = {
  /** Ordered form purpose chip ids (1–3). */
  selectedPurposeIds: readonly string[];
  /** @deprecated single-id fallback */
  selectedPurposeId?: string | null;
  /** Optional: parent can observe draft profile (not sent to generate-plan in Phase 2). */
  onDraftProfileChange?: (profile: PreferenceProfile) => void;
};

export function PreferenceDiscoverySection({
  selectedPurposeIds,
  selectedPurposeId,
  onDraftProfileChange,
}: PreferenceDiscoverySectionProps) {
  const purposeIds = useMemo(() => {
    if (selectedPurposeIds?.length) return selectedPurposeIds.filter(Boolean);
    if (selectedPurposeId?.trim()) return [selectedPurposeId.trim()];
    return [];
  }, [selectedPurposeIds, selectedPurposeId]);

  const purposeKey = purposeIds.join('|');

  const [answers, setAnswers] = useState<PreferenceDraftAnswers>({});
  const [frozenQuestions, setFrozenQuestions] = useState<PreferenceQuestion[]>([]);
  const [draftProfileId] = useState(() => createEmptyPreferenceProfile().profileId);

  useEffect(() => {
    try {
      const nextQuestions = selectOnboardingPreferenceQuestions(purposeIds, 4);
      setFrozenQuestions(nextQuestions);
    } catch {
      setFrozenQuestions([]);
    }
  }, [purposeKey]);

  const draftProfile = useMemo(() => {
    try {
      return buildPreferenceProfileFromDraftAnswers({
        answers,
        selectedPurposeIds: purposeIds,
        profileId: draftProfileId,
      });
    } catch {
      return createEmptyPreferenceProfile({ profileId: draftProfileId });
    }
  }, [answers, purposeKey, draftProfileId]);

  useEffect(() => {
    onDraftProfileChange?.(draftProfile);
  }, [draftProfile, onDraftProfileChange]);

  if (purposeIds.length === 0 || frozenQuestions.length === 0) {
    return null;
  }

  const handleSelect = (question: PreferenceQuestion, choiceValue: string) => {
    setAnswers((prev) =>
      upsertPreferenceDraftAnswer({
        answers: prev,
        question,
        choiceValue,
        mode: 'select',
      }),
    );
  };

  const handleSkip = (question: PreferenceQuestion) => {
    setAnswers((prev) =>
      upsertPreferenceDraftAnswer({
        answers: prev,
        question,
        choiceValue: null,
        mode: 'skip',
      }),
    );
  };

  return (
    <View style={styles.wrap} accessibilityLabel="preference-discovery-section">
      <Text style={styles.sectionTitle}>あなたの好みを少し教えてください</Text>
      <Text style={styles.sectionHint}>
        回答するほど、あなたに合う候補を選びやすくなります。あとから変更できます。
      </Text>

      {frozenQuestions.map((question, questionIndex) => {
        const answer = answers[question.id];
        const skipped = isQuestionSkipped(answer);
        return (
          <View key={safeChipKey('pref-q', { id: question.id }, questionIndex)} style={styles.questionBlock}>
            <Text style={styles.questionPrompt}>{safeText(getPreferenceQuestionPrompt(question))}</Text>
            <View style={styles.chipGrid}>
              {question.choices.map((choice, choiceIndex) => {
                const label = getPreferenceChoiceLabel(choice);
                const choiceValue =
                  typeof choice.value === 'string' || typeof choice.value === 'number'
                    ? String(choice.value)
                    : choice.id;
                const selected = !skipped && isChoiceSelected(answer, choice.value);
                return (
                  <SelectChip
                    key={safeChipKey(`pref-${question.id}`, { id: choice.id, label }, choiceIndex)}
                    label={safeText(label)}
                    selected={selected}
                    onPress={() => handleSelect(question, choiceValue)}
                    colorIndex={choiceIndex}
                    width="48%"
                  />
                );
              })}
            </View>
            <Pressable
              style={({ pressed }) => [styles.skipChip, skipped && styles.skipChipSelected, pressed && styles.skipPressed]}
              onPress={() => handleSkip(question)}
              accessibilityRole="button"
              accessibilityLabel="おまかせ">
              <Text style={[styles.skipLabel, skipped && styles.skipLabelSelected]}>
                {skipped ? 'おまかせ（選択中）' : 'おまかせ'}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
    width: '100%',
    maxWidth: '100%',
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHint: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: -Spacing.one,
  },
  questionBlock: {
    gap: Spacing.two,
  },
  questionPrompt: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    width: '100%',
  },
  skipChip: {
    alignSelf: 'flex-start',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    backgroundColor: NS.colors.bgElevated,
    justifyContent: 'center',
  },
  skipChipSelected: {
    borderColor: NS.colors.accentBorder,
    backgroundColor: '#F8FBFF',
  },
  skipPressed: {
    opacity: 0.85,
  },
  skipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  skipLabelSelected: {
    color: NS.colors.accent,
    fontWeight: '700',
  },
});
