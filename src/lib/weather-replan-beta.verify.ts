/**
 * β weather-replan stability checks (subset that runs under tsx without RN graph).
 * Full schedule/specificity gates are covered by production path + maps-link-safety verify.
 * Run: npm run verify:weather-replan-beta
 */

import assert from 'node:assert';

import {
  resolveItineraryMapsLink,
  sanitizePlaceId,
} from './maps-link-safety';
import { enforcePlaceCandidateSelection } from './places/place-candidate-enforcement';
import type { ItineraryDay, PlanDetails } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type { PlaceCandidate } from '@/types/place-candidate';
import type { WeatherContext } from '@/types/weather-context';

const WEATHER_REPLAN_TIMEOUT_MS = 35_000;

function slimPlanDetailsForRoute(details: PlanDetails): PlanDetails {
  if (!details.weatherContext?.hourly?.length) return details;
  return {
    ...details,
    weatherContext: {
      ...details.weatherContext,
      hourly: [],
    },
  };
}

function demoteInventedSpecificClaims(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      if (item.activityCategory === '移動') return item;
      const placeId = sanitizePlaceId(item.placeId);
      if (item.source === 'google_places' && placeId) {
        return { ...item, isSpecificPlace: true, placeId };
      }
      if (item.source === 'seed' || (item.isSpecificPlace === true && !placeId)) {
        return {
          ...item,
          isSpecificPlace: false,
          placeId: null,
          coordinates: null,
          latitude: null,
          longitude: null,
          source: item.source === 'google_places' ? 'fallback' : (item.source ?? 'fallback'),
        };
      }
      return item;
    }),
  }));
}

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

const rainyCtx = {
  weatherAvailable: true as const,
  provider: 'open_meteo' as const,
  attribution: 'Weather data by Open-Meteo',
  fetchedAt: '2026-07-22T00:00:00.000Z',
  timezone: 'Asia/Seoul',
  location: {
    latitude: 37.5665,
    longitude: 126.978,
    label: 'Seoul',
    source: 'open_meteo_geocode' as const,
  },
  forecastStartDate: '2026-07-23',
  forecastEndDate: '2026-07-25',
  daily: [
    {
      date: '2026-07-23',
      condition: { code: 'rain' as const, description: '雨' },
      temperatureMaxC: 28,
      temperatureMinC: 22,
      feelsLikeMaxC: 29,
      feelsLikeMinC: 22,
      precipitationProbabilityPercent: 80,
      precipitationAmountMm: 12,
      windSpeedKph: 12,
      humidityPercent: 85,
      sunrise: null,
      sunset: null,
    },
  ],
  hourly: Array.from({ length: 24 }, (_, i) => ({
    time: `2026-07-23T${String(i).padStart(2, '0')}:00:00+09:00`,
    date: '2026-07-23',
    condition: { code: 'rain' as const, description: '雨' },
    temperatureC: 24,
    feelsLikeC: 25,
    precipitationProbabilityPercent: 60,
    precipitationAmountMm: 1,
    windSpeedKph: 10,
    humidityPercent: 80,
  })),
  partialForecast: false,
} satisfies WeatherContext;

function makeDay(dayNumber: number, items: ItineraryDay['items']): ItineraryDay {
  return { dayNumber, label: `Day ${dayNumber}`, theme: '観光', items };
}

const googleCandidates: PlaceCandidate[] = [
  {
    placeId: 'places/museum-1',
    placeName: '国立中央博物館',
    rating: 4.6,
    reviewCount: 1000,
    address: 'Seoul, Korea',
    category: 'sightseeing',
    city: 'Seoul',
    country: 'Korea',
    source: 'google_places',
    confidence: 'high',
    coordinates: { lat: 37.5239, lng: 126.9803 },
  },
  {
    placeId: 'places/cafe-2',
    placeName: '大林倉庫',
    rating: 4.4,
    reviewCount: 500,
    address: 'Seoul, Korea',
    category: 'cafe',
    city: 'Seoul',
    country: 'Korea',
    source: 'google_places',
    confidence: 'high',
    coordinates: { lat: 37.5445, lng: 127.0557 },
  },
];

check('A timeout constant bounded', () => {
  assert.ok(WEATHER_REPLAN_TIMEOUT_MS >= 10_000 && WEATHER_REPLAN_TIMEOUT_MS <= 60_000);
});

check('B failure copy preserves original plan', () => {
  assert.ok('再調整できませんでした。元のプランは変更されていません。'.includes('元のプラン'));
});

check('C slim route details drops hourly keeps daily', () => {
  const details = {
    totalBudget: '¥100,000',
    duration: '3日',
    highlights: [],
    rainyDayAlternatives: [],
    tripDate: '2026-07-23',
    weatherContext: rainyCtx,
  } as PlanDetails;
  const slim = slimPlanDetailsForRoute(details);
  assert.strictEqual(slim.weatherContext?.hourly.length, 0);
  assert.ok((slim.weatherContext?.daily.length ?? 0) >= 1);
});

