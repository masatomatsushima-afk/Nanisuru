/**
 * `enforcePurposeComposition` の単体検証（Node.js / tsx で直接実行可能・react-native依存なし）。
 * `npm run verify:purpose-composition` から実行する。
 */

import assert from 'node:assert';
import { enforcePurposeComposition } from './purpose-composition-enforcement';
import { PURPOSE_PROFILES, resolvePurposeProfile } from './purpose-profiles';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { PlaceCandidate } from '@/types/place-candidate';

function item(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    time: '10:00',
    activity: '未設定アイテム',
    ...overrides,
  };
}

function day(items: ItineraryItem[]): ItineraryDay {
  return { dayNumber: 1, label: '1日目', theme: 'テスト', items };
}

function candidate(overrides: Partial<PlaceCandidate>): PlaceCandidate {
  return {
    placeId: 'place-x',
    placeName: '候補店',
    source: 'google_places',
    ...overrides,
  };
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

// --- Test 1: no profile resolved -> no-op, existing behavior untouched ---
check('no profile -> no-op', () => {
  const days = [
    day([
      item({ activity: '広蔵市場を散策', category: 'activity', isSpecificPlace: false }),
      item({ activity: 'カフェで休憩', category: 'cafe', isSpecificPlace: false }),
    ]),
  ];
  const report = enforcePurposeComposition(days, {
    profile: null,
    selectedMood: '',
    candidates: [],
    rawLocation: 'ソウル',
  });
  assert.strictEqual(report.purposeId, null);
  assert.strictEqual(report.fixesApplied.length, 0);
  assert.strictEqual(report.days[0].items.length, 2);
  assert.strictEqual(report.days[0].items[0].activity, '広蔵市場を散策');
});

// --- Test 2: gourmet profile upgrades ratio using candidates, never reuses a placeId ---
check('gourmet profile upgrades low food ratio with unused candidates', () => {
  const gourmet = PURPOSE_PROFILES.find((profile) => profile.id === 'gourmet')!;
  const days = [
    day([
      item({ activity: 'ホテルからエリアを散策', category: 'activity', isSpecificPlace: false }),
      item({ activity: '観光名所を訪れる', category: 'sightseeing', isSpecificPlace: true, placeName: '南山タワー' }),
      item({ activity: 'ショッピングを楽しむ', category: 'shopping', isSpecificPlace: false }),
      item({ activity: '別のショップを見る', category: 'shopping', isSpecificPlace: false }),
    ]),
  ];
  const candidates = [
    candidate({ placeId: 'p1', placeName: '明洞餃子', category: 'food', rating: 4.6 }),
    candidate({ placeId: 'p2', placeName: '益善洞カフェ', category: 'cafe', rating: 4.4 }),
    candidate({ placeId: 'p3', placeName: '広蔵市場食堂', category: 'food', rating: 4.5 }),
    candidate({ placeId: 'p4', placeName: '南大門タッカルビ', category: 'food', rating: 4.5 }),
  ];
  const report = enforcePurposeComposition(days, {
    profile: gourmet,
    selectedMood: 'グルメ',
    candidates,
    rawLocation: 'ソウル',
  });

  assert.ok(report.dominantCategoryRatio >= gourmet.minDominantRatio, `ratio too low: ${report.dominantCategoryRatio}`);
  const usedPlaceIds = report.days[0].items.map((it) => it.placeId).filter(Boolean);
  assert.strictEqual(new Set(usedPlaceIds).size, usedPlaceIds.length, 'placeId reused');
  assert.ok(report.googlePlaceCount > 0);
  const foodItems = report.days[0].items.filter((it) => it.category === 'food' || it.category === 'cafe');
  for (const foodItem of foodItems) {
    assert.notStrictEqual(foodItem.activity, undefined);
    assert.ok(!/エリアを散策|街歩き/.test(foodItem.activity ?? ''), 'activity still reads abstract');
  }
});

// --- Test 3: abstract activity items are capped at maxAbstractWalkItems when activity != dominant ---
check('caps abstract activity filler items at profile.maxAbstractWalkItems', () => {
  const gourmet = PURPOSE_PROFILES.find((profile) => profile.id === 'gourmet')!;
  assert.strictEqual(gourmet.maxAbstractWalkItems, 1);
  const days = [
    day([
      item({ activity: 'エリアAを散策', category: 'activity', isSpecificPlace: false }),
      item({ activity: '明洞餃子で人気のグルメを味わう', category: 'food', isSpecificPlace: true, placeName: '明洞餃子' }),
      item({ activity: 'エリアBを散策', category: 'activity', isSpecificPlace: false }),
      item({ activity: 'エリアCを散策', category: 'activity', isSpecificPlace: false }),
    ]),
  ];
  const report = enforcePurposeComposition(days, {
    profile: gourmet,
    selectedMood: 'グルメ',
    candidates: [],
    rawLocation: 'ソウル',
  });
  const remainingAbstractActivity = report.days[0].items.filter(
    (it) => it.category === 'activity' && it.isSpecificPlace === false,
  );
  assert.strictEqual(remainingAbstractActivity.length, 1, 'should keep only 1 abstract activity item');
  assert.strictEqual(report.abstractWalkItemsRemoved, 2);
});

// --- Test 4: kids profile (dominantCategory='activity') never caps/folds activity items ---
check('activity-dominant profile (kids) does not cap activity filler items', () => {
  const kids = PURPOSE_PROFILES.find((profile) => profile.id === 'kids')!;
  assert.strictEqual(kids.dominantCategory, 'activity');
  const days = [
    day([
      item({ activity: '公園で遊ぶ', category: 'activity', isSpecificPlace: false }),
      item({ activity: '別の公園で遊ぶ', category: 'activity', isSpecificPlace: false }),
      item({ activity: '観光名所を訪れる', category: 'sightseeing', isSpecificPlace: true, placeName: '水族館' }),
    ]),
  ];
  const candidates = [
    candidate({ placeId: 'k1', placeName: 'キッズパーク', category: 'activity', rating: 4.7 }),
    candidate({ placeId: 'k2', placeName: 'こども科学館', category: 'activity', rating: 4.5 }),
  ];
  const report = enforcePurposeComposition(days, {
    profile: kids,
    selectedMood: '子連れ',
    candidates,
    rawLocation: '大阪',
  });
  assert.strictEqual(report.abstractWalkItemsRemoved, 0, 'activity items must not be folded when activity is dominant');
  assert.strictEqual(report.days[0].items.length, 3, 'no item should be removed');
  const upgraded = report.days[0].items.filter((it) => it.source === 'google_places');
  assert.ok(upgraded.length >= 1, 'generic activity items should be upgraded via activity candidates');
});

// --- Test 5: insufficient candidates -> no fake names, explicit shortfall reported ---
check('reports insufficient candidates without inventing store names', () => {
  const sightseeing = PURPOSE_PROFILES.find((profile) => profile.id === 'sightseeing')!;
  const days = [
    day([
      item({ activity: '食事を楽しむ', category: 'food', isSpecificPlace: false }),
      item({ activity: '食事を楽しむ2', category: 'food', isSpecificPlace: false }),
      item({ activity: '食事を楽しむ3', category: 'food', isSpecificPlace: false }),
    ]),
  ];
  const report = enforcePurposeComposition(days, {
    profile: sightseeing,
    selectedMood: '観光',
    candidates: [],
    rawLocation: '福岡',
  });
  assert.ok(report.dominantCategoryRatio < sightseeing.minDominantRatio);
  assert.ok(report.fixesApplied.some((fix) => fix.includes('insufficient_candidates')));
  for (const it of report.days[0].items) {
    assert.strictEqual(it.placeId ?? undefined, undefined, 'must not invent a placeId without a real candidate');
  }
});

// --- Test 6: logistics items are never touched even if generic/activity ---
check('logistics items (arrival/checkin) are never upgraded or folded', () => {
  const gourmet = PURPOSE_PROFILES.find((profile) => profile.id === 'gourmet')!;
  const days = [
    day([
      item({ activity: '空港に到着', category: 'activity', isSpecificPlace: false }),
      item({ activity: 'ホテルにチェックイン', category: 'activity', isSpecificPlace: false }),
      item({ activity: 'エリアを散策', category: 'activity', isSpecificPlace: false }),
      item({ activity: 'エリアを散策2', category: 'activity', isSpecificPlace: false }),
    ]),
  ];
  const candidates = [candidate({ placeId: 'f1', placeName: '人気食堂', category: 'food' })];
  const report = enforcePurposeComposition(days, {
    profile: gourmet,
    selectedMood: 'グルメ',
    candidates,
    rawLocation: '東京',
  });
  const arrival = report.days[0].items.find((it) => it.activity?.includes('到着'));
  const checkin = report.days[0].items.find((it) => it.activity?.includes('チェックイン'));
  assert.ok(arrival, 'arrival item should still exist');
  assert.ok(checkin, 'checkin item should still exist');
  assert.strictEqual(arrival?.source, undefined);
  assert.strictEqual(checkin?.source, undefined);
});

// --- Test 7: resolvePurposeProfile priority (personality/companion exact match wins) ---
check('resolvePurposeProfile matches personality/companion/keyword', () => {
  assert.strictEqual(resolvePurposeProfile({ personality: 'グルメ', companion: '一人' })?.id, 'gourmet');
  assert.strictEqual(resolvePurposeProfile({ personality: '冒険家', companion: '家族' })?.id, 'kids');
  assert.strictEqual(resolvePurposeProfile({ personality: '冒険家', companion: 'カップル' })?.id, 'couple');
  assert.strictEqual(
    resolvePurposeProfile({ personality: '冒険家', companion: '友達', mood: '観光名所巡りをしたい' })?.id,
    'sightseeing',
  );
  assert.strictEqual(resolvePurposeProfile({ personality: '冒険家', companion: '友達', mood: '普通の旅行' }), null);
});

console.log(`\n[purpose-composition-enforcement.verify] ${passed} checks passed.`);
