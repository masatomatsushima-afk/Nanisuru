/**
 * Plan-generation MVP regression checks (A–F).
 * Uses relative imports only so Node/tsx verify stays free of react-native.
 * Run: npm run verify:plan-generation-mvp
 */

import assert from 'node:assert';
import {
  getEarliestActivityStartMinutes,
  getLatestActivityEndMinutes,
  resolveDayAvailableMinutes,
} from './day-availability';
import { resolveAreaPhraseHub, genericAreaPhrase, normalizeDestination } from './destination-safety';
import {
  buildPlaceSearchIntents,
  countCandidatesByPurpose,
} from './places/place-search-intent';
import { enforcePurposeComposition } from './purpose-composition-enforcement';
import { isAbstractItineraryItem } from './spot-specificity';
import { DEFAULT_TRIP_DNA_PROFILE } from './trip-dna/trip-dna-profiles';
import { PURPOSE_PROFILES } from './purpose-profiles';
import {
  departureTransferBufferMinutes,
  resolveArrivalContext,
  resolveDepartureContext,
  type TravelTimingSettings,
} from '../types/travel-timing';
import type { ItineraryDay, ItineraryItem } from '../types/plan';
import type { PlaceCandidate } from '../types/place-candidate';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

function item(partial: Partial<ItineraryItem> & Pick<ItineraryItem, 'time' | 'activity'>): ItineraryItem {
  return {
    activityCategory: '体験',
    ...partial,
  };
}

function day(items: ItineraryItem[], label = '1日目'): ItineraryDay {
  return { label, theme: '', items };
}

function candidate(
  partial: Partial<PlaceCandidate> & Pick<PlaceCandidate, 'placeId' | 'placeName'>,
): PlaceCandidate {
  return {
    rating: 4.4,
    reviewCount: 100,
    category: 'food',
    ...partial,
  };
}

/** Mirrors final-day strip rule when return transport is unspecified. */
function stripInventedReturnItems(items: readonly ItineraryItem[], injectTransit: boolean): ItineraryItem[] {
  if (injectTransit) return [...items];
  return items.filter(
    (entry) =>
      !/空港|airport|空港到着|出発目安|フライト|飛行機|帰路優先|(?:を|へ)出発$/i.test(
        `${entry.activity} ${entry.note ?? ''}`,
      ),
  );
}

check('A/D: arrivalTime/departureTime alone → already_in_area / stay_in_area (no airport)', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '16:30',
    departureTime: '22:30',
  };
  assert.strictEqual(resolveArrivalContext(timing).type, 'already_in_area');
  assert.strictEqual(resolveDepartureContext(timing).type, 'stay_in_area');
  assert.strictEqual(getEarliestActivityStartMinutes(timing), 16 * 60 + 30);
  assert.strictEqual(getLatestActivityEndMinutes(timing), 22 * 60 + 30);
  assert.strictEqual(
    resolveDayAvailableMinutes({ dayIndex: 0, totalDays: 1, travelTiming: timing }),
    6 * 60,
  );
});

check('C: explicit airport departure injects buffer and enables transit', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '10:00',
    departureTime: '21:00',
    departurePlace: '空港',
  };
  const context = resolveDepartureContext(timing);
  assert.strictEqual(context.type, 'airport');
  assert.strictEqual(departureTransferBufferMinutes(context), 180);
  assert.strictEqual(getLatestActivityEndMinutes(timing), 18 * 60);

  const kept = stripInventedReturnItems(
    [
      item({ time: '18:00', activity: '難波を出発', activityCategory: '移動' }),
      item({ time: '18:30', activity: '空港到着目安', activityCategory: '移動' }),
    ],
    true,
  );
  assert.strictEqual(kept.length, 2);
});

check('D: unspecified return strips invented airport items', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '16:30',
    departureTime: '22:30',
  };
  assert.strictEqual(resolveDepartureContext(timing).type, 'stay_in_area');
  const kept = stripInventedReturnItems(
    [
      item({
        time: '17:00',
        activity: 'なんばパークス',
        category: 'shopping',
        placeName: 'なんばパークス',
        isSpecificPlace: true,
      }),
      item({ time: '20:00', activity: '難波を出発', activityCategory: '移動' }),
      item({
        time: '21:45',
        activity: '空港到着目安',
        activityCategory: '移動',
        note: '出発に合わせる',
      }),
    ],
    false,
  );
  const activities = kept.map((entry) => entry.activity).join(' | ');
  assert.ok(!/空港/.test(activities), `airport must not remain: ${activities}`);
  assert.ok(kept.some((entry) => entry.activity === 'なんばパークス'));
  assert.ok(!kept.some((entry) => /空港到着目安/.test(entry.activity)));
});

