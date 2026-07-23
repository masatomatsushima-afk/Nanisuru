/**
 * Google Weather API 単独実通信検証（プラン生成・Places ランキングとは無関係）。
 *
 * - 稼働中の Expo dev server の POST /api/weather-context を呼ぶ
 * - Seoul / Osaka の 2 ケースを検証
 * - HTTP status / weatherAvailable / dailyCount / hourlyCount / timezone / unavailableReason のみ表示
 * - API キーはこのスクリプトが読み書きしない
 *
 * 前提: 別ターミナルで `npm run dev:phone`（または expo start）が起動していること
 * 実行: npm run verify:google-weather
 * ベースURL: WEATHER_CONTEXT_BASE_URL=http://localhost:8091 npm run verify:google-weather
 */

const DEFAULT_BASE_URL = 'http://localhost:8091';

type WeatherContextApiResponse = {
  ok?: boolean;
  weatherContext?: {
    weatherAvailable?: boolean;
    timezone?: string | null;
    daily?: unknown[];
    hourly?: unknown[];
    partialForecast?: boolean;
    unavailableReason?: string;
    provider?: string;
  };
};

type TestCase = {
  label: string;
  body: {
    city: string;
    country: string;
    startDate: string;
    endDate: string;
    coordinates: { latitude: number; longitude: number };
  };
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

async function runCase(baseUrl: string, testCase: TestCase): Promise<void> {
  const url = `${baseUrl}/api/weather-context`;
  console.log(`--- ${testCase.label} ---`);
  console.log(`POST ${url}`);
  console.log(
    `body: city=${testCase.body.city}, country=${testCase.body.country}, ` +
      `${testCase.body.startDate}..${testCase.body.endDate}`,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase.body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[FAIL] dev server に到達できませんでした。');
    console.error(`  詳細: ${message}`);
    console.error('  → 別ターミナルで `npm run dev:phone` が起動しているか確認してください。');
    process.exitCode = 1;
    return;
  }

  const httpStatus = response.status;
  let data: WeatherContextApiResponse;
  try {
    data = (await response.json()) as WeatherContextApiResponse;
  } catch {
    console.error('[FAIL] JSON 解析に失敗');
    console.error(`  HTTP status: ${httpStatus}`);
    process.exitCode = 1;
    return;
  }

  const ctx = data.weatherContext;
  console.log('=== 結果 ===');
  console.log(`HTTP status: ${httpStatus}`);
  console.log(`ok: ${data.ok === true}`);
  console.log(`weatherAvailable: ${ctx?.weatherAvailable ?? false}`);
  console.log(`dailyCount: ${ctx?.daily?.length ?? 0}`);
  console.log(`hourlyCount: ${ctx?.hourly?.length ?? 0}`);
  console.log(`timezone: ${ctx?.timezone ?? null}`);
  console.log(`unavailableReason: ${ctx?.unavailableReason ?? null}`);
  console.log(`partialForecast: ${ctx?.partialForecast ?? false}`);
  console.log(`provider: ${ctx?.provider ?? null}`);
  console.log('');

  if (httpStatus !== 200 || data.ok !== true) {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const baseUrl = (process.env.WEATHER_CONTEXT_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const window = tripWindowNearToday();

  console.log('--- Google Weather 単独実通信検証 ---');
  console.log(`対象ベースURL: ${baseUrl}`);
  console.log('（APIキーはこのスクリプトでは読み書きしません）');
  console.log('注意: 既定は Open-Meteo。Google を試す場合はサーバー側で WEATHER_PROVIDER=google');
  console.log('日本・韓国は Google Weather 非対応のため unsupported_location になり得ます。');
  console.log('');

  const cases: TestCase[] = [
    {
      label: 'Seoul, Korea',
      body: {
        city: 'Seoul',
        country: 'Korea',
        ...window,
        // Known real city coordinates (not invented for weather); also exercises destination_coordinates path.
        coordinates: { latitude: 37.5665, longitude: 126.978 },
      },
    },
    {
      label: 'Osaka, Japan',
      body: {
        city: 'Osaka',
        country: 'Japan',
        ...window,
        coordinates: { latitude: 34.6937, longitude: 135.5023 },
      },
    },
  ];

  for (const testCase of cases) {
    await runCase(baseUrl, testCase);
  }
}

main().catch((error) => {
  console.error('[FAIL] unexpected', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
