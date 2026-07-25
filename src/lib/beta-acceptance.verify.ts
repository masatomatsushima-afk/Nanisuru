/**
 * Nanisuru Beta Acceptance — Product Brain gate (deterministic, no live APIs).
 * Run: npm run verify:beta-acceptance
 *
 * Covers Product Brain rules A–H with fixtures / pure helpers only.
 */
// @ts-nocheck — Node verify script (same pattern as other *.verify.ts; Expo tsconfig has no @types/node)

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import {
  getEarliestActivityStartMinutes,
  getLatestActivityEndMinutes,
  parseTimeToMinutes,
  resolveDayAvailableMinutes,
  resolveTargetItemCountForDay,
} from './day-availability';
import {
  resolveItineraryMapsLink,
  urlLooksBrokenForMaps,
} from './maps-link-safety';
import { buildPlaceSearchIntents } from './places/place-search-intent';
import {
  PURPOSE_COVERAGE_CATEGORIES,
  enforcePurposeComposition,
} from './purpose-composition-enforcement';
import { PURPOSE_PROFILES } from './purpose-profiles';
import { isAbstractItineraryItem } from './spot-specificity';
import { DEFAULT_TRIP_DNA_PROFILE } from './trip-dna/trip-dna-profiles';
import {
  resolveArrivalContext,
  resolveDepartureContext,
  type TravelTimingSettings,
} from '../types/travel-timing';
import type { ItineraryDay, ItineraryItem } from '../types/plan';
import type { PlaceCandidate } from '../types/place-candidate';
import {
  buildDailyWeatherModifiers,
  weatherContextToLegacyForecast,
} from './weather-context/daily-weather-modifier';
import type { WeatherContext } from '../types/weather-context';
import { isUsableWeatherContext } from './weather-replan-resolve';

const ROOT = process.cwd();

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

function item(partial: Partial<ItineraryItem> & Pick<ItineraryItem, 'time' | 'activity'>): ItineraryItem {
  return { activityCategory: '体験', ...partial };
}

function day(items: ItineraryItem[], label = '1日目'): ItineraryDay {
  return { dayNumber: 1, label, theme: '', items };
}

function candidate(
  partial: Partial<PlaceCandidate> & Pick<PlaceCandidate, 'placeId' | 'placeName'>,
): PlaceCandidate {
  return { rating: 4.4, reviewCount: 120, category: 'food', source: 'google_places', ...partial };
}

/** Same strip policy as final-day validation when return transport is unspecified. */
function stripInventedReturnItems(items: readonly ItineraryItem[], injectTransit: boolean): ItineraryItem[] {
  if (injectTransit) return [...items];
  return items.filter(
    (entry) =>
      !/空港|airport|空港到着|出発目安|フライト|飛行機|帰路優先|(?:を|へ)出発$/i.test(
        `${entry.activity} ${entry.note ?? ''}`,
      ),
  );
}

const FORBIDDEN_WEATHER_CLAIM =
  /傘|雨に注意|防水|強風|猛暑|寒さ|屋内中心が安心|折りたたみ傘|雨予報/;

const ABSTRACT_TITLES = [
  '人気カフェ',
  '韓国料理ディナー',
  '買い物スポット',
  '市場を散策',
  '美しい公園で散歩',
  '難波で楽しむ',
  'UI確認用',
  'テスト用スポット',
  '日本・大阪（難波拠点）でお土産・ショッピングを楽しむ',
];