check('A/E: gourmet+shopping coverage fixed when gourmet missing', () => {
  const shopping = PURPOSE_PROFILES.find((profile) => profile.id === 'shopping')!;
  const days = [
    day([
      item({
        time: '16:30',
        activity: '心斎橋PARCO',
        category: 'shopping',
        placeName: '心斎橋PARCO',
        placeId: 's1',
        isSpecificPlace: true,
      }),
      item({
        time: '18:00',
        activity: 'なんばパークス',
        category: 'shopping',
        placeName: 'なんばパークス',
        placeId: 's2',
        isSpecificPlace: true,
      }),
    ]),
  ];
  const report = enforcePurposeComposition(days, {
    profile: shopping,
    selectedMood: '買い物',
    candidates: [candidate({ placeId: 'f1', placeName: '551蓬莱 戎橋本店', category: 'food' })],
    rawLocation: '大阪 難波',
    selectedPurposes: [
      { purpose: 'gourmet', weight: 0.55 },
      { purpose: 'shopping', weight: 0.45 },
    ],
  });
  assert.ok((report.finalItemCountByPurpose?.gourmet ?? 0) >= 1);
  assert.ok((report.finalItemCountByPurpose?.shopping ?? 0) >= 1);
  assert.strictEqual(report.missingPurposeCoverageFixed, true);
});

check('abstract destinationLabel shopping title is blocked', () => {
  assert.strictEqual(
    isAbstractItineraryItem({
      activity: '日本・大阪（難波拠点）でお土産・ショッピングを楽しむ',
      placeName: '日本・大阪（難波拠点）',
    }),
    true,
  );
  assert.strictEqual(
    isAbstractItineraryItem({
      activity: '韓国・ソウルでグルメを楽しむ',
      placeName: 'ソウル',
    }),
    true,
  );
  assert.strictEqual(
    isAbstractItineraryItem({
      activity: 'なんばパークス',
      placeName: 'なんばパークス',
    }),
    false,
  );
});

check('F: area free-time phrase uses short hub, not destinationLabel essay', () => {
  const normalized = normalizeDestination('日本・大阪（難波拠点）');
  const hub = resolveAreaPhraseHub(normalized, '難波');
  const phrase = genericAreaPhrase(hub, 'shopping');
  assert.ok(!/日本・大阪/.test(phrase), phrase);
  assert.ok(/難波/.test(phrase), phrase);
  assert.ok(/自由時間|エリア/.test(phrase), phrase);
});

check('B: Seongsu multi-purpose intents cover gourmet + shopping', () => {
  const intents = buildPlaceSearchIntents(
    DEFAULT_TRIP_DNA_PROFILE,
    {
      destinationLabel: '韓国・ソウル（聖水拠点）',
      city: 'ソウル',
      country: '韓国',
      baseArea: '聖水',
    },
    {
      selectedPurposes: [
        { purpose: 'gourmet', weight: 0.55 },
        { purpose: 'shopping', weight: 0.45 },
      ],
    },
  );
  const counts = countCandidatesByPurpose(
    [{ category: 'food' }, { category: 'shopping' }],
    [
      { purpose: 'gourmet', weight: 0.55 },
      { purpose: 'shopping', weight: 0.45 },
    ],
  );
  assert.ok(intents.some((intent) => intent.category === 'food' || intent.category === 'cafe'));
  assert.ok(intents.some((intent) => intent.category === 'shopping'));
  assert.strictEqual(counts.gourmet, 1);
  assert.strictEqual(counts.shopping, 1);
});

check('arrivalPoint airport must NOT flip departureContext to airport', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '16:30',
    departureTime: '22:30',
  };
  assert.strictEqual(resolveDepartureContext(timing).type, 'stay_in_area');
  assert.strictEqual(resolveArrivalContext(timing, '関西空港').type, 'airport');
});

console.log(`\n[plan-generation-mvp.verify] ${passed} checks passed.`);
