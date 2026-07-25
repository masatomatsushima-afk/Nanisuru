/**
 * Weather Context Phase 2 — DailyWeatherModifier + ranking/itinerary apply verify.
 * Run: npm run verify:weather-plan
 */

import assert from 'node:assert';

import {
  aggregateWeatherFitFromModifiers,
  buildDailyWeatherModifiers,
  weatherContextToLegacyForecast,
} from './daily-weather-modifier';
import { applyWeatherToItinerary } from './apply-weather-to-itinerary';
import { rankPlaceCandidates } from '@/lib/places/place-candidate-ranking';
import type { PlaceCandidate } from '@/types/place-candidate';
import type { WeatherContext } from '@/types/weather-context';
import type { ItineraryDay } from '@/types/plan';
import { OPEN_METEO_ATTRIBUTION } from './weather-context-assemble';
import { buildWeatherGeocodeCandidates } from './weather-location-resolver';
import { getWeatherReplanEligibility } from '@/lib/weather-replan-eligibility';
import { generateOutfitPackingAdvice } from '@/lib/outfit-packing-advice';
import type { WeatherForecast } from '@/lib/weather';
let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

function sampleContext(overrides?: Partial<WeatherContext>): WeatherContext {
  return {
    weatherAvailable: true,
    provider: 'open_meteo',
    attribution: OPEN_METEO_ATTRIBUTION,
    fetchedAt: new Date().toISOString(),
    timezone: 'Asia/Seoul',
    location: {
      latitude: 37.5665,
      longitude: 126.978,
      label: 'Seoul',
      source: 'destination_coordinates',
    },
    forecastStartDate: '2026-07-23',
    forecastEndDate: '2026-07-24',
    partialForecast: false,
    daily: [
      {
        date: '2026-07-23',
        condition: { code: 'rain', description: '雨' },
        temperatureMaxC: 24,
        temperatureMinC: 19,
        feelsLikeMaxC: 26,
        feelsLikeMinC: 18,
        precipitationProbabilityPercent: 70,
        precipitationAmountMm: 5,
        windSpeedKph: 12,
        humidityPercent: 80,
        sunrise: '2026-07-23T05:20',
        sunset: '2026-07-23T19:50',
      },
      {
        date: '2026-07-24',
        condition: { code: 'clear', description: '晴れ' },
        temperatureMaxC: 31,
        temperatureMinC: 23,
        feelsLikeMaxC: 34,
        feelsLikeMinC: 24,
        precipitationProbabilityPercent: 10,
        precipitationAmountMm: 0,
        windSpeedKph: 8,
        humidityPercent: 55,
        sunrise: '2026-07-24T05:21',
        sunset: '2026-07-24T19:49',
      },
    ],
    hourly: [
      {
        time: '2026-07-23T10:00',
        date: '2026-07-23',
        condition: { code: 'rain', description: '雨' },
        temperatureC: 22,
        feelsLikeC: 22,
        precipitationProbabilityPercent: 80,
        precipitationAmountMm: 1.2,
        windSpeedKph: 14,
        humidityPercent: 85,
      },
      {
        time: '2026-07-23T15:00',
        date: '2026-07-23',
        condition: { code: 'rain_showers', description: 'にわか雨' },
        temperatureC: 23,
        feelsLikeC: 23,
        precipitationProbabilityPercent: 55,
        precipitationAmountMm: 0.5,
        windSpeedKph: 12,
        humidityPercent: 80,
      },
      {
        time: '2026-07-23T18:00',
        date: '2026-07-23',
        condition: { code: 'cloudy', description: '曇り' },
        temperatureC: 21,
        feelsLikeC: 21,
        precipitationProbabilityPercent: 20,
        precipitationAmountMm: 0,
        windSpeedKph: 10,
        humidityPercent: 70,
      },
      {
        time: '2026-07-24T13:00',
        date: '2026-07-24',
        condition: { code: 'clear', description: '晴れ' },
        temperatureC: 33,
        feelsLikeC: 36,
        precipitationProbabilityPercent: 5,
        precipitationAmountMm: 0,
        windSpeedKph: 6,
        humidityPercent: 50,
      },
      {
        time: '2026-07-24T09:00',
        date: '2026-07-24',
        condition: { code: 'clear', description: '晴れ' },
        temperatureC: 28,
        feelsLikeC: 29,
        precipitationProbabilityPercent: 5,
        precipitationAmountMm: 0,
        windSpeedKph: 6,
        humidityPercent: 55,
      },
    ],
    ...overrides,
  };
}

check('A rain day: rainRisk high and indoor ratio elevated', () => {
  const modifiers = buildDailyWeatherModifiers(sampleContext());
  assert.strictEqual(modifiers.length, 2);
  assert.ok(modifiers[0].rainRisk === 'high' || modifiers[0].rainRisk === 'moderate');
  assert.ok(modifiers[0].preferredIndoorRatio >= 0.55);
  assert.ok(modifiers[0].summaryLine?.includes('降水確率'));
});

