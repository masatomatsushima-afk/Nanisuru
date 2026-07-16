/**
 * Trip DNA Engine の単体検証（Node.js / tsx で直接実行可能・外部通信なし）。
 * `npm run verify:trip-dna-engine` から実行する。
 */

import assert from 'node:assert';
import {
  buildDnaPromptGuidance,
  getPlacesSearchCategories,
  getTimeOfDaySlot,
  rankCandidatesByDna,
  resolveFallbackCategories,
  resolveTripDna,
  validateItineraryAgainstDna,
} from './trip-dna-engine';
import { TRIP_DNA_PROFILES } from './trip-dna-profiles';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { PlaceCandidate } from '@/types/place-candidate';

function item(overrides: Partial<ItineraryItem>): ItineraryItem {
  return { time: '10:00', activity: '未設定アイテム', ...overrides };
}

function day(items: ItineraryItem[]): ItineraryDay {
  return { dayNumber: 1, label: '1日目', theme: 'テスト', items };
}

function candidate(overrides: Partial<PlaceCandidate>): PlaceCandidate {
  return { placeId: 'place-x', placeName: '候補店', source: 'google_places', ...overrides };
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

check('all 9 required DNA ids are present', () => {
  const ids = TRIP_DNA_PROFILES.map((profile) => profile.id);
  for (const expected of ['gourmet', 'sightseeing', 'shopping', 'couple', 'family', 'solo', 'relax', 'adventure', 'nightlife']) {
    assert.ok(ids.includes(expected), `missing DNA: ${expected}`);
  }
});

check('resolveTripDna matches personality/companion/keyword, null when unmatched', () => {
  assert.strictEqual(resolveTripDna({ personality: 'グルメ' })?.id, 'gourmet');
  assert.strictEqual(resolveTripDna({ companion: '家族' })?.id, 'family');
  assert.strictEqual(resolveTripDna({ companion: 'カップル' })?.id, 'couple');
  assert.strictEqual(resolveTripDna({ personality: '冒険家' })?.id, 'adventure');
  assert.strictEqual(resolveTripDna({ mood: 'ナイトライフを楽しみたい' })?.id, 'nightlife');
  assert.strictEqual(resolveTripDna({ personality: '穴場好き', companion: '友達', mood: '普通の旅行' }), null);
});

check('getPlacesSearchCategories returns dna.placesCategories', () => {
  const gourmet = TRIP_DNA_PROFILES.find((profile) => profile.id === 'gourmet')!;
  assert.deepStrictEqual(getPlacesSearchCategories(gourmet), gourmet.placesCategories);
});

check('rankCandidatesByDna excludes forbidden categories and prioritizes dominant category', () => {
  const sightseeing = TRIP_DNA_PROFILES.find((profile) => profile.id === 'sightseeing')!;
  const candidates = [
    candidate({ placeId: 'a', category: 'nightlife', rating: 4.9, reviewCount: 5000 }),
    candidate({ placeId: 'b', category: 'shopping', rating: 4.0, reviewCount: 100 }),
    candidate({ placeId: 'c', category: 'sightseeing', rating: 4.2, reviewCount: 200 }),
  ];
  const ranked = rankCandidatesByDna(candidates, sightseeing);
  assert.ok(!ranked.some((c) => c.category === 'nightlife'), 'forbidden category candidate must be excluded');
  assert.strictEqual(ranked[0]?.placeId, 'c', 'dominant category candidate should rank first');
});

check('buildDnaPromptGuidance mentions label, forbidden categories, and abstract item cap', () => {
  const family = TRIP_DNA_PROFILES.find((profile) => profile.id === 'family')!;
  const guidance = buildDnaPromptGuidance(family);
  assert.ok(guidance.includes('Family'));
  assert.ok(guidance.includes('nightlife'));
  assert.ok(guidance.includes(String(family.validationRules.maxAbstractItems)));
});

check('getTimeOfDaySlot buckets times correctly', () => {
  assert.strictEqual(getTimeOfDaySlot('07:30'), 'morning');
  assert.strictEqual(getTimeOfDaySlot('12:00'), 'midday');
  assert.strictEqual(getTimeOfDaySlot('15:30'), 'afternoon');
  assert.strictEqual(getTimeOfDaySlot('19:00'), 'evening');
  assert.strictEqual(getTimeOfDaySlot('23:00'), 'night');
  assert.strictEqual(getTimeOfDaySlot(undefined), null);
});

check('validateItineraryAgainstDna flags forbidden category + time-of-day conflict + low ratio', () => {
  const sightseeing = TRIP_DNA_PROFILES.find((profile) => profile.id === 'sightseeing')!;
  const days = [
    day([
      item({ time: '09:00', activity: '観光名所を訪れる', category: 'sightseeing' }),
      item({ time: '20:00', activity: '深夜のバーへ', category: 'nightlife' }),
      item({ time: '10:30', activity: 'ショッピングを楽しむ', category: 'shopping' }),
      item({ time: '11:00', activity: 'ショッピングを楽しむ2', category: 'shopping' }),
    ]),
  ];
  const report = validateItineraryAgainstDna(days, sightseeing);
  assert.strictEqual(report.isValid, false);
  assert.ok(report.violations.some((violation) => violation.type === 'forbidden_category_item'));
  assert.ok(report.violations.some((violation) => violation.type === 'time_of_day_conflict'));
  assert.ok(report.violations.some((violation) => violation.type === 'dominant_ratio_below_target'));
});

check('validateItineraryAgainstDna passes for a well-formed itinerary', () => {
  const gourmet = TRIP_DNA_PROFILES.find((profile) => profile.id === 'gourmet')!;
  const days = [
    day([
      item({ time: '08:00', activity: '明洞餃子で人気のグルメを味わう', category: 'food', isSpecificPlace: true }),
      item({ time: '12:30', activity: '広蔵市場で人気のグルメを味わう', category: 'food', isSpecificPlace: true }),
      item({ time: '19:00', activity: '南大門で人気のグルメを味わう', category: 'food', isSpecificPlace: true }),
      item({ time: '15:00', activity: '南山タワーを訪れる', category: 'sightseeing', isSpecificPlace: true }),
    ]),
  ];
  const report = validateItineraryAgainstDna(days, gourmet);
  assert.strictEqual(report.isValid, true);
  assert.strictEqual(report.violations.length, 0);
});

check('resolveFallbackCategories filters degradeCategoryOrder to what is actually available', () => {
  const gourmet = TRIP_DNA_PROFILES.find((profile) => profile.id === 'gourmet')!;
  const result = resolveFallbackCategories(gourmet, ['activity', 'sightseeing']);
  assert.deepStrictEqual(result.categories, ['sightseeing', 'activity']);
  assert.strictEqual(result.style, 'culinary');
});

console.log(`\n[trip-dna-engine.verify] ${passed} checks passed.`);