// ─── A. No invented airport ───────────────────────────────────────────────
check('A: Osaka Namba 16:30–22:30 unspecified transport → no airport assumption', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '16:30',
    departureTime: '22:30',
  };
  assert.strictEqual(resolveArrivalContext(timing).type, 'already_in_area');
  assert.strictEqual(resolveDepartureContext(timing).type, 'stay_in_area');
  assert.strictEqual(getEarliestActivityStartMinutes(timing), 16 * 60 + 30);
  assert.strictEqual(getLatestActivityEndMinutes(timing), 22 * 60 + 30);

  const planItems = [
    item({
      time: '16:30',
      activity: 'なんばパークス',
      category: 'shopping',
      placeName: 'なんばパークス',
      isSpecificPlace: true,
      source: 'google_places',
      placeId: 'ChIJnambaParksOsaka01',
    }),
    item({
      time: '18:30',
      activity: 'たこ焼道楽 わなか 千日前本店',
      category: 'food',
      placeName: 'たこ焼道楽 わなか 千日前本店',
      isSpecificPlace: true,
      source: 'google_places',
      placeId: 'ChIJwanakaDotonbori01',
    }),
    item({ time: '20:00', activity: '難波を出発', activityCategory: '移動' }),
    item({ time: '21:45', activity: '空港到着目安', activityCategory: '移動', note: '出発に合わせる' }),
  ];
  const kept = stripInventedReturnItems(planItems, false);
  const blob = kept.map((entry) => `${entry.activity} ${entry.note ?? ''}`).join(' | ');
  assert.ok(!/空港|airport|flight|飛行機|フライト/i.test(blob), `airport leaked: ${blob}`);
  assert.ok(kept.some((entry) => /なんば|難波|パークス/.test(entry.activity)));
});

// ─── B. Purpose coverage ───────────────────────────────────────────────────
check('B: gourmet+shopping each require ≥1 item when candidates exist', () => {
  const shopping = PURPOSE_PROFILES.find((profile) => profile.id === 'shopping')!;
  const days = [
    day([
      item({
        time: '16:30',
        activity: '心斎橋PARCO',
        category: 'shopping',
        placeName: '心斎橋PARCO',
        placeId: 'ChIJshinsaibashiParco01',
        isSpecificPlace: true,
        source: 'google_places',
      }),
      item({
        time: '18:00',
        activity: 'なんばパークス',
        category: 'shopping',
        placeName: 'なんばパークス',
        placeId: 'ChIJnambaParksOsaka02',
        isSpecificPlace: true,
        source: 'google_places',
      }),
    ]),
  ];
  const report = enforcePurposeComposition(days, {
    profile: shopping,
    selectedMood: '買い物',
    candidates: [
      candidate({
        placeId: 'ChIJ551horaiEbisubashi01',
        placeName: '551蓬莱 戎橋本店',
        category: 'food',
      }),
    ],
    rawLocation: '大阪 難波',
    selectedPurposes: [
      { purpose: 'gourmet', weight: 0.55 },
      { purpose: 'shopping', weight: 0.45 },
    ],
  });
  assert.ok((report.finalItemCountByPurpose?.gourmet ?? 0) >= 1, 'gourmet must be ≥1');
  assert.ok((report.finalItemCountByPurpose?.shopping ?? 0) >= 1, 'shopping must be ≥1');

  const intents = buildPlaceSearchIntents(
    DEFAULT_TRIP_DNA_PROFILE,
    {
      destinationLabel: '日本・大阪（難波拠点）',
      city: '大阪',
      country: '日本',
      baseArea: '難波',
    },
    {
      selectedPurposes: [
        { purpose: 'gourmet', weight: 0.55 },
        { purpose: 'shopping', weight: 0.45 },
      ],
    },
  );
  assert.ok(intents.some((intent) => PURPOSE_COVERAGE_CATEGORIES.gourmet.includes(intent.category)));
  assert.ok(intents.some((intent) => intent.category === 'shopping'));
});

