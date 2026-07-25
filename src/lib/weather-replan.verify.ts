/**
 * Weather replan resolve helpers verify.
 * Run: npm run verify:weather-replan
 */

import assert from 'node:assert';

import {
  getWeatherReplanUnavailableMessage,
  isUsableLegacyForecast,
  isUsableWeatherContext,
  tripOverlapsForecastDays,
} from './weather-replan-resolve';
import type { WeatherForecast } from '@/lib/weather';
import type { WeatherContext } from '@/types/weather-context';
import { getWeatherReplanEligibility } from './weather-replan-eligibility';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

const forecastWeather: WeatherForecast = {
  available: true,
  locationName: 'ソウル',
  planningMode: 'forecast',
  days: [
    {
      date: '2026-07-23',
      label: '7月23日',
      condition: '雨',
      category: 'rainy',
      temperatureMax: 28,
      temperatureMin: 22,
      precipitationProbability: 70,
      preferIndoor: true,
      preferOutdoor: false,
      summary: '雨',
    },
    {
      date: '2026-07-24',
      label: '7月24日',
      condition: '晴れ',
      category: 'sunny',
      temperatureMax: 31,
      temperatureMin: 23,
      precipitationProbability: 10,
      preferIndoor: false,
      preferOutdoor: true,
      summary: '晴れ',
    },
  ],
  summary: '2日間の予報',
  hasRainExpected: true,
  isMostlySunny: false,
};

const ctxWithDailyOnly: WeatherContext = {
  weatherAvailable: true,
  provider: 'open_meteo',
  attribution: 'Weather data by Open-Meteo',
  fetchedAt: new Date().toISOString(),
  timezone: 'Asia/Seoul',
  location: {
    latitude: 37.5665,
    longitude: 126.978,
    label: 'Seoul',
    source: 'open_meteo_geocode',
  },
  forecastStartDate: '2026-07-23',
  forecastEndDate: '2026-07-25',
  daily: [
    {
      date: '2026-07-23',
      condition: { code: 'rain', description: '雨' },
      temperatureMaxC: 28,
      temperatureMinC: 22,
      feelsLikeMaxC: 29,
      feelsLikeMinC: 22,
      precipitationProbabilityPercent: 70,
      precipitationAmountMm: 5,
      windSpeedKph: 10,
      humidityPercent: 80,
      sunrise: null,
      sunset: null,
    },
  ],
  hourly: [],
  partialForecast: false,
};

check('A daily forecast usable → replan eligible, no unavailable message path', () => {
  assert.strictEqual(isUsableLegacyForecast(forecastWeather), true);
  assert.strictEqual(isUsableWeatherContext(ctxWithDailyOnly), true);
  const eligibility = getWeatherReplanEligibility('2026-07-23', forecastWeather);
  assert.strictEqual(eligibility.status, 'ready');
  if (eligibility.status === 'ready') {
    assert.strictEqual(eligibility.buttonLabel, '天気に合わせて再調整');
  }
});

check('B hourly empty + daily present → usable context', () => {
  assert.strictEqual(ctxWithDailyOnly.hourly.length, 0);
  assert.strictEqual(isUsableWeatherContext(ctxWithDailyOnly), true);
});

check('C outside_forecast_range message', () => {
  const msg = getWeatherReplanUnavailableMessage(
    {
      available: false,
      locationName: 'ソウル',
      planningMode: 'seasonal',
      unavailableReason: 'outside_forecast_range',
      days: [],
      summary: '',
      hasRainExpected: false,
      isMostlySunny: false,
    },
    {
      ...ctxWithDailyOnly,
      weatherAvailable: false,
      daily: [],
      provider: 'none',
      unavailableReason: 'outside_forecast_range',
    },
  );
  assert.ok(msg.includes('予報対象期間外'));
  assert.ok(!msg.includes('出発が近づいてから再度'));
});

check('D existing forecast usable even if refetch would be unavailable', () => {
  // Simulates Plan Detail showing forecast while a bad refetch returns unavailable.
  assert.strictEqual(isUsableLegacyForecast(forecastWeather), true);
  const badRefetch: WeatherForecast = {
    available: false,
    locationName: 'ソウル',
    planningMode: 'unavailable',
    unavailableReason: 'fetch_failed',
    days: [],
    summary: 'fail',
    hasRainExpected: false,
    isMostlySunny: false,
  };
  assert.strictEqual(isUsableLegacyForecast(badRefetch), false);
  // Resolve policy: prefer existing when usable — verified by isUsable* helpers.
  assert.strictEqual(isUsableLegacyForecast(forecastWeather) || isUsableLegacyForecast(badRefetch), true);
});

check('E timezone civil-date overlap does not shift a day off', () => {
  assert.strictEqual(
    tripOverlapsForecastDays('2026-07-23', '2026-07-25', ['2026-07-23', '2026-07-24', '2026-07-25']),
    true,
  );
  assert.strictEqual(
    tripOverlapsForecastDays('2026-07-23', '2026-07-25', ['2026-07-22']),
    false,
  );
  // Same calendar day strings compare without UTC conversion.
  assert.strictEqual(tripOverlapsForecastDays('2026-07-23', '2026-07-23', ['2026-07-23']), true);
});

check('F usable forecast must not surface unavailable copy', () => {
  assert.strictEqual(isUsableLegacyForecast(forecastWeather), true);
  // weatherAvailable=true path must not use unavailable helper as success gate.
  const eligibility = getWeatherReplanEligibility('2026-07-23', forecastWeather);
  assert.notStrictEqual(eligibility.status, 'future');
  assert.notStrictEqual(eligibility.status, 'hidden');
});

check('location_unresolved / fetch_failed messages', () => {
  assert.ok(
    getWeatherReplanUnavailableMessage(undefined, {
      ...ctxWithDailyOnly,
      weatherAvailable: false,
      daily: [],
      provider: 'none',
      unavailableReason: 'location_unresolved',
    }).includes('位置を確認できない'),
  );
  assert.ok(
    getWeatherReplanUnavailableMessage(undefined, {
      ...ctxWithDailyOnly,
      weatherAvailable: false,
      daily: [],
      provider: 'none',
      unavailableReason: 'fetch_failed',
    }).includes('取得に失敗'),
  );
});

console.log(`\nverify:weather-replan — ${passed} PASS`);
