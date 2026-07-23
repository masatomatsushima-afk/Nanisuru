/**
 * Open-Meteo Weather 実通信検証（APIキー不要）。
 *
 * buildWeatherContext（既定 provider = open_meteo）経由で:
 * - Seoul, Korea
 * - Osaka, Japan
 * - Tokyo, Japan
 * - Paris, France
 *
 * 成功条件:
 * - weatherAvailable: true
 * - provider: open_meteo
 * - dailyCount >= 1
 * - hourlyCount >= 1
 * - timezone あり
 * - unavailableReason なし
 *
 * 実行: npm run verify:open-meteo-weather
 */

import { buildWeatherContext } from '../src/lib/weather-context/weather-context-service';
import { clearWeatherCacheForTests } from '../src/lib/weather-context/weather-context-cache';

type TestCase = {
  label: string;
  city: string;
  country: string;
  coordinates: { latitude: number; longitude: number };
};

function tripWindowNearToday(): { startDate: string; endDate: string } {
  const start = new Date();
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 2);
  const fmt = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function runCase(
  testCase: TestCase,
  window: { startDate: string; endDate: string },
): Promise<boolean> {
  console.log(`--- ${testCase.label} ---`);
  console.log(
    `city=${testCase.city}, country=${testCase.country}, ` +
      `${window.startDate}..${window.endDate}`,
  );

  const { weatherContext, elapsedMs } = await buildWeatherContext({
    city: testCase.city,
    country: testCase.country,
    coordinates: testCase.coordinates,
    startDate: window.startDate,
    endDate: window.endDate,
  });

  const dailyCount = weatherContext.daily.length;
  const hourlyCount = weatherContext.hourly.length;
  const ok =
    weatherContext.weatherAvailable === true &&
    weatherContext.provider === 'open_meteo' &&
    dailyCount >= 1 &&
    hourlyCount >= 1 &&
    Boolean(weatherContext.timezone) &&
    weatherContext.unavailableReason === undefined;

  console.log('=== 結果 ===');
  console.log(`weatherAvailable: ${weatherContext.weatherAvailable}`);
  console.log(`provider: ${weatherContext.provider}`);
  console.log(`attribution: ${weatherContext.attribution}`);
  console.log(`dailyCount: ${dailyCount}`);
  console.log(`hourlyCount: ${hourlyCount}`);
  console.log(`timezone: ${weatherContext.timezone}`);
  console.log(`unavailableReason: ${weatherContext.unavailableReason ?? null}`);
  console.log(`partialForecast: ${weatherContext.partialForecast}`);
  console.log(`elapsedMs: ${elapsedMs}`);
  console.log(ok ? '[PASS]' : '[FAIL]');
  console.log('');

  return ok;
}

async function main(): Promise<void> {
  const prevMode = process.env.WEATHER_PROVIDER;
  process.env.WEATHER_PROVIDER = 'open_meteo';
  clearWeatherCacheForTests();

  const window = tripWindowNearToday();
  console.log('--- Open-Meteo Weather 実通信検証 ---');
  console.log('（APIキー不要 / Google Weather は使いません）');
  console.log('');

  const cases: TestCase[] = [
    {
      label: 'Seoul, Korea',
      city: 'Seoul',
      country: 'Korea',
      coordinates: { latitude: 37.5665, longitude: 126.978 },
    },
    {
      label: 'Osaka, Japan',
      city: 'Osaka',
      country: 'Japan',
      coordinates: { latitude: 34.6937, longitude: 135.5023 },
    },
    {
      label: 'Tokyo, Japan',
      city: 'Tokyo',
      country: 'Japan',
      coordinates: { latitude: 35.6762, longitude: 139.6503 },
    },
    {
      label: 'Paris, France',
      city: 'Paris',
      country: 'France',
      coordinates: { latitude: 48.8566, longitude: 2.3522 },
    },
  ];

  let allPassed = true;
  for (const testCase of cases) {
    const ok = await runCase(testCase, window);
    if (!ok) allPassed = false;
  }

  if (prevMode === undefined) delete process.env.WEATHER_PROVIDER;
  else process.env.WEATHER_PROVIDER = prevMode;

  if (!allPassed) {
    process.exitCode = 1;
    console.error('verify:open-meteo-weather — FAILED');
    return;
  }
  console.log('verify:open-meteo-weather — ALL PASS');
}

main().catch((error) => {
  console.error('[FAIL] unexpected', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