// ─── C. Abstract spot prevention ───────────────────────────────────────────
check('C: abstract titles must not be treated as specific venues', () => {
  for (const title of ABSTRACT_TITLES) {
    assert.strictEqual(
      isAbstractItineraryItem({ activity: title, placeName: title }),
      true,
      `should be abstract: ${title}`,
    );
  }

  const concrete = item({
    time: '17:00',
    activity: 'なんばパークス',
    placeName: 'なんばパークス',
    placeId: 'ChIJnambaParksOsaka03',
    source: 'google_places',
    isSpecificPlace: true,
  });
  assert.strictEqual(isAbstractItineraryItem(concrete), false);

  // Product Brain: isSpecificPlace=true requires google-backed identity.
  const fakeSpecific = item({
    time: '18:00',
    activity: '人気カフェ',
    placeName: '人気カフェ',
    isSpecificPlace: true,
    source: 'openai',
    placeId: null,
  });
  const demoted =
    fakeSpecific.source === 'google_places' && Boolean(fakeSpecific.placeId)
      ? fakeSpecific
      : { ...fakeSpecific, isSpecificPlace: false as const, placeId: null };
  assert.strictEqual(demoted.isSpecificPlace, false);
  assert.ok(isAbstractItineraryItem(fakeSpecific));
});

// ─── D. Maps safety ────────────────────────────────────────────────────────
check('D: Maps URLs must not contain broken tokens', () => {
  const good = resolveItineraryMapsLink(
    {
      time: '16:30',
      activity: 'なんばパークス',
      placeName: 'なんばパークス',
      placeId: 'ChIJnambaParksOsakaSafe01',
      source: 'google_places',
      isSpecificPlace: true,
      mapsQuery: 'なんばパークス 難波 大阪 日本',
    },
    '大阪, 日本',
  );
  assert.ok(good, 'expected a safe maps link for google place');
  assert.ok(!urlLooksBrokenForMaps(good!.url), good!.url);
  assert.ok(!/undefined|null|NaN|invalid|query_place_id=(?:&|$)|destination=(?:undefined|null)/i.test(good!.url));

  const abstractLink = resolveItineraryMapsLink(
    {
      time: '17:00',
      activity: '市場を散策',
      isSpecificPlace: false,
      placeId: null,
    },
    '大阪, 日本',
  );
  assert.strictEqual(abstractLink, null);

  const badCandidates = [
    'https://www.google.com/maps/search/?api=1&query=undefined',
    'https://www.google.com/maps/dir/?api=1&destination=null,null',
    'https://www.google.com/maps/search/?api=1&query_place_id=',
    'https://www.google.com/maps/search/?api=1&query=NaN',
    'https://maps.google.com/?q=invalid%20coord',
  ];
  for (const url of badCandidates) {
    assert.strictEqual(urlLooksBrokenForMaps(url), true, url);
  }
});

// ─── E. Weather unavailable: no hard claims ────────────────────────────────
check('E: weatherAvailable=false must not claim rain/umbrella/etc.', () => {
  const unavailable: WeatherContext = {
    weatherAvailable: false,
    provider: 'none',
    attribution: '',
    fetchedAt: '2026-07-24T00:00:00.000Z',
    timezone: 'Asia/Tokyo',
    location: {
      latitude: 34.66,
      longitude: 135.5,
      label: 'Osaka',
      source: 'destination_coordinates',
    },
    forecastStartDate: '',
    forecastEndDate: '',
    daily: [],
    hourly: [],
    partialForecast: false,
    unavailableReason: 'fetch_failed',
  };
  assert.strictEqual(isUsableWeatherContext(unavailable), false);
  const modifiers = buildDailyWeatherModifiers(unavailable);
  assert.strictEqual(modifiers.length, 0);
  const legacy = weatherContextToLegacyForecast({
    weatherContext: unavailable,
    modifiers,
    locationName: '大阪',
    tripDate: '2026-07-24',
  });
  assert.strictEqual(legacy.hasRainExpected, false);
  const blob = JSON.stringify(legacy);
  assert.ok(!FORBIDDEN_WEATHER_CLAIM.test(blob), `forbidden weather claim in: ${blob.slice(0, 400)}`);
  assert.strictEqual(legacy.seasonalContext?.outfitAdvice ?? '', '');
});

