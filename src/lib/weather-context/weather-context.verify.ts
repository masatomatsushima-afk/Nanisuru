/**
 * Weather Context Phase 1 — offline unit verify (+ soft provider checks).
 * Run: npm run verify:weather-context
 */

import assert from 'node:assert';

import type { WeatherContext } from '@/types/weather-context';
import {
  buildWeatherCacheKey,
  clearWeatherCacheForTests,
  getWeatherCache,
  setWeatherCache,
} from './weather-context-cache';
import {
  getServerGoogleWeatherApiKey,
  isGoogleUnsupportedLocation,
} from './google-weather-client';
import {
  buildWeatherContextFromGoogle,
  createUnavailableWeatherContext,
  normalizeDailyForecast,
  normalizeHourlyForecast,
} from './weather-context-normalize';
import {
  buildWeatherContextFromOpenMeteo,
  mapOpenMeteoWeatherCode,
} from './open-meteo-normalize';
import { enumerateDateRange, finiteNumber, parseIsoDateOnly } from './weather-context-numbers';
import type { GoogleDaysLookupResponse, GoogleHoursLookupResponse } from './google-weather-types';
import { resolveWeatherLocation } from './weather-location-resolver';
import { buildWeatherContext } from './weather-context-service';
import { resolveWeatherProviderMode } from './weather-provider';
import { OPEN_METEO_ATTRIBUTION } from './weather-context-assemble';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

function assertNoNaN(context: WeatherContext): void {
  const nums: Array<number | null | undefined> = [];
  for (const d of context.daily) {
    nums.push(
      d.temperatureMaxC,
      d.temperatureMinC,
      d.feelsLikeMaxC,
      d.feelsLikeMinC,
      d.precipitationProbabilityPercent,
      d.precipitationAmountMm,
      d.windSpeedKph,
      d.humidityPercent,
    );
  }
  for (const h of context.hourly) {
    nums.push(
      h.temperatureC,
      h.feelsLikeC,
      h.precipitationProbabilityPercent,
      h.precipitationAmountMm,
      h.windSpeedKph,
      h.humidityPercent,
    );
  }
  for (const n of nums) {
    if (n === null || n === undefined) continue;
    assert.ok(Number.isFinite(n), `non-finite number found: ${n}`);
  }
}

check('default WEATHER_PROVIDER resolves to open_meteo', () => {
  assert.strictEqual(resolveWeatherProviderMode(undefined), 'open_meteo');
  assert.strictEqual(resolveWeatherProviderMode(''), 'open_meteo');
  assert.strictEqual(resolveWeatherProviderMode('GOOGLE'), 'google');
  assert.strictEqual(resolveWeatherProviderMode('auto'), 'auto');
});

