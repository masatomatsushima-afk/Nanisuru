/**
 * Multi-select travel purposes + Trip DNA / Preference question blending verify.
 * Run via: npm run verify:selected-purposes
 */

import assert from 'node:assert';
import {
  MAX_SELECTED_PURPOSES,
  buildSelectedPurposes,
  buildSelectedPurposesFromSheetIds,
  selectedPurposeWeightsSumToOne,
  toggleSheetPurposeSelection,
} from './selected-purposes';
import { blendPurposeProfiles } from './purpose-profiles';
import { blendTripDnaProfiles } from './trip-dna/trip-dna-engine';
import {
  createEmptyPreferenceProfile,
  selectNextPreferenceQuestions,
} from './preference-discovery/preference-profile';
import { selectOnboardingPreferenceQuestions } from './preference-discovery/preference-onboarding';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

check('can select 1, 2, and 3 purposes with normalized weights', () => {
  const one = buildSelectedPurposes(['gourmet']);
  assert.strictEqual(one.length, 1);
  assert.strictEqual(one[0].priority, 1);
  assert.ok(selectedPurposeWeightsSumToOne(one));
  assert.ok(Math.abs(one[0].weight - 1) < 1e-9);

  const two = buildSelectedPurposes(['gourmet', 'shopping']);
  assert.strictEqual(two.length, 2);
  assert.ok(selectedPurposeWeightsSumToOne(two));
  assert.ok(Math.abs(two[0].weight - 0.65) < 1e-9);
  assert.ok(Math.abs(two[1].weight - 0.35) < 1e-9);

  const three = buildSelectedPurposes(['gourmet', 'shopping', 'sightseeing']);
  assert.strictEqual(three.length, 3);
  assert.ok(selectedPurposeWeightsSumToOne(three));
  assert.ok(Math.abs(three[0].weight - 0.55) < 1e-9);
  assert.ok(Math.abs(three[1].weight - 0.3) < 1e-9);
  assert.ok(Math.abs(three[2].weight - 0.15) < 1e-9);
});

check('4th purpose is rejected and selection stays at max 3', () => {
  let state = toggleSheetPurposeSelection([], 'food');
  state = toggleSheetPurposeSelection(state.sheetIds, 'shopping');
  state = toggleSheetPurposeSelection(state.sheetIds, 'photo');
  assert.strictEqual(state.sheetIds.length, 3);
  assert.strictEqual(state.rejectedMax, false);

  const rejected = toggleSheetPurposeSelection(state.sheetIds, 'nature');
  assert.strictEqual(rejected.rejectedMax, true);
  assert.strictEqual(rejected.sheetIds.length, MAX_SELECTED_PURPOSES);
  assert.ok(!rejected.sheetIds.includes('nature'));
});

check('deselect recalculates priority and weight', () => {
  let state = toggleSheetPurposeSelection([], 'food');
  state = toggleSheetPurposeSelection(state.sheetIds, 'shopping');
  state = toggleSheetPurposeSelection(state.sheetIds, 'photo');
  // Remove primary (food)
  state = toggleSheetPurposeSelection(state.sheetIds, 'food');
  assert.deepStrictEqual(state.sheetIds, ['shopping', 'photo']);
  assert.strictEqual(state.selected[0].purpose, 'shopping');
  assert.strictEqual(state.selected[0].priority, 1);
  assert.ok(Math.abs(state.selected[0].weight - 0.65) < 1e-9);
  assert.ok(selectedPurposeWeightsSumToOne(state.selected));
});

check('preference questions stay at max 4 and mix across purposes', () => {
  const selected = buildSelectedPurposesFromSheetIds(['food', 'shopping', 'photo']);
  const questions = selectNextPreferenceQuestions(
    createEmptyPreferenceProfile(),
    selected,
    4,
  );
  assert.ok(questions.length <= 4, `got ${questions.length}`);
  assert.ok(questions.length >= 2);

  const scopes = new Set(
    questions.flatMap((question) =>
      question.intentIds.filter((id) => id !== 'universal'),
    ),
  );
  // At least two distinct purpose scopes when three purposes are selected.
  assert.ok(scopes.size >= 2, `expected mixed purposes, got ${[...scopes].join(',')}`);

  const onboarding = selectOnboardingPreferenceQuestions(['food', 'shopping'], 4);
  assert.ok(onboarding.length <= 4);
});

check('single purpose selection still works (backward compatible)', () => {
  const selected = buildSelectedPurposesFromSheetIds(['food']);
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].purpose, 'gourmet');

  const questions = selectOnboardingPreferenceQuestions('food', 4);
  assert.ok(questions.length >= 1 && questions.length <= 4);
  assert.ok(questions.some((question) => question.intentIds.includes('gourmet')));

  const dna = blendTripDnaProfiles(selected);
  assert.ok(dna);
  assert.strictEqual(dna?.id, 'gourmet');

  const purpose = blendPurposeProfiles(selected);
  assert.ok(purpose);
  assert.strictEqual(purpose?.id, 'gourmet');
});

check('Trip DNA blend favors primary but keeps secondary signal', () => {
  const selected = buildSelectedPurposes(['gourmet', 'shopping']);
  const blended = blendTripDnaProfiles(selected);
  assert.ok(blended);
  assert.strictEqual(blended?.dominantCategory, 'food');
  // Secondary shopping remains visible in the mix.
  assert.ok((blended?.activityWeights.shopping ?? 0) > 0.1);
  assert.ok((blended?.activityWeights.food ?? 0) > 0.15);
  // Primary drives category priority head.
  assert.strictEqual(blended?.categoryPriority[0], 'food');
});

console.log(`\n[selected-purposes.verify] ${passed} checks passed.`);
