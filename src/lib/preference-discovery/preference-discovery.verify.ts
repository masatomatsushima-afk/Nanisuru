/**
 * Preference Discovery Engine Phase 1 — Node/tsx verify (no react-native).
 * Run: npm run verify:preference-discovery
 */

import assert from 'node:assert';
import {
  applyPreferenceSignal,
  createEmptyPreferenceProfile,
  normalizePreferenceProfile,
  selectNextPreferenceQuestions,
  validatePreferenceProfile,
} from './preference-profile';
import type { PreferenceSignal } from '@/types/preference-discovery';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

check('createEmptyPreferenceProfile leaves dimensions unset (not 0/false)', () => {
  const profile = createEmptyPreferenceProfile({ profileId: 'test-empty' });
  assert.strictEqual(profile.profileId, 'test-empty');
  assert.deepStrictEqual(profile.categoryPreferences, {});
  assert.deepStrictEqual(profile.universal.dimensions, {});
  assert.deepStrictEqual(profile.appliedSignalIds, []);
  assert.strictEqual(Object.keys(profile.universal.dimensions).length, 0);
});

check('explicit onboarding answer updates value and confidence strongly', () => {
  const empty = createEmptyPreferenceProfile({ profileId: 'p1' });
  const signal: PreferenceSignal = {
    id: 'sig-explicit-1',
    source: 'onboarding_question',
    scope: 'gourmet',
    dimensionId: 'local_vs_famous',
    value: 'local',
  };
  const next = applyPreferenceSignal(empty, signal);
  const slot = next.categoryPreferences.gourmet?.dimensions.local_vs_famous;
  assert.ok(slot);
  assert.strictEqual(slot.value, 'local');
  assert.ok(slot.confidence >= 0.7, `confidence too low: ${slot.confidence}`);
  assert.strictEqual(slot.source, 'onboarding_question');
  assert.ok(next.appliedSignalIds.includes('sig-explicit-1'));
  // Immutability
  assert.strictEqual(empty.categoryPreferences.gourmet, undefined);
});

check('opened_maps once does not strongly assert a preference', () => {
  const empty = createEmptyPreferenceProfile({ profileId: 'p2' });
  const next = applyPreferenceSignal(empty, {
    id: 'maps-1',
    source: 'opened_maps',
    scope: 'gourmet',
    dimensionId: 'local_vs_famous',
    value: 'famous',
  });
  const slot = next.categoryPreferences.gourmet?.dimensions.local_vs_famous;
  assert.ok(slot);
  // Soft learning: first weak signal should keep confidence low and may not adopt value yet.
  assert.ok(slot.confidence < 0.25, `maps once confidence too high: ${slot.confidence}`);
  assert.notStrictEqual(slot.value, 'famous');
});

check('repeating the same weak behavior gradually raises confidence and can adopt value', () => {
  let profile = createEmptyPreferenceProfile({ profileId: 'p3' });
  for (let i = 1; i <= 5; i += 1) {
    profile = applyPreferenceSignal(profile, {
      id: `maps-repeat-${i}`,
      source: 'opened_maps',
      scope: 'gourmet',
      dimensionId: 'local_vs_famous',
      value: 'famous',
    });
  }
  const slot = profile.categoryPreferences.gourmet?.dimensions.local_vs_famous;
  assert.ok(slot);
  assert.ok((slot.evidenceCount ?? 0) >= 5);
  assert.ok(slot.confidence > 0.05, `confidence did not rise: ${slot.confidence}`);
  // Still far below explicit answers
  assert.ok(slot.confidence < 0.5, `weak signals became too strong: ${slot.confidence}`);
  // After enough soft evidence, value may be adopted
  assert.strictEqual(slot.value, 'famous');
});