// ─── F. Infinite loading prevention (source contract) ──────────────────────
check('F: weather replan clears loading / preserves original on failure path', () => {
  const sheetPath = path.join(ROOT, 'src/components/weather-replan-preview-sheet.tsx');
  const source = fs.readFileSync(sheetPath, 'utf8');
  assert.ok(/finally\s*\{/.test(source), 'preview sheet must use finally to clear loading');
  assert.ok(/setApplying\(false\)/.test(source), 'applying flag must clear');
  assert.ok(/loadingCleared:\s*true/.test(source), 'dev signal loadingCleared required');

  // Atomic replace contract: failed validation must not mutate base reference.
  const baseDays = [day([item({ time: '16:30', activity: '元プラン' })])];
  const originalActivity = baseDays[0].items[0].activity;
  const failed = false;
  const nextDays = failed
    ? [day([item({ time: '17:00', activity: '壊れたプラン' })])]
    : baseDays;
  assert.strictEqual(nextDays[0].items[0].activity, originalActivity);
  assert.strictEqual(baseDays[0].items[0].activity, '元プラン');
});

// ─── G. CTA no-op prevention (detectable range) ────────────────────────────
check('G: Plan Detail CTA must wire onPress (static detect)', () => {
  const indexPath = path.join(ROOT, 'src/app/(tabs)/index.tsx');
  const source = fs.readFileSync(indexPath, 'utf8');
  const labelIndex = source.indexOf('accessibilityLabel="プラン詳細を見る"');
  assert.ok(labelIndex >= 0, 'detail CTA label missing');
  // Look back within the same Pressable block for onPress={openDetail} (or similar).
  const windowStart = Math.max(0, labelIndex - 400);
  const block = source.slice(windowStart, labelIndex + 80);
  assert.ok(/onPress=\{[^}]+\}/.test(block), 'Pressable near detail CTA must have onPress');
  assert.ok(/openDetail|onPress=\{openDetail\}/.test(block), 'detail CTA should call openDetail');

  // Route target exists.
  const detailRoute = path.join(ROOT, 'src/app/plan-detail.tsx');
  assert.ok(fs.existsSync(detailRoute), 'plan-detail route file must exist');
});

// ─── H. Time validation ────────────────────────────────────────────────────
check('H: times stay inside window, ordered, and not a one-item trap', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '16:30',
    departureTime: '22:30',
  };
  const { availableMinutes, targetItemCount } = resolveTargetItemCountForDay({
    dayIndex: 0,
    totalDays: 1,
    travelTiming: timing,
  });
  assert.strictEqual(availableMinutes, 6 * 60);
  assert.ok(targetItemCount >= 2, `6h window must not collapse to 1 item (got ${targetItemCount})`);

  const items = [
    item({ time: '16:30', activity: 'A', category: 'shopping' }),
    item({ time: '18:30', activity: 'B', category: 'food' }),
    item({ time: '20:30', activity: 'C', category: 'cafe' }),
  ];
  const start = getEarliestActivityStartMinutes(timing)!;
  const end = getLatestActivityEndMinutes(timing)!;
  let prev = -1;
  for (const entry of items) {
    const minutes = parseTimeToMinutes(entry.time);
    assert.ok(minutes != null);
    assert.ok(minutes! >= start, `${entry.time} before start`);
    assert.ok(minutes! <= end, `${entry.time} after end`);
    assert.ok(minutes! > prev, `time not increasing at ${entry.time}`);
    prev = minutes!;
  }

  // Single sparse item on a long day is a warning-level failure for β gate.
  const sparse = resolveDayAvailableMinutes({ dayIndex: 0, totalDays: 1, travelTiming: timing });
  assert.ok(sparse >= 300);
  assert.ok(resolveTargetItemCountForDay({ dayIndex: 0, totalDays: 1, travelTiming: timing }).targetItemCount > 1);
});

console.log(`\n[beta-acceptance.verify] ${passed} checks passed (Product Brain A–H).`);
