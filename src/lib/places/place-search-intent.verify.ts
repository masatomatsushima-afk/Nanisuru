/**
 * PlaceSearchIntent 生成の単体検証（Node.js / tsx で直接実行可能・外部通信なし）。
 * `npm run verify:place-search-intent` から実行する。
 */

import assert from 'node:assert';
import { buildPlaceSearchIntents, MAX_SEARCH_INTENTS } from './place-search-intent';
import { TRIP_DNA_PROFILES, DEFAULT_TRIP_DNA_PROFILE } from '@/lib/trip-dna/trip-dna-profiles';

const DESTINATION = { destinationLabel: 'Seoul, South Korea', city: 'Seoul', country: 'South Korea', baseArea: '明洞' };

function findDna(id: string) {
  const dna = TRIP_DNA_PROFILES.find((profile) => profile.id === id);
  if (!dna) throw new Error(`missing DNA: ${id}`);
  return dna;
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

check('gourmet DNA produces multiple distinct food-slot intents (not just 1)', () => {
  const intents = buildPlaceSearchIntents(findDna('gourmet'), DESTINATION);
  assert.ok(intents.length >= 4, `expected several intents, got ${intents.length}`);
  const foodIntents = intents.filter((intent) => intent.category === 'food');
  assert.ok(foodIntents.length >= 2, 'gourmet should search food across multiple time slots (breakfast/lunch/dinner)');
  const queries = new Set(foodIntents.map((intent) => intent.query));
  assert.ok(queries.size >= 2, 'different food slots should use different, meal-specific query text');
  assert.ok(intents.some((intent) => intent.category === 'cafe'), 'gourmet should also search cafe');
});

check('sightseeing DNA is dominated by sightseeing intents, not food', () => {
  const intents = buildPlaceSearchIntents(findDna('sightseeing'), DESTINATION);
  const sightseeingCount = intents.filter((intent) => intent.category === 'sightseeing').length;
  const foodCount = intents.filter((intent) => intent.category === 'food').length;
  assert.ok(sightseeingCount >= foodCount, 'sightseeing DNA should not be food-dominated');
  assert.ok(sightseeingCount >= 2, 'sightseeing should be searched across multiple slots');
});

check('shopping DNA includes shopping intents', () => {
  const intents = buildPlaceSearchIntents(findDna('shopping'), DESTINATION);
  assert.ok(intents.some((intent) => intent.category === 'shopping'), 'shopping DNA must search shopping category');
});

check('forbidden categories never produce a search intent', () => {
  const family = findDna('family');
  const intents = buildPlaceSearchIntents(family, DESTINATION);
  assert.ok(!intents.some((intent) => family.forbiddenCategories.includes(intent.category)));
});

check('same slot+category combination is never duplicated', () => {
  for (const dna of TRIP_DNA_PROFILES) {
    const intents = buildPlaceSearchIntents(dna, DESTINATION);
    const keys = intents.map((intent) => `${intent.timeSlot}:${intent.category}`);
    assert.strictEqual(keys.length, new Set(keys).size, `duplicate slot+category intent for DNA "${dna.id}"`);
  }
});

check('intent count never exceeds MAX_SEARCH_INTENTS for any DNA', () => {
  for (const dna of [...TRIP_DNA_PROFILES, DEFAULT_TRIP_DNA_PROFILE]) {
    const intents = buildPlaceSearchIntents(dna, DESTINATION);
    assert.ok(intents.length <= MAX_SEARCH_INTENTS, `DNA "${dna.id}" produced ${intents.length} intents (> ${MAX_SEARCH_INTENTS})`);
  }
});

check('DEFAULT_TRIP_DNA_PROFILE (no personality/companion/mood match) still produces a balanced, non-empty intent set', () => {
  const intents = buildPlaceSearchIntents(DEFAULT_TRIP_DNA_PROFILE, DESTINATION);
  assert.ok(intents.length >= 3, 'default profile should still search several categories');
  const categories = new Set(intents.map((intent) => intent.category));
  assert.ok(categories.size >= 2, 'default profile should not be single-category only');
});

check('per-slot category order (not global categoryPriority) decides the category — cafe is not starved by food', () => {
  const gourmet = findDna('gourmet');
  const intents = buildPlaceSearchIntents(gourmet, DESTINATION);
  const afternoonCategories = intents.filter((intent) => intent.timeSlot === 'afternoon').map((intent) => intent.category);
  assert.ok(afternoonCategories.includes('cafe'), 'afternoon rule lists cafe first — it must not be crowded out by food');
});

check('every intent carries the destination fields through unchanged (no invented destination)', () => {
  const intents = buildPlaceSearchIntents(findDna('gourmet'), DESTINATION);
  for (const intent of intents) {
    assert.strictEqual(intent.destinationLabel, DESTINATION.destinationLabel);
    assert.strictEqual(intent.city, DESTINATION.city);
    assert.strictEqual(intent.country, DESTINATION.country);
    assert.strictEqual(intent.baseArea, DESTINATION.baseArea);
    assert.ok(intent.desiredCount > 0);
    assert.strictEqual(intent.requiredSpecificPlace, true);
  }
});

console.log(`\n[place-search-intent.verify] ${passed} checks passed.`);
