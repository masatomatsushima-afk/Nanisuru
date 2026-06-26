import type { TripDurationOption } from '@/types/plan';
import type { CustomTripDuration } from '@/types/trip-schedule';

import { getDayCountForDuration } from './trip-duration';

export type WeatherCategory = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'snow';

export type WeatherDayForecast = {
  date: string;
  label: string;
  condition: string;
  category: WeatherCategory;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  preferIndoor: boolean;
  preferOutdoor: boolean;
  summary: string;
};

export type WeatherForecast = {
  locationName: string;
  days: WeatherDayForecast[];
  summary: string;
  hasRainExpected: boolean;
  isMostlySunny: boolean;
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
};

type ForecastResponse = {
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayIsoDate(): string {
  return formatIsoDate(new Date());
}

export function formatTripDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

export function getTripDateRange(
  startDate: string,
  tripDuration: TripDurationOption,
  options?: { endDate?: string; customDuration?: CustomTripDuration | null },
): { startDate: string; endDate: string; dayCount: number } {
  if (options?.endDate) {
    const start = new Date(`${startDate}T12:00:00`).getTime();
    const end = new Date(`${options.endDate}T12:00:00`).getTime();
    const diffDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
    const dayCount = Math.max(1, diffDays + 1);
    return { startDate, endDate: options.endDate, dayCount };
  }

  const dayCount = getDayCountForDuration(tripDuration, options?.customDuration);
  const endDate = addDaysToIsoDate(startDate, dayCount - 1);
  return { startDate, endDate, dayCount };
}

function interpretWeatherCode(code: number): { condition: string; category: WeatherCategory } {
  if (code === 0) return { condition: '快晴', category: 'sunny' };
  if (code === 1) return { condition: '晴れ', category: 'sunny' };
  if (code === 2) return { condition: '一部曇り', category: 'partly_cloudy' };
  if (code === 3) return { condition: '曇り', category: 'cloudy' };
  if (code === 45 || code === 48) return { condition: '霧', category: 'cloudy' };
  if (code >= 51 && code <= 57) return { condition: '霧雨', category: 'rainy' };
  if (code >= 61 && code <= 67) return { condition: '雨', category: 'rainy' };
  if (code >= 71 && code <= 77) return { condition: '雪', category: 'snow' };
  if (code >= 80 && code <= 82) return { condition: 'にわか雨', category: 'rainy' };
  if (code >= 85 && code <= 86) return { condition: 'にわか雪', category: 'snow' };
  if (code >= 95) return { condition: '雷雨', category: 'rainy' };
  return { condition: 'くもり', category: 'cloudy' };
}

function classifyDay(
  category: WeatherCategory,
  precipitationProbability: number,
): { preferIndoor: boolean; preferOutdoor: boolean } {
  const isRainyCategory = category === 'rainy' || category === 'snow';
  const preferIndoor = isRainyCategory || precipitationProbability >= 50;
  const preferOutdoor =
    !preferIndoor &&
    (category === 'sunny' || category === 'partly_cloudy') &&
    precipitationProbability < 40;

  return { preferIndoor, preferOutdoor };
}

async function geocodeLocation(location: string): Promise<{ name: string; latitude: number; longitude: number }> {
  const query = location.trim();
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}` +
    '&count=5&language=ja&format=json';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('場所の天気情報を取得できませんでした');
  }

  const data = (await response.json()) as GeocodingResponse;
  const result = data.results?.[0];

  if (!result) {
    throw new Error(`「${query}」の天気情報が見つかりませんでした`);
  }

  const name = [result.name, result.admin1, result.country].filter(Boolean).join('・');
  return {
    name,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

async function fetchDailyForecast(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): Promise<ForecastResponse['daily']> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    `&timezone=auto&start_date=${startDate}&end_date=${endDate}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('天気予報の取得に失敗しました');
  }

  const data = (await response.json()) as ForecastResponse;
  if (!data.daily?.time?.length) {
    throw new Error('天気予報データがありません');
  }

  return data.daily;
}

function buildOverallSummary(days: WeatherDayForecast[]): string {
  if (days.length === 0) return '天気情報なし';

  const rainyDays = days.filter((day) => day.preferIndoor).length;
  const sunnyDays = days.filter((day) => day.preferOutdoor).length;

  if (days.length === 1) {
    const day = days[0];
    if (day.preferIndoor) {
      return `${day.label}は${day.condition}の予報。屋内スポット中心がおすすめです。`;
    }
    if (day.preferOutdoor) {
      return `${day.label}は${day.condition}の予報。屋外アクティビティを楽しめます。`;
    }
    return `${day.label}は${day.condition}の予報。天候に合わせたプランを提案します。`;
  }

  if (rainyDays === days.length) {
    return `${days.length}日間とも雨の可能性あり。屋内中心のプランがおすすめです。`;
  }
  if (sunnyDays === days.length) {
    return `${days.length}日間とも晴れの予報。屋外スポットを積極的に組み込みます。`;
  }
  if (rainyDays > 0) {
    return `${days.length}日間のうち${rainyDays}日は雨の可能性。天候に合わせて屋内・屋外を使い分けます。`;
  }
  return `${days.length}日間の天気を確認しました。日ごとに最適なスポットを提案します。`;
}

export async function fetchWeatherForecast(input: {
  location: string;
  startDate: string;
  tripDuration: TripDurationOption;
  endDate?: string;
  customDuration?: CustomTripDuration | null;
}): Promise<WeatherForecast> {
  const { startDate, endDate } = getTripDateRange(input.startDate, input.tripDuration, {
    endDate: input.endDate,
    customDuration: input.customDuration,
  });
  const geocoded = await geocodeLocation(input.location);
  const daily = await fetchDailyForecast(geocoded.latitude, geocoded.longitude, startDate, endDate);

  if (!daily) {
    throw new Error('天気予報データがありません');
  }

  const days: WeatherDayForecast[] = daily.time.map((date, index) => {
    const { condition, category } = interpretWeatherCode(daily.weather_code[index] ?? 3);
    const temperatureMax = Math.round(daily.temperature_2m_max[index] ?? 0);
    const temperatureMin = Math.round(daily.temperature_2m_min[index] ?? 0);
    const precipitationProbability = daily.precipitation_probability_max[index] ?? 0;
    const { preferIndoor, preferOutdoor } = classifyDay(category, precipitationProbability);
    const label = formatTripDateLabel(date);

    return {
      date,
      label,
      condition,
      category,
      temperatureMax,
      temperatureMin,
      precipitationProbability,
      preferIndoor,
      preferOutdoor,
      summary: `最高${temperatureMax}℃ / 最低${temperatureMin}℃・降水確率${precipitationProbability}%`,
    };
  });

  const summary = buildOverallSummary(days);

  return {
    locationName: geocoded.name,
    days,
    summary,
    hasRainExpected: days.some((day) => day.preferIndoor),
    isMostlySunny: days.every((day) => day.preferOutdoor),
  };
}

export function getWeatherIcon(category: WeatherCategory): string {
  switch (category) {
    case 'sunny':
      return '☀️';
    case 'partly_cloudy':
      return '⛅';
    case 'cloudy':
      return '☁️';
    case 'rainy':
      return '🌧';
    case 'snow':
      return '❄️';
    default:
      return '🌤';
  }
}
