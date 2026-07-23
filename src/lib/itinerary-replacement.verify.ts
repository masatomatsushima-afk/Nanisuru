/**
 * 「ここだけ変更」Places-first replacement helpers (no network).
 * Run: npm run verify:itinerary-replacement
 */

import assert from 'node:assert';
import {
  REPLACEMENT_CANDIDATE_LIMIT,
  applyReplacementCandidateToItem,
  collectUsedPlaceIds,
  filterAndRankReplacementCandidates,
  resolveReplacementCategory,
  resolveReplacementRequestType,
} from './itinerary-replacement-search';
import type { PlaceCandidate } from '@/types/place-candidate';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

function item(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    time: '14:00',
    activity: '元のスポット',
    placeName: '元のスポット',
    placeId: 'places/original',
    category: 'sightseeing',
    activityCategory: '景色',
    ...overrides,
  };
}

function candidate(overrides: Partial<PlaceCandidate>): PlaceCandidate {
  return {
    placeId: 'places/x',
    placeName: '候補',
    source: 'google_places',
    category: 'cafe',
    rating: 4.2,
    reviewCount: 100,
    ...overrides,
  };
}

check('preset request types map to categories', () => {
  assert.strictEqual(resolveReplacementRequestType('cafe', ''), 'cafe');
  assert.strictEqual(resolveReplacementCategory('cafe', item(), ''), 'cafe');
  assert.strictEqual(resolveReplacementCategory('shopping', item(), ''), 'shopping');
  assert.strictEqual(resolveReplacementCategory('gourmet', item(), ''), 'food');
  assert.strictEqual(
    resolveReplacementCategory('similar_vibe', item({ category: 'cafe' }), ''),
    'cafe',
  );
});

check('filters out original and used placeIds; keeps limit 3', () => {
  const days: ItineraryDay[] = [
    {
      dayNumber: 1,
      label: '1日目',
      theme: 't',
      items: [
        item({ placeId: 'places/original' }),
        item({ placeId: 'places/used-2', activity: '別', placeName: '別' }),
      ],
    },
  ];
  const used = collectUsedPlaceIds(days, { dayIndex: 0, itemIndex: 0 });
  assert.ok(used.has('places/used-2'));
  assert.ok(!used.has('places/original'));

  const ranked = filterAndRankReplacementCandidates({
    candidates: [
      candidate({ placeId: 'places/original', placeName: '同じ' }),
      candidate({ placeId: 'places/used-2', placeName: '使用済' }),
      candidate({ placeId: 'places/a', placeName: 'Cafe A', category: 'cafe', rating: 4.8 }),
      candidate({ placeId: 'places/b', placeName: 'Cafe B', category: 'cafe', rating: 4.5 }),
      candidate({ placeId: 'places/c', placeName: 'Cafe C', category: 'cafe', rating: 4.1 }),
      candidate({ placeId: 'places/d', placeName: 'Cafe D', category: 'cafe', rating: 3.9 }),
      candidate({ placeId: 'places/sight', placeName: 'Tower', category: 'sightseeing' }),
    ],
    requestType: 'cafe',
    requestedCategory: 'cafe',
    originalPlaceId: 'places/original',
    usedPlaceIds: used,
    limit: REPLACEMENT_CANDIDATE_LIMIT,
  });

  assert.ok(ranked.length <= 3);
  assert.ok(ranked.every((entry) => entry.category === 'cafe'));
  assert.ok(!ranked.some((entry) => entry.placeId === 'places/original'));
  assert.ok(!ranked.some((entry) => entry.placeId === 'places/used-2'));
  assert.ok(!ranked.some((entry) => entry.source === 'seed'));
});

check('shopping filter rejects sightseeing-only list', () => {
  const ranked = filterAndRankReplacementCandidates({
    candidates: [
      candidate({ placeId: 'places/s1', placeName: 'Temple', category: 'sightseeing' }),
      candidate({ placeId: 'places/m1', placeName: 'Mall', category: 'shopping', rating: 4.4 }),
    ],
    requestType: 'shopping',
    requestedCategory: 'shopping',
    originalPlaceId: null,
    usedPlaceIds: new Set(),
  });
  assert.strictEqual(ranked.length, 1);
  assert.strictEqual(ranked[0].placeName, 'Mall');
});

check('applying candidate replaces only that item fields and keeps time', () => {
  const before = item({ time: '16:30', estimatedCost: '¥2000' });
  const after = applyReplacementCandidateToItem(
    before,
    candidate({
      placeId: 'places/new',
      placeName: 'New Cafe',
      category: 'cafe',
      address: 'Seoul',
      mapsUrl: 'https://maps.example/new',
    }),
    'カフェ向けの実在スポットです',
  );
  assert.strictEqual(after.time, '16:30');
  assert.strictEqual(after.placeName, 'New Cafe');
  assert.strictEqual(after.placeId, 'places/new');
  assert.strictEqual(after.activityCategory, 'カフェ');
  assert.strictEqual(after.isSpecificPlace, true);
  assert.strictEqual(after.source, 'google_places');
  assert.strictEqual(after.estimatedCost, '¥2000');
});

check('seed/fallback candidates are never kept', () => {
  const ranked = filterAndRankReplacementCandidates({
    candidates: [
      candidate({ placeId: 'places/seed', placeName: 'Seed', source: 'seed', category: 'cafe' }),
      candidate({
        placeId: 'places/fb',
        placeName: 'Fallback',
        source: 'fallback',
        category: 'cafe',
      }),
      candidate({ placeId: 'places/ok', placeName: 'OK Cafe', source: 'google_places', category: 'cafe' }),
    ],
    requestType: 'cafe',
    requestedCategory: 'cafe',
    originalPlaceId: null,
    usedPlaceIds: new Set(),
  });
  assert.strictEqual(ranked.length, 1);
  assert.strictEqual(ranked[0].placeId, 'places/ok');
});

console.log(`\n[itinerary-replacement.verify] ${passed} checks passed.`);
