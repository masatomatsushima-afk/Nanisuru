/**
 * Preference Discovery Phase 2 — form onboarding helpers (pure, no persistence).
 *
 * Trip DNA / Purpose Profile = journey skeleton.
 * Preference Profile (draft here) = individual taste for this form session only.
 */

import type {
  PreferenceDimensionValue,
  PreferenceProfile,
  PreferenceQuestion,
  PreferenceSignal,
  TravelIntentId,
  TravelIntentPreference,
} from '@/types/preference-discovery';
import {
  applyPreferenceSignal,
  createEmptyPreferenceProfile,
  selectNextPreferenceQuestions,
} from './preference-profile';
import { PREFERENCE_QUESTION_REGISTRY } from './preference-question-registry';
import {
  buildSelectedPurposesFromSheetIds,
  resolveCanonicalPurposeFromSheetId,
  type SelectedPurpose,
} from '@/lib/selected-purposes';

/** Form purpose chip id → preference intent ids (config map, not purpose if-trees). */
export const TRAVEL_PURPOSE_TO_PREFERENCE_INTENTS: Readonly<
  Record<string, readonly TravelIntentId[]>
> = {
  food: ['gourmet'],
  shopping: ['shopping'],
  photo: ['sightseeing'],
  nature: ['nature'],
  night: ['nightlife'],
  ai: [],
  // Canonical ids (when callers already mapped)
  gourmet: ['gourmet'],
  sightseeing: ['sightseeing'],
  nightlife: ['nightlife'],
};

export type PreferenceDraftAnswer = {
  questionId: string;
  value: PreferenceDimensionValue;
  /** 'skipped' means user chose おまかせ — dimension stays unknown. */
  status: 'answered' | 'skipped';
};

export type PreferenceDraftAnswers = Record<string, PreferenceDraftAnswer>;

/** Stable signal id per question so rebuilds stay idempotent within one rebuild pass. */
export function onboardingSignalId(questionId: string): string {
  return `onboarding:${questionId.trim()}`;
}

function intentsForSheetOrCanonicalId(id: string): TravelIntentId[] {
  const trimmed = id.trim();
  if (!trimmed || trimmed === 'ai') return [];
  const fromSheet = TRAVEL_PURPOSE_TO_PREFERENCE_INTENTS[trimmed];
  if (fromSheet) return [...fromSheet];
  const canonical = resolveCanonicalPurposeFromSheetId(trimmed) ?? trimmed;
  const fromCanonical = TRAVEL_PURPOSE_TO_PREFERENCE_INTENTS[canonical];
  if (fromCanonical) return [...fromCanonical];
  return [canonical as TravelIntentId];
}

/** @deprecated Prefer resolvePreferenceIntentsForSheetIds — kept for single-id callers. */
export function resolvePreferenceIntentsForPurpose(
  selectedPurposeId: string | null | undefined,
): TravelIntentPreference[] {
  if (!selectedPurposeId?.trim()) return [];
  return resolvePreferenceIntentsForSheetIds([selectedPurposeId]);
}

export function resolvePreferenceIntentsForSheetIds(
  sheetPurposeIds: readonly string[],
): TravelIntentPreference[] {
  const intents: TravelIntentPreference[] = [];
  const seen = new Set<string>();
  for (const sheetId of sheetPurposeIds) {
    for (const intentId of intentsForSheetOrCanonicalId(sheetId)) {
      if (seen.has(intentId)) continue;
      seen.add(intentId);
      if (intents.length >= 3) break;
      intents.push({
        intentId,
        priority: (intents.length + 1) as 1 | 2 | 3,
      });
    }
    if (intents.length >= 3) break;
  }
  return intents;
}

export function resolveSelectedPreferencePurposes(
  selectedPurposeId: string | null | undefined,
): string[] {
  return resolvePreferenceIntentsForPurpose(selectedPurposeId).map((item) => item.intentId);
}

export function resolveSelectedPurposesForSheetIds(
  sheetPurposeIds: readonly string[],
): SelectedPurpose[] {
  return buildSelectedPurposesFromSheetIds(sheetPurposeIds);
}

/**
 * Pick 2–4 onboarding questions.
 * Accepts one sheet id (legacy) or ordered multi sheet ids.
 */
export function selectOnboardingPreferenceQuestions(
  selectedPurposeIdOrIds: string | null | undefined | readonly string[],
  limit = 4,
  registry: readonly PreferenceQuestion[] = PREFERENCE_QUESTION_REGISTRY,
): PreferenceQuestion[] {
  try {
    let sheetIds: string[] = [];
    if (Array.isArray(selectedPurposeIdOrIds)) {
      sheetIds = selectedPurposeIdOrIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()));
    } else if (typeof selectedPurposeIdOrIds === 'string' && selectedPurposeIdOrIds.trim()) {
      sheetIds = [selectedPurposeIdOrIds.trim()];
    }
    if (sheetIds.length === 0) return [];

    const travelIntents = resolvePreferenceIntentsForSheetIds(sheetIds);
    const weighted = resolveSelectedPurposesForSheetIds(sheetIds);
    const purposesForSelect =
      weighted.length > 0
        ? weighted
        : travelIntents.map((intent) => ({
            purpose: intent.intentId,
            priority: intent.priority,
            weight: 1 / Math.max(1, travelIntents.length),
          }));

    const empty = createEmptyPreferenceProfile({ travelIntents });
    return selectNextPreferenceQuestions(empty, purposesForSelect, limit, registry);
  } catch {
    return [];
  }
}