check('B heat day: heatRisk from feelsLike', () => {
  const modifiers = buildDailyWeatherModifiers(sampleContext());
  assert.ok(modifiers[1].heatRisk === 'moderate' || modifiers[1].heatRisk === 'high');
  assert.ok(modifiers[1].preferredOutdoorHours.includes(9) || modifiers[1].preferredOutdoorHours.includes(17));
});

check('C fair weather aggregate does not force indoor', () => {
  const fair = sampleContext({
    daily: [
      {
        date: '2026-07-23',
        condition: { code: 'clear', description: '晴れ' },
        temperatureMaxC: 24,
        temperatureMinC: 18,
        feelsLikeMaxC: 24,
        feelsLikeMinC: 18,
        precipitationProbabilityPercent: 10,
        precipitationAmountMm: 0,
        windSpeedKph: 8,
        humidityPercent: 50,
        sunrise: null,
        sunset: null,
      },
    ],
    hourly: [],
  });
  const modifiers = buildDailyWeatherModifiers(fair);
  const fit = aggregateWeatherFitFromModifiers(modifiers);
  assert.strictEqual(fit.rainRisk, false);
  assert.strictEqual(fit.preferIndoor, false);
});

check('D weatherAvailable=false → no modifiers / no rain claim in legacy', () => {
  const unavailable = sampleContext({
    weatherAvailable: false,
    provider: 'none',
    daily: [],
    hourly: [],
    unavailableReason: 'fetch_failed',
  });
  const modifiers = buildDailyWeatherModifiers(unavailable);
  assert.strictEqual(modifiers.length, 0);
  const legacy = weatherContextToLegacyForecast({
    weatherContext: unavailable,
    modifiers,
    locationName: 'Seoul',
    tripDate: '2026-07-23',
  });
  assert.strictEqual(legacy.hasRainExpected, false);
  assert.ok(legacy.available === false || legacy.planningMode !== 'forecast');
  assert.strictEqual(legacy.unavailableReason, 'fetch_failed');
  assert.ok(legacy.planningMessage?.includes('取得できませんでした'));
  assert.ok(!/折りたたみ傘|防水|雨予報|屋内中心/.test(legacy.seasonalContext?.outfitAdvice ?? ''));
  assert.strictEqual(legacy.seasonalContext?.outfitAdvice ?? '', '');
});

check('A weatherAvailable=true → forecast days, no seasonal fallback', () => {
  const fair = sampleContext({
    daily: [
      {
        date: '2026-07-23',
        condition: { code: 'clear', description: '晴れ' },
        temperatureMaxC: 28,
        temperatureMinC: 22,
        feelsLikeMaxC: 29,
        feelsLikeMinC: 22,
        precipitationProbabilityPercent: 10,
        precipitationAmountMm: 0,
        windSpeedKph: 8,
        humidityPercent: 50,
        sunrise: null,
        sunset: null,
      },
    ],
    hourly: [],
  });
  const modifiers = buildDailyWeatherModifiers(fair);
  const legacy = weatherContextToLegacyForecast({
    weatherContext: fair,
    modifiers,
    locationName: 'Seoul',
    tripDate: '2026-07-23',
  });
  assert.strictEqual(legacy.available, true);
  assert.strictEqual(legacy.planningMode, 'forecast');
  assert.ok(legacy.days.length >= 1);
  assert.strictEqual(legacy.seasonalContext, undefined);
  assert.ok(!legacy.unavailableReason);
});

check('B outside_forecast_range → safe seasonal, no umbrella', () => {
  const outside = sampleContext({
    weatherAvailable: false,
    provider: 'none',
    daily: [],
    hourly: [],
    unavailableReason: 'outside_forecast_range',
  });
  const legacy = weatherContextToLegacyForecast({
    weatherContext: outside,
    modifiers: [],
    locationName: 'ソウル',
    tripDate: '2026-07-23',
  });
  assert.strictEqual(legacy.unavailableReason, 'outside_forecast_range');
  assert.ok(legacy.planningMessage?.includes('対象期間外'));
  assert.strictEqual(legacy.hasRainExpected, false);
  assert.ok(!/折りたたみ傘|防水|雨/.test(JSON.stringify(legacy.seasonalContext)));
});

check('C fetch_failed replan eligibility offers refetch label', () => {
  const eligibility = getWeatherReplanEligibility('2026-07-23', {
    available: false,
    locationName: 'Seoul',
    planningMode: 'unavailable',
    unavailableReason: 'fetch_failed',
    days: [],
    summary: 'x',
    hasRainExpected: false,
    isMostlySunny: false,
  } satisfies WeatherForecast);
  assert.strictEqual(eligibility.status, 'ready');
  if (eligibility.status === 'ready') {
    assert.strictEqual(eligibility.buttonLabel, '天気を再取得');
  }
});

check('C outside_forecast_range replan is future (no spam refetch)', () => {
  const eligibility = getWeatherReplanEligibility('2026-12-01', {
    available: false,
    locationName: 'Seoul',
    planningMode: 'seasonal',
    unavailableReason: 'outside_forecast_range',
    days: [],
    summary: 'x',
    hasRainExpected: false,
    isMostlySunny: false,
  } satisfies WeatherForecast);
  assert.strictEqual(eligibility.status, 'future');
});