check('API key helper does not read EXPO_PUBLIC_ and tolerates missing key', () => {
  const prev = process.env.GOOGLE_WEATHER_API_KEY;
  const prevPublic = process.env.EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY;
  delete process.env.GOOGLE_WEATHER_API_KEY;
  process.env.EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY = 'should-never-be-used';
  assert.strictEqual(getServerGoogleWeatherApiKey(), undefined);
  if (prev === undefined) delete process.env.GOOGLE_WEATHER_API_KEY;
  else process.env.GOOGLE_WEATHER_API_KEY = prev;
  if (prevPublic === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY;
  else process.env.EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY = prevPublic;
});

check('Google 404 unsupported location is soft-classified', () => {
  assert.strictEqual(isGoogleUnsupportedLocation(404, null), true);
  assert.strictEqual(
    isGoogleUnsupportedLocation(400, {
      error: {
        status: 'NOT_FOUND',
        message: 'Information is not supported for this location. Please try a different location.',
      },
    }),
    true,
  );
  assert.strictEqual(isGoogleUnsupportedLocation(500, { error: { message: 'boom' } }), false);
});

check('createUnavailableWeatherContext sets location_unresolved safely', () => {
  const ctx = createUnavailableWeatherContext({ reason: 'location_unresolved' });
  assert.strictEqual(ctx.weatherAvailable, false);
  assert.strictEqual(ctx.unavailableReason, 'location_unresolved');
  assert.strictEqual(ctx.daily.length, 0);
  assert.strictEqual(ctx.hourly.length, 0);
  assert.strictEqual(ctx.partialForecast, false);
  assert.strictEqual(ctx.provider, 'none');
  assert.strictEqual(ctx.attribution, null);
  assertNoNaN(ctx);
});

check('normalizeDailyForecast maps Google day without inventing missing fields', () => {
  const day = normalizeDailyForecast({
    displayDate: { year: 2026, month: 7, day: 23 },
    maxTemperature: { degrees: 28 },
    minTemperature: { degrees: 18 },
    daytimeForecast: {
      weatherCondition: { type: 'PARTLY_CLOUDY', description: { text: '晴れ時々曇り' } },
      precipitation: { probability: { percent: 20 }, qpf: { quantity: 0 } },
      wind: { speed: { value: 12 } },
      relativeHumidity: 55,
    },
    sunEvents: { sunriseTime: '2026-07-23T20:00:00Z', sunsetTime: '2026-07-24T10:00:00Z' },
  });
  assert.ok(day);
  assert.strictEqual(day!.date, '2026-07-23');
  assert.strictEqual(day!.condition?.code, 'partly_cloudy');
  assert.strictEqual(day!.temperatureMaxC, 28);
  assert.strictEqual(day!.feelsLikeMaxC, null);
  assert.strictEqual(day!.precipitationProbabilityPercent, 20);
  assert.strictEqual(day!.humidityPercent, 55);
});

check('normalize rejects NaN temperatures as null', () => {
  const day = normalizeDailyForecast({
    displayDate: { year: 2026, month: 7, day: 24 },
    maxTemperature: { degrees: Number.NaN },
    minTemperature: { degrees: Number.POSITIVE_INFINITY },
  });
  assert.ok(day);
  assert.strictEqual(day!.temperatureMaxC, null);
  assert.strictEqual(day!.temperatureMinC, null);
});

check('Open-Meteo WMO codes map without inventing', () => {
  assert.strictEqual(mapOpenMeteoWeatherCode(0)?.code, 'clear');
  assert.strictEqual(mapOpenMeteoWeatherCode(61)?.code, 'rain');
  assert.strictEqual(mapOpenMeteoWeatherCode(null), null);
});

check('Open-Meteo normalize builds WeatherContext with attribution', () => {
  const ctx = buildWeatherContextFromOpenMeteo({
    location: {
      latitude: 37.5665,
      longitude: 126.978,
      label: 'Seoul',
      source: 'destination_coordinates',
    },
    startDate: '2026-07-22',
    endDate: '2026-07-23',
    data: {
      timezone: 'Asia/Seoul',
      daily: {
        time: ['2026-07-22', '2026-07-23'],
        weather_code: [1, 3],
        temperature_2m_max: [30, 28],
        temperature_2m_min: [22, 21],
        apparent_temperature_max: [31, 29],
        apparent_temperature_min: [21, 20],
        precipitation_probability_max: [10, 40],
        precipitation_sum: [0, 1.2],
        sunrise: ['2026-07-22T05:20', '2026-07-23T05:21'],
        sunset: ['2026-07-22T19:50', '2026-07-23T19:49'],
      },
      hourly: {
        time: ['2026-07-22T12:00', '2026-07-23T12:00'],
        temperature_2m: [28, 27],
        apparent_temperature: [29, 28],
        relative_humidity_2m: [55, 60],
        precipitation_probability: [10, 40],
        precipitation: [0, 0.2],
        weather_code: [1, 3],
        wind_speed_10m: [12, 14],
      },
    },
  });
  assert.strictEqual(ctx.weatherAvailable, true);
  assert.strictEqual(ctx.provider, 'open_meteo');
  assert.strictEqual(ctx.attribution, OPEN_METEO_ATTRIBUTION);
  assert.strictEqual(ctx.timezone, 'Asia/Seoul');
  assert.strictEqual(ctx.daily.length, 2);
  assert.strictEqual(ctx.hourly.length, 2);
  assert.strictEqual(ctx.partialForecast, false);
  assertNoNaN(ctx);
});

check('outside_forecast_range when trip has no overlap with provider days', () => {
  const daysResponse: GoogleDaysLookupResponse = {
    timeZone: { id: 'Asia/Seoul' },
    forecastDays: [
      {
        displayDate: { year: 2026, month: 7, day: 22 },
        maxTemperature: { degrees: 30 },
        daytimeForecast: { weatherCondition: { type: 'CLEAR' } },
      },
    ],
  };
  const hoursResponse: GoogleHoursLookupResponse = { forecastHours: [] };
  const ctx = buildWeatherContextFromGoogle({
    location: {
      latitude: 37.5665,
      longitude: 126.978,
      label: 'Seoul',
      source: 'destination_coordinates',
    },
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    daysResponse,
    hoursResponse,
  });
  assert.strictEqual(ctx.weatherAvailable, false);
  assert.strictEqual(ctx.unavailableReason, 'outside_forecast_range');
  assert.strictEqual(ctx.daily.length, 0);
  assertNoNaN(ctx);
});

check('partialForecast when only some trip days are covered', () => {
  const daysResponse: GoogleDaysLookupResponse = {
    timeZone: { id: 'Asia/Tokyo' },
    forecastDays: [
      {
        displayDate: { year: 2026, month: 7, day: 22 },
        maxTemperature: { degrees: 31 },
        daytimeForecast: {
          weatherCondition: { type: 'RAIN' },
          precipitation: { probability: { percent: 70 } },
        },
      },
      {
        displayDate: { year: 2026, month: 7, day: 23 },
        maxTemperature: { degrees: 29 },
        daytimeForecast: { weatherCondition: { type: 'CLOUDY' } },
      },
    ],
  };
  const hoursResponse: GoogleHoursLookupResponse = {
    forecastHours: [
      {
        interval: { startTime: '2026-07-22T03:00:00Z' },
        displayDateTime: { year: 2026, month: 7, day: 22, hours: 12 },
        temperature: { degrees: 28 },
        weatherCondition: { type: 'RAIN' },
      },
    ],
  };
  const ctx = buildWeatherContextFromGoogle({
    location: {
      latitude: 34.6937,
      longitude: 135.5023,
      label: 'Osaka',
      source: 'destination_coordinates',
    },
    startDate: '2026-07-22',
    endDate: '2026-07-25',
    daysResponse,
    hoursResponse,
  });
  assert.strictEqual(ctx.weatherAvailable, true);
  assert.strictEqual(ctx.partialForecast, true);
  assert.strictEqual(ctx.daily.length, 2);
  assert.strictEqual(ctx.hourly.length, 1);
  assert.strictEqual(ctx.timezone, 'Asia/Tokyo');
  assert.strictEqual(ctx.provider, 'google_weather');
  assertNoNaN(ctx);
});

check('full coverage sets partialForecast false', () => {
  const daysResponse: GoogleDaysLookupResponse = {
    forecastDays: [
      { displayDate: { year: 2026, month: 7, day: 22 }, maxTemperature: { degrees: 30 } },
      { displayDate: { year: 2026, month: 7, day: 23 }, maxTemperature: { degrees: 29 } },
    ],
  };
  const ctx = buildWeatherContextFromGoogle({
    location: {
      latitude: 37.5,
      longitude: 127.0,
      label: 'Seoul',
      source: 'accommodation',
    },
    startDate: '2026-07-22',
    endDate: '2026-07-23',
    daysResponse,
    hoursResponse: {},
  });
  assert.strictEqual(ctx.weatherAvailable, true);
  assert.strictEqual(ctx.partialForecast, false);
  assert.strictEqual(ctx.daily.length, 2);
});

check('memory cache key includes provider and excludes API key', () => {
  clearWeatherCacheForTests();
  const key = buildWeatherCacheKey({
    provider: 'open_meteo',
    latitude: 37.5665,
    longitude: 126.978,
    startDate: '2026-07-22',
    endDate: '2026-07-24',
  });
  assert.ok(key.startsWith('open_meteo|'));
  assert.ok(!key.includes('key'));
  assert.ok(!key.toLowerCase().includes('api'));
  const sample = createUnavailableWeatherContext({
    reason: 'outside_forecast_range',
    forecastStartDate: '2026-07-22',
    forecastEndDate: '2026-07-24',
  });
  setWeatherCache(key, sample);
  const hit = getWeatherCache(key);
  assert.ok(hit);
  assert.strictEqual(hit!.unavailableReason, 'outside_forecast_range');
  clearWeatherCacheForTests();
});

check('parseIsoDateOnly / enumerateDateRange are strict', () => {
  assert.strictEqual(parseIsoDateOnly('2026-07-22'), '2026-07-22');
  assert.strictEqual(parseIsoDateOnly('2026-13-01'), null);
  assert.strictEqual(parseIsoDateOnly('not-a-date'), null);
  assert.deepStrictEqual(enumerateDateRange('2026-07-22', '2026-07-24'), [
    '2026-07-22',
    '2026-07-23',
    '2026-07-24',
  ]);
  assert.deepStrictEqual(enumerateDateRange('2026-07-24', '2026-07-22'), []);
});

check('finiteNumber rejects Infinity', () => {
  assert.strictEqual(finiteNumber(Number.POSITIVE_INFINITY), null);
  assert.strictEqual(finiteNumber(Number.NaN), null);
  assert.strictEqual(finiteNumber(12.5), 12.5);
});

check('normalizeHourlyForecast requires time + date', () => {
  const bad = normalizeHourlyForecast({ temperature: { degrees: 20 } });
  assert.strictEqual(bad, null);
  const good = normalizeHourlyForecast({
    interval: { startTime: '2026-07-22T01:00:00Z' },
    displayDateTime: { year: 2026, month: 7, day: 22, hours: 10 },
    temperature: { degrees: 21 },
  });
  assert.ok(good);
  assert.strictEqual(good!.temperatureC, 21);
});

async function runAsyncChecks(): Promise<void> {
  await checkAsync(
    'accommodation coordinates win over destination coordinates',
    async () => {
      const resolved = await resolveWeatherLocation({
        city: 'Seoul',
        country: 'Korea',
        accommodation: { name: 'Hotel', latitude: 37.5, longitude: 127.0 },
        coordinates: { latitude: 37.5665, longitude: 126.978 },
      });
      assert.strictEqual(resolved.locationResolved, true);
      assert.strictEqual(resolved.location?.source, 'accommodation');
      assert.strictEqual(resolved.location?.latitude, 37.5);
    },
  );

  await checkAsync('empty location input resolves as unresolved (no invented coords)', async () => {
    const resolved = await resolveWeatherLocation({});
    assert.strictEqual(resolved.locationResolved, false);
    assert.strictEqual(resolved.location, null);
  });

  await checkAsync('buildWeatherContext soft-fails without coordinates', async () => {
    const { weatherContext } = await buildWeatherContext({
      startDate: '2026-07-22',
      endDate: '2026-07-24',
    });
    assert.strictEqual(weatherContext.weatherAvailable, false);
    assert.strictEqual(weatherContext.unavailableReason, 'location_unresolved');
    assertNoNaN(weatherContext);
  });

  await checkAsync(
    'WEATHER_PROVIDER=google missing API key soft-fails after coords resolve',
    async () => {
      const prevKey = process.env.GOOGLE_WEATHER_API_KEY;
      const prevMode = process.env.WEATHER_PROVIDER;
      delete process.env.GOOGLE_WEATHER_API_KEY;
      process.env.WEATHER_PROVIDER = 'google';
      clearWeatherCacheForTests();
      const { weatherContext } = await buildWeatherContext({
        city: 'Seoul',
        country: 'Korea',
        coordinates: { latitude: 37.5665, longitude: 126.978 },
        startDate: '2026-07-22',
        endDate: '2026-07-24',
      });
      assert.strictEqual(weatherContext.weatherAvailable, false);
      assert.strictEqual(weatherContext.unavailableReason, 'missing_api_key');
      assert.ok(weatherContext.location);
      assertNoNaN(weatherContext);
      if (prevKey === undefined) delete process.env.GOOGLE_WEATHER_API_KEY;
      else process.env.GOOGLE_WEATHER_API_KEY = prevKey;
      if (prevMode === undefined) delete process.env.WEATHER_PROVIDER;
      else process.env.WEATHER_PROVIDER = prevMode;
    },
  );

  await checkAsync('same request hits memory cache on second call', async () => {
    clearWeatherCacheForTests();
    const prevMode = process.env.WEATHER_PROVIDER;
    process.env.WEATHER_PROVIDER = 'open_meteo';
    const startDate = '2026-07-22';
    const endDate = '2026-07-23';
    const latitude = 34.6937;
    const longitude = 135.5023;
    const available = buildWeatherContextFromOpenMeteo({
      location: {
        latitude,
        longitude,
        label: 'Osaka',
        source: 'destination_coordinates',
      },
      startDate,
      endDate,
      data: {
        timezone: 'Asia/Tokyo',
        daily: {
          time: ['2026-07-22', '2026-07-23'],
          weather_code: [1, 2],
          temperature_2m_max: [30, 29],
          temperature_2m_min: [22, 21],
        },
        hourly: {
          time: ['2026-07-22T12:00', '2026-07-23T12:00'],
          temperature_2m: [28, 27],
        },
      },
    });
    assert.strictEqual(available.weatherAvailable, true);
    const key = buildWeatherCacheKey({
      provider: 'open_meteo',
      latitude,
      longitude,
      startDate,
      endDate,
    });
    setWeatherCache(key, available);

    const second = await buildWeatherContext({
      coordinates: { latitude, longitude },
      city: 'Osaka',
      country: 'Japan',
      startDate,
      endDate,
    });
    assert.strictEqual(second.cacheHit, true);
    assert.strictEqual(second.weatherContext.weatherAvailable, true);
    assert.strictEqual(second.weatherContext.provider, 'open_meteo');
    assert.strictEqual(second.weatherContext.daily.length, 2);
    clearWeatherCacheForTests();
    if (prevMode === undefined) delete process.env.WEATHER_PROVIDER;
    else process.env.WEATHER_PROVIDER = prevMode;
  });

  console.log(`\nverify:weather-context — ${passed} PASS`);
}

async function checkAsync(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

runAsyncChecks().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