check('confidence and numeric values stay in safe ranges', () => {
  const dirty = normalizePreferenceProfile({
    profileId: 'dirty',
    schemaVersion: 1,
    travelIntents: [],
    categoryPreferences: {
      gourmet: {
        intentId: 'gourmet',
        dimensions: {
          local_vs_famous: {
            value: Number.NaN,
            confidence: 9,
            source: 'weird_unknown_source',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      },
    },
    universal: {
      dimensions: {
        pace: {
          value: 'relaxed',
          confidence: -3,
          source: 'onboarding_question',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    },
    appliedSignalIds: ['a', 'a', 1, null],
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.ok(dirty.universal.dimensions.pace.confidence >= 0);
  assert.ok(dirty.universal.dimensions.pace.confidence <= 1);
  const gourmetSlot = dirty.categoryPreferences.gourmet.dimensions.local_vs_famous;
  assert.ok(gourmetSlot.confidence <= 1);
  assert.strictEqual(gourmetSlot.value, undefined);
  assert.deepStrictEqual(dirty.appliedSignalIds, ['a']);

  const validation = validatePreferenceProfile(dirty);
  assert.strictEqual(validation.ok, true);
});

check('incomplete / malformed signals never crash and can be idempotent', () => {
  const empty = createEmptyPreferenceProfile({ profileId: 'p4' });
  assert.doesNotThrow(() => applyPreferenceSignal(empty, null as never));
  assert.doesNotThrow(() =>
    applyPreferenceSignal(empty, { id: '', source: 'opened_maps' } as never),
  );
  const once = applyPreferenceSignal(empty, {
    id: 'dup-1',
    source: 'saved_place',
    scope: 'shopping',
    dimensionId: 'shopping_focus',
    value: 'souvenirs',
  });
  const twice = applyPreferenceSignal(once, {
    id: 'dup-1',
    source: 'saved_place',
    scope: 'shopping',
    dimensionId: 'shopping_focus',
    value: 'luxury',
  });
  assert.strictEqual(
    twice.categoryPreferences.shopping?.dimensions.shopping_focus?.value,
    once.categoryPreferences.shopping?.dimensions.shopping_focus?.value,
  );
  assert.strictEqual(twice.appliedSignalIds.filter((id) => id === 'dup-1').length, 1);
});

check('selectNextPreferenceQuestions never returns more than 4', () => {
  const profile = createEmptyPreferenceProfile();
  const questions = selectNextPreferenceQuestions(profile, ['gourmet', 'shopping', 'sightseeing'], 99);
  assert.ok(questions.length <= 4, `got ${questions.length}`);
});

check('gourmet selection prioritizes gourmet-related questions', () => {
  const profile = createEmptyPreferenceProfile();
  const questions = selectNextPreferenceQuestions(profile, ['gourmet'], 4);
  assert.ok(questions.length >= 1);
  assert.ok(
    questions.every(
      (question) =>
        question.intentIds.includes('gourmet') || question.intentIds.includes('universal'),
    ),
  );
  assert.ok(
    questions.some((question) => question.intentIds.includes('gourmet')),
    'expected at least one gourmet-scoped question',
  );
  assert.ok(
    !questions.some((question) => question.intentIds.includes('shopping') && !question.intentIds.includes('gourmet')),
    'shopping-only questions should not lead for gourmet',
  );
});

check('shopping selection prioritizes shopping-related questions', () => {
  const profile = createEmptyPreferenceProfile();
  const questions = selectNextPreferenceQuestions(profile, ['shopping'], 4);
  assert.ok(questions.length >= 1);
  assert.ok(questions.some((question) => question.intentIds.includes('shopping')));
  assert.ok(
    !questions.some(
      (question) => question.intentIds.includes('gourmet') && !question.intentIds.includes('shopping'),
    ),
  );
});

check('explicit preference is not overwritten by a single weak inferred signal', () => {
  let profile = createEmptyPreferenceProfile({ profileId: 'p5' });
  profile = applyPreferenceSignal(profile, {
    id: 'explicit-local',
    source: 'explicit_selection',
    scope: 'gourmet',
    dimensionId: 'local_vs_famous',
    value: 'local',
  });
  profile = applyPreferenceSignal(profile, {
    id: 'weak-famous',
    source: 'opened_maps',
    scope: 'gourmet',
    dimensionId: 'local_vs_famous',
    value: 'famous',
  });
  const slot = profile.categoryPreferences.gourmet?.dimensions.local_vs_famous;
  assert.strictEqual(slot?.value, 'local');
  assert.ok((slot?.confidence ?? 0) >= 0.6);
});

console.log(`\n[preference-discovery.verify] ${passed} checks passed.`);
