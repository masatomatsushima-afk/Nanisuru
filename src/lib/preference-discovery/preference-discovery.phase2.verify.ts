/**
 * Preference Discovery Engine Phase 2 — onboarding draft helpers (no react-native).
 * Run via: npm run verify:preference-discovery
 */

import assert from 'node:assert';
import {
  buildPreferenceProfileFromDraftAnswers,
  onboardingSignalId,
  resolveSelectedPreferencePurposes,
  selectOnboardingPreferenceQuestions,
  upsertPreferenceDraftAnswer,
  type PreferenceDraftAnswers,
} from './preference-onboarding';
import { PREFERENCE_QUESTION_REGISTRY } from './preference-question-registry';
import { createEmptyPreferenceProfile, selectNextPreferenceQuestions } from './preference-profile';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

check('gourmet form purpose maps to gourmet and prioritizes gourmet questions', () => {
  assert.deepStrictEqual(resolveSelectedPreferencePurposes('food'), ['gourmet']);
  const questions = selectOnboardingPreferenceQuestions('food', 4);
  assert.ok(questions.length >= 1 && questions.length <= 4);
  assert.ok(questions.some((question) => question.intentIds.includes('gourmet')));
  assert.ok(
    !questions.some(
      (question) =>
        question.intentIds.includes('shopping') && !question.intentIds.includes('gourmet'),
    ),
  );
});

check('shopping form purpose prioritizes shopping questions', () => {
  assert.deepStrictEqual(resolveSelectedPreferencePurposes('shopping'), ['shopping']);
  const questions = selectOnboardingPreferenceQuestions('shopping', 4);
  assert.ok(questions.length >= 1 && questions.length <= 4);
  assert.ok(questions.some((question) => question.intentIds.includes('shopping')));
  assert.ok(
    !questions.some(
      (question) =>
        question.intentIds.includes('gourmet') && !question.intentIds.includes('shopping'),
    ),
  );
});

check('sightseeing (photo) form purpose prioritizes sightseeing questions', () => {
  assert.deepStrictEqual(resolveSelectedPreferencePurposes('photo'), ['sightseeing']);
  const questions = selectOnboardingPreferenceQuestions('photo', 4);
  assert.ok(questions.length >= 1 && questions.length <= 4);
  assert.ok(questions.some((question) => question.intentIds.includes('sightseeing')));
});

check('onboarding question count never exceeds 4', () => {
  for (const purposeId of ['food', 'shopping', 'photo', 'nature', 'night', 'ai'] as const) {
    const questions = selectOnboardingPreferenceQuestions(purposeId, 4);
    assert.ok(questions.length <= 4, `${purposeId} returned ${questions.length}`);
  }
  const raw = selectNextPreferenceQuestions(createEmptyPreferenceProfile(), ['gourmet'], 99);
  assert.ok(raw.length <= 4);
});

check('answering updates PreferenceProfile via applyPreferenceSignal path', () => {
  const question = PREFERENCE_QUESTION_REGISTRY.find((item) => item.id === 'gourmet_local_vs_famous');
  assert.ok(question);
  let answers: PreferenceDraftAnswers = {};
  answers = upsertPreferenceDraftAnswer({
    answers,
    question,
    choiceValue: 'local',
    mode: 'select',
  });
  const profile = buildPreferenceProfileFromDraftAnswers({
    answers,
    selectedPurposeId: 'food',
    profileId: 'draft-1',
  });
  const slot = profile.categoryPreferences.gourmet?.dimensions.local_vs_famous;
  assert.strictEqual(slot?.value, 'local');
  assert.ok((slot?.confidence ?? 0) >= 0.7);
  assert.strictEqual(slot?.source, 'onboarding_question');
  assert.ok(profile.appliedSignalIds.includes(onboardingSignalId(question.id)));
});

check('changing an answer does not double-count signals', () => {
  const question = PREFERENCE_QUESTION_REGISTRY.find((item) => item.id === 'gourmet_local_vs_famous');
  assert.ok(question);
  let answers: PreferenceDraftAnswers = {};
  answers = upsertPreferenceDraftAnswer({
    answers,
    question,
    choiceValue: 'local',
    mode: 'select',
  });
  answers = upsertPreferenceDraftAnswer({
    answers,
    question,
    choiceValue: 'famous',
    mode: 'select',
  });
  const profile = buildPreferenceProfileFromDraftAnswers({
    answers,
    selectedPurposeId: 'food',
    profileId: 'draft-2',
  });
  const slot = profile.categoryPreferences.gourmet?.dimensions.local_vs_famous;
  assert.strictEqual(slot?.value, 'famous');
  assert.strictEqual(
    profile.appliedSignalIds.filter((id) => id === onboardingSignalId(question.id)).length,
    1,
  );
  // Rebuild again with same answers — still a single applied signal id.
  const again = buildPreferenceProfileFromDraftAnswers({
    answers,
    selectedPurposeId: 'food',
    profileId: 'draft-2',
  });
  assert.strictEqual(
    again.appliedSignalIds.filter((id) => id === onboardingSignalId(question.id)).length,
    1,
  );
  assert.strictEqual(again.categoryPreferences.gourmet?.dimensions.local_vs_famous?.value, 'famous');
});

check('skip keeps dimension unknown (not 0/false)', () => {
  const question = PREFERENCE_QUESTION_REGISTRY.find((item) => item.id === 'gourmet_casual_vs_luxury');
  assert.ok(question);
  let answers: PreferenceDraftAnswers = {};
  answers = upsertPreferenceDraftAnswer({
    answers,
    question,
    choiceValue: null,
    mode: 'skip',
  });
  const profile = buildPreferenceProfileFromDraftAnswers({
    answers,
    selectedPurposeId: 'food',
    profileId: 'draft-skip',
  });
  assert.strictEqual(
    profile.categoryPreferences.gourmet?.dimensions.casual_vs_luxury,
    undefined,
  );
  assert.deepStrictEqual(profile.appliedSignalIds, []);
});

check('empty preference draft still builds a safe profile (form can submit)', () => {
  const profile = buildPreferenceProfileFromDraftAnswers({
    answers: {},
    selectedPurposeId: 'food',
    profileId: 'draft-empty',
  });
  assert.strictEqual(profile.profileId, 'draft-empty');
  assert.deepStrictEqual(profile.categoryPreferences, {});
  assert.deepStrictEqual(profile.universal.dimensions, {});
  assert.deepStrictEqual(profile.travelIntents.map((item) => item.intentId), ['gourmet']);
});

check('selectOnboardingPreferenceQuestions never throws on bad purpose', () => {
  assert.doesNotThrow(() => selectOnboardingPreferenceQuestions(null));
  assert.doesNotThrow(() => selectOnboardingPreferenceQuestions('unknown-purpose'));
  assert.deepStrictEqual(selectOnboardingPreferenceQuestions(null), []);
});

console.log(`\n[preference-discovery.phase2.verify] ${passed} checks passed.`);