export function getPreferenceQuestionPrompt(question: PreferenceQuestion): string {
  const prompt = question.prompt?.trim();
  if (prompt) return prompt;
  return question.promptKey?.trim() || 'あなたの好みを教えてください';
}

export function getPreferenceChoiceLabel(
  choice: PreferenceQuestion['choices'][number],
): string {
  const label = choice.label?.trim();
  if (label) return label;
  return choice.labelKey?.trim() || choice.id;
}

function findQuestion(
  questionId: string,
  registry: readonly PreferenceQuestion[],
): PreferenceQuestion | undefined {
  return registry.find((item) => item.id === questionId);
}

/**
 * Rebuild draft profile from scratch + current answers.
 * Prevents double-counting when the user changes an answer:
 * each rebuild starts from empty and applies one signal per answered question.
 */
export function buildPreferenceProfileFromDraftAnswers(input: {
  answers: PreferenceDraftAnswers;
  selectedPurposeId?: string | null;
  selectedPurposeIds?: readonly string[];
  profileId?: string;
  registry?: readonly PreferenceQuestion[];
}): PreferenceProfile {
  const registry = input.registry ?? PREFERENCE_QUESTION_REGISTRY;
  const sheetIds =
    input.selectedPurposeIds ??
    (input.selectedPurposeId?.trim() ? [input.selectedPurposeId.trim()] : []);
  const travelIntents = resolvePreferenceIntentsForSheetIds(sheetIds);
  let profile = createEmptyPreferenceProfile({
    profileId: input.profileId,
    travelIntents,
  });

  const answerList = Object.values(input.answers ?? {});
  for (const answer of answerList) {
    if (!answer || answer.status !== 'answered') continue;
    const question = findQuestion(answer.questionId, registry);
    if (!question) continue;
    if (answer.value === undefined || answer.value === null) continue;
    if (Array.isArray(answer.value) && answer.value.length === 0) continue;

    const signal: PreferenceSignal = {
      id: onboardingSignalId(question.id),
      source: 'onboarding_question',
      scope: question.scope,
      dimensionId: question.dimensionId,
      value: answer.value,
    };
    profile = applyPreferenceSignal(profile, signal);
  }

  return profile;
}

/**
 * Toggle / set a chip answer for one question (pure).
 * Single-select replaces; multi-select toggles membership in a string[].
 * Passing null clears to unknown (not 0/false).
 */
export function upsertPreferenceDraftAnswer(input: {
  answers: PreferenceDraftAnswers;
  question: PreferenceQuestion;
  choiceValue: PreferenceDimensionValue | null;
  mode: 'select' | 'skip' | 'clear';
}): PreferenceDraftAnswers {
  const next: PreferenceDraftAnswers = { ...input.answers };
  const questionId = input.question.id;

  if (input.mode === 'skip') {
    next[questionId] = {
      questionId,
      value: undefined,
      status: 'skipped',
    };
    return next;
  }

  if (input.mode === 'clear' || input.choiceValue === null || input.choiceValue === undefined) {
    delete next[questionId];
    return next;
  }

  if (input.question.multiSelect) {
    const previous = next[questionId];
    const previousValues =
      previous?.status === 'answered' && Array.isArray(previous.value)
        ? previous.value.filter((item): item is string => typeof item === 'string')
        : [];
    const choice =
      typeof input.choiceValue === 'string' ? input.choiceValue : String(input.choiceValue);
    const exists = previousValues.includes(choice);
    const merged = exists
      ? previousValues.filter((item) => item !== choice)
      : [...previousValues, choice];

    if (merged.length === 0) {
      delete next[questionId];
      return next;
    }

    next[questionId] = {
      questionId,
      value: merged,
      status: 'answered',
    };
    return next;
  }

  // Single select: tapping the same chip again clears (optional, non-required).
  const previous = next[questionId];
  if (
    previous?.status === 'answered' &&
    !Array.isArray(previous.value) &&
    previous.value === input.choiceValue
  ) {
    delete next[questionId];
    return next;
  }

  next[questionId] = {
    questionId,
    value: input.choiceValue,
    status: 'answered',
  };
  return next;
}

export function isChoiceSelected(
  answer: PreferenceDraftAnswer | undefined,
  choiceValue: PreferenceDimensionValue,
): boolean {
  if (!answer || answer.status !== 'answered') return false;
  if (Array.isArray(answer.value)) {
    return typeof choiceValue === 'string' && answer.value.includes(choiceValue);
  }
  return answer.value === choiceValue;
}

export function isQuestionSkipped(answer: PreferenceDraftAnswer | undefined): boolean {
  return answer?.status === 'skipped';
}