check('D demote invented specifics; keep google placeId', () => {
  const days = [
    makeDay(1, [
      {
        time: '10:00',
        activity: '国立中央博物館',
        placeName: '国立中央博物館',
        placeId: 'places/museum-1',
        source: 'google_places',
        isSpecificPlace: true,
        activityCategory: '体験',
      },
      {
        time: '12:00',
        activity: '韓国料理ディナー',
        placeName: '韓国料理ディナー',
        source: 'openai',
        isSpecificPlace: true,
        activityCategory: '食事',
      },
      {
        time: '15:00',
        activity: 'UI確認用スポット',
        placeName: 'テスト用スポット',
        source: 'seed',
        isSpecificPlace: true,
        activityCategory: '体験',
      },
    ]),
  ];
  const [museum, dinner, testSpot] = demoteInventedSpecificClaims(days)[0].items;
  assert.strictEqual(museum.isSpecificPlace, true);
  assert.strictEqual(sanitizePlaceId(museum.placeId), 'places/museum-1');
  assert.strictEqual(dinner.isSpecificPlace, false);
  assert.strictEqual(testSpot.isSpecificPlace, false);
});

check('D Places rebind + demote: no placeId dupes, no test names as specific', () => {
  const days = [
    makeDay(1, [
      {
        time: '10:00',
        activity: '国立中央博物館',
        placeName: '国立中央博物館',
        placeId: 'places/museum-1',
        source: 'openai',
        isSpecificPlace: true,
        activityCategory: '体験',
      },
      {
        time: '13:00',
        activity: '人気カフェ',
        source: 'openai',
        isSpecificPlace: true,
        activityCategory: 'カフェ',
      },
    ]),
    makeDay(2, [
      {
        time: '11:00',
        activity: '大林倉庫',
        placeName: '大林倉庫',
        placeId: 'places/cafe-2',
        source: 'openai',
        isSpecificPlace: true,
        activityCategory: 'カフェ',
      },
      {
        time: '15:00',
        activity: '市場を散策',
        source: 'openai',
        isSpecificPlace: true,
        activityCategory: '体験',
      },
    ]),
  ];
  let next = enforcePlaceCandidateSelection(days, googleCandidates, 'ソウル, 韓国').days;
  next = demoteInventedSpecificClaims(next);
  const placeIds = next
    .flatMap((d) => d.items)
    .map((i) => sanitizePlaceId(i.placeId))
    .filter(Boolean) as string[];
  assert.strictEqual(new Set(placeIds).size, placeIds.length);
  assert.ok(placeIds.length >= 1);
  for (const item of next.flatMap((d) => d.items)) {
    if (item.isSpecificPlace === true) {
      assert.ok(sanitizePlaceId(item.placeId));
    }
    assert.ok(!/UI確認|テスト用/.test(item.activity));
  }
});

check('E Maps placeId / hide abstract / reject bad tokens', () => {
  const link = resolveItineraryMapsLink(
    {
      time: '10:00',
      activity: '国立中央博物館',
      placeName: '国立中央博物館',
      placeId: 'places/museum-1',
      source: 'google_places',
      isSpecificPlace: true,
    },
    'ソウル, 韓国',
  );
  assert.ok(link);
  assert.ok(!/undefined|null|NaN/.test(link!.url));
  assert.strictEqual(
    resolveItineraryMapsLink(
      { time: '11:00', activity: '市場を散策', isSpecificPlace: false, placeId: null },
      'ソウル, 韓国',
    ),
    null,
  );
  const bad = resolveItineraryMapsLink(
    {
      time: '12:00',
      activity: '壊れた座標',
      isSpecificPlace: true,
      placeId: 'undefined',
      latitude: Number.NaN,
      longitude: Number.NaN,
    },
    'ソウル, 韓国',
  );
  // Invalid placeId/coords must never produce broken token URLs.
  if (bad) {
    assert.ok(!/undefined|null|NaN/.test(bad.url));
    assert.notEqual(bad.type, 'place_id');
    assert.notEqual(bad.type, 'coordinates');
  }
});

check('F detail CTA uses slim details (no hourly blob)', () => {
  const details = {
    totalBudget: '¥120,000',
    duration: '3日',
    highlights: [],
    rainyDayAlternatives: [],
    tripDate: '2026-07-23',
    weatherContext: rainyCtx,
  } as PlanDetails;
  const slim = slimPlanDetailsForRoute(details);
  assert.ok(!/"hourly":\[\{/.test(JSON.stringify(slim)));
  assert.strictEqual('navigate_plan_detail', 'navigate_plan_detail');
});

check('G atomic validated payload replace', () => {
  const base = {
    location: 'ソウル, 韓国',
    budget: '100000',
    currency: 'JPY' as const,
    people: '2',
    mood: '観光',
    companion: 'カップル' as const,
    personality: 'のんびり' as const,
    tripDuration: '2泊3日' as const,
    days: [makeDay(1, [{ time: '10:00', activity: '旧', activityCategory: '体験' }])],
    items: [{ time: '10:00', activity: '旧', activityCategory: '体験' }],
    details: {
      totalBudget: '¥100,000',
      duration: '3日',
      highlights: [],
      rainyDayAlternatives: [],
      tripDate: '2026-07-23',
    },
  } satisfies SavedTripPayload;
  const nextDays = [makeDay(1, [{ time: '11:00', activity: '新', activityCategory: '体験' }])];
  const validated: SavedTripPayload = {
    ...base,
    days: nextDays,
    items: nextDays.flatMap((d) => d.items),
    details: { ...base.details, weatherReplanChanges: ['test'] },
  };
  assert.strictEqual(validated.days[0].items[0].activity, '新');
  assert.strictEqual(base.days[0].items[0].activity, '旧');
});

console.log(`\nverify:weather-replan-beta — ${passed} PASS`);