check('D outfit unavailable July Seoul has no umbrella', () => {
  const advice = generateOutfitPackingAdvice({
    days: [{ dayNumber: 1, label: '1日目', theme: '', date: '2026-07-23', items: [] }],
    weather: {
      available: false,
      locationName: 'ソウル',
      planningMode: 'unavailable',
      unavailableReason: 'fetch_failed',
      days: [],
      summary: 'x',
      hasRainExpected: false,
      isMostlySunny: false,
      seasonalContext: {
        mode: 'seasonal',
        destination: 'ソウル',
        month: 7,
        monthLabel: '7月',
        seasonLabel: '真夏',
        guidance: '一般的な傾向です。',
        outfitAdvice: '',
        riskNotes: [],
      },
    },
    location: 'ソウル',
    companion: '一人',
    tripDate: '2026-07-23',
    planType: '旅行プラン',
  });
  const blob = JSON.stringify(advice);
  assert.strictEqual(advice.weatherAvailable, false);
  assert.ok(!/折りたたみ傘|防水|雨予報|屋内中心が安心|強風/.test(blob));
  assert.ok(!/取得できなかった|出発前に最新の天気を確認/.test(blob));
});


check('Places ranking boosts indoor cafe on rain bias', () => {
  const cafe: PlaceCandidate = {
    placeId: 'cafe1',
    placeName: 'Test Cafe',
    category: 'cafe',
    rating: 4.2,
    reviewCount: 100,
    source: 'google_places',
    city: 'Seoul',
    country: 'Korea',
  };
  const park: PlaceCandidate = {
    placeId: 'act1',
    placeName: 'Test Activity',
    category: 'activity',
    venueSetting: 'outdoor',
    rating: 4.5,
    reviewCount: 200,
    source: 'google_places',
    city: 'Seoul',
    country: 'Korea',
  };
  const ranked = rankPlaceCandidates([cafe, park], {
    destinationLabel: 'Seoul Korea',
    city: 'Seoul',
    country: 'Korea',
    weatherFit: {
      preferIndoor: true,
      preferOutdoor: false,
      rainRisk: true,
      heatRisk: false,
      coldRisk: false,
    },
  });
  assert.strictEqual(ranked[0].candidate.placeId, 'cafe1');
});

check('applyWeatherToItinerary adds backup only on rainy outdoor items', () => {
  const ctx = sampleContext();
  const modifiers = buildDailyWeatherModifiers(ctx);
  const days: ItineraryDay[] = [
    {
      dayNumber: 1,
      label: '1日目',
      theme: '散策',
      date: '2026-07-23',
      items: [
        {
          time: '10:00',
          activity: '漢江公園を散歩',
          activityCategory: '散歩',
          category: 'sightseeing',
          weatherBackup: '天候に関わらず楽しめます',
        },
        {
          time: '12:00',
          activity: 'カフェで休憩',
          activityCategory: 'カフェ',
          category: 'cafe',
        },
      ],
    },
  ];
  const result = applyWeatherToItinerary({
    days,
    modifiers,
    weatherContext: ctx,
    tripStartDate: '2026-07-23',
  });
  const walk = result.days[0].items.find((i) => i.activityCategory === '散歩');
  const cafe = result.days[0].items.find((i) => i.activityCategory === 'カフェ');
  assert.ok(walk?.weatherBackup && /降水|雨/.test(walk.weatherBackup));
  assert.ok(!/天候に関わらず/.test(walk?.weatherBackup ?? ''));
  assert.ok(!cafe?.weatherBackup || !/天候に関わらず/.test(cafe.weatherBackup));
  assert.ok(result.weatherBackupCount >= 1);
});

check('F outside_forecast_range → seasonal legacy without rain assertion', () => {
  const outside = sampleContext({
    weatherAvailable: false,
    provider: 'none',
    daily: [],
    hourly: [],
    unavailableReason: 'outside_forecast_range',
  });
  const legacy = weatherContextToLegacyForecast({
    weatherContext: outside,
    modifiers: [],
    locationName: 'Osaka',
    tripDate: '2026-12-01',
  });
  assert.strictEqual(legacy.hasRainExpected, false);
  assert.strictEqual(legacy.planningMode, 'seasonal');
  assert.ok(legacy.planningMessage?.includes('対象期間外'));
  assert.deepStrictEqual(legacy.seasonalContext?.riskNotes ?? [], []);
  assert.strictEqual(legacy.days.length, 0);
  assert.strictEqual(legacy.unavailableReason, 'outside_forecast_range');
});

check('JP/KR geocode candidates prefer Latin aliases over city,country', () => {
  const korea = buildWeatherGeocodeCandidates({ destination: '韓国' });
  assert.ok(korea.includes('Seoul'), `expected Seoul in ${korea.join('|')}`);
  const osaka = buildWeatherGeocodeCandidates({ city: '大阪', country: '日本' });
  assert.ok(osaka.includes('Osaka'), `expected Osaka in ${osaka.join('|')}`);
});

console.log(`\nverify:weather-plan — ${passed} PASS`);
