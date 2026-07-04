import type { TripDurationOption } from '@/types/plan';
import type { CustomTripDuration } from '@/types/trip-schedule';

import {
  createSeasonalWeatherContextForecast,
  getDaysUntilDeparture,
  getWeatherPlanningMessage,
  getWeatherPlanningMode,
  isWithinForecastHorizon,
  WEATHER_PLANNING_MESSAGES,
  type SeasonalWeatherContext,
  type WeatherPlanningMode,
} from './weather-planning';
import { getDayCountForDuration } from './trip-duration';

export type { SeasonalWeatherContext, WeatherPlanningMode };

export type WeatherCategory = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'snow' | 'unknown';

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
  available: boolean;
  locationName: string;
  /** Resolved city/area used for weather API lookup (may differ from trip destination). */
  location?: string;
  /** Geocoding query used when different from the trip destination (e.g. 韓国 → Seoul). */
  searchLocation?: string;
  planningMode?: WeatherPlanningMode;
  planningMessage?: string;
  rescheduleNote?: string;
  seasonalContext?: SeasonalWeatherContext;
  days: WeatherDayForecast[];
  summary: string;
  hasRainExpected: boolean;
  isMostlySunny: boolean;
  temperature?: number | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  rainChance?: number | null;
  condition?: WeatherCategory;
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

type CountryWeatherMapping = {
  patterns: RegExp[];
  city: string;
};

const COUNTRY_WEATHER_MAPPINGS: CountryWeatherMapping[] = [
  {
    patterns: [
      /^韓国(?:旅行|観光|ツアー)?$/i,
      /^korea$/i,
      /^south\s*korea$/i,
      /^대한민국$/i,
      /^republic of korea$/i,
    ],
    city: 'Seoul',
  },
  {
    patterns: [/^日本(?:旅行|観光|ツアー)?$/i, /^japan$/i, /^にほん$/i, /^ニホン$/i],
    city: 'Tokyo',
  },
  {
    patterns: [/^オーストラリア(?:旅行|観光|ツアー)?$/i, /^australia$/i],
    city: 'Sydney',
  },
  {
    patterns: [/^タイ(?:旅行|観光|ツアー)?$/i, /^thailand$/i],
    city: 'Bangkok',
  },
  {
    patterns: [/^フランス(?:旅行|観光|ツアー)?$/i, /^france$/i],
    city: 'Paris',
  },
  {
    patterns: [
      /^アメリカ(?:旅行|観光|ツアー)?$/i,
      /^usa$/i,
      /^u\.?s\.?a\.?$/i,
      /^united\s*states$/i,
      /^united\s*states of america$/i,
      /^america$/i,
    ],
    city: 'New York',
  },
];

/** Cities/regions that should be geocoded as-is (not mapped to a default country city). */
const KNOWN_WEATHER_CITY_PATTERNS: RegExp[] = [
  /^大阪$/,
  /^東京$/,
  /^京都$/,
  /^神戸$/,
  /^名古屋$/,
  /^福岡$/,
  /^ソウル$/,
  /^釜山$/,
  /^済州$/,
  /^シドニー$/,
  /^ケアンズ$/,
  /^メルボルン$/,
  /^バンコク$/,
  /^パリ$/,
  /^ニューヨーク$/,
  /^osaka$/i,
  /^tokyo$/i,
  /^kyoto$/i,
  /^seoul$/i,
  /^busan$/i,
  /^cairns$/i,
  /^melbourne$/i,
  /^sydney$/i,
  /^bangkok$/i,
  /^paris$/i,
  /^new\s*york$/i,
];

function stripTravelSuffix(destination: string): string {
  return destination
    .replace(/(旅行|観光|ツアー|trip|travel|へ|への)$/i, '')
    .trim();
}

/** Map broad country/region names to a default city for weather geocoding only. */
export function resolveWeatherLocation(destination: string): string {
  const normalized = destination.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!normalized) return destination;

  const stripped = stripTravelSuffix(normalized);
  const candidates = [normalized, stripped, normalized.toLowerCase(), stripped.toLowerCase()];

  if (candidates.some((value) => KNOWN_WEATHER_CITY_PATTERNS.some((pattern) => pattern.test(value)))) {
    return normalized;
  }

  for (const entry of COUNTRY_WEATHER_MAPPINGS) {
    if (entry.patterns.some((pattern) => candidates.some((value) => pattern.test(value)))) {
      return entry.city;
    }
  }

  return normalized;
}

export function createUnavailableWeatherForecast(
  destination: string,
  weatherLocation?: string,
): WeatherForecast {
  const resolved = weatherLocation ?? resolveWeatherLocation(destination);
  return {
    available: false,
    locationName: destination,
    location: resolved,
    searchLocation: resolved !== destination.trim() ? resolved : undefined,
    planningMode: 'unavailable',
    planningMessage: WEATHER_PLANNING_MESSAGES.unavailable,
    rescheduleNote: WEATHER_PLANNING_MESSAGES.rescheduleNote,
    days: [],
    summary: '天気情報は取得できませんでした',
    hasRainExpected: false,
    isMostlySunny: false,
    temperature: null,
    minTemperature: null,
    maxTemperature: null,
    rainChance: null,
    condition: 'unknown',
  };
}

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

async function geocodeLocation(
  location: string,
): Promise<{ name: string; latitude: number; longitude: number } | null> {
  const query = location.trim();
  if (!query) return null;

  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}` +
      '&count=5&language=ja&format=json';

    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[Weather] geocode request failed', { query, status: response.status });
      return null;
    }

    const data = (await response.json()) as GeocodingResponse;
    const result = data.results?.[0];

    if (!result) {
      console.warn('[Weather] geocode returned no results', { query });
      return null;
    }

    const name = [result.name, result.admin1, result.country].filter(Boolean).join('・');
    return {
      name,
      latitude: result.latitude,
      longitude: result.longitude,
    };
  } catch (error) {
    console.warn('[Weather] geocode failed', { query, error });
    return null;
  }
}

async function fetchDailyForecast(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): Promise<ForecastResponse['daily'] | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      `&timezone=auto&start_date=${startDate}&end_date=${endDate}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[Weather] forecast request failed', { status: response.status });
      return null;
    }

    const data = (await response.json()) as ForecastResponse;
    if (!data.daily?.time?.length) {
      console.warn('[Weather] forecast returned no daily data');
      return null;
    }

    return data.daily;
  } catch (error) {
    console.warn('[Weather] forecast fetch failed', error);
    return null;
  }
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

async function fetchWeatherForecastForQuery(
  tripDestination: string,
  geocodeQuery: string,
  input: {
    startDate: string;
    endDate: string;
  },
): Promise<WeatherForecast | null> {
  const geocoded = await geocodeLocation(geocodeQuery);
  if (!geocoded) {
    return null;
  }

  const daily = await fetchDailyForecast(
    geocoded.latitude,
    geocoded.longitude,
    input.startDate,
    input.endDate,
  );

  if (!daily) {
    return null;
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
  const firstDay = days[0];

  return {
    available: true,
    locationName: tripDestination,
    location: geocodeQuery,
    searchLocation: geocodeQuery !== tripDestination ? geocodeQuery : undefined,
    days,
    summary: geocodeQuery !== tripDestination
      ? `${summary}（天気参照: ${geocoded.name}）`
      : summary,
    hasRainExpected: days.some((day) => day.preferIndoor),
    isMostlySunny: days.every((day) => day.preferOutdoor),
    temperature: firstDay ? firstDay.temperatureMax : null,
    minTemperature: firstDay ? firstDay.temperatureMin : null,
    maxTemperature: firstDay ? firstDay.temperatureMax : null,
    rainChance: firstDay ? firstDay.precipitationProbability : null,
    condition: firstDay?.category,
  };
}

export function createSeasonalWeatherForecast(
  destination: string,
  departureDate: string,
): WeatherForecast {
  const weatherLocation = resolveWeatherLocation(destination);
  const { seasonalContext, summary, hasRainExpected } = createSeasonalWeatherContextForecast(
    destination,
    departureDate,
    weatherLocation,
  );

  return {
    available: true,
    locationName: destination,
    location: weatherLocation,
    searchLocation: weatherLocation !== destination.trim() ? weatherLocation : undefined,
    planningMode: 'seasonal',
    planningMessage: WEATHER_PLANNING_MESSAGES.seasonal,
    rescheduleNote: WEATHER_PLANNING_MESSAGES.rescheduleNote,
    seasonalContext,
    days: [],
    summary,
    hasRainExpected,
    isMostlySunny: false,
    temperature: null,
    minTemperature: null,
    maxTemperature: null,
    rainChance: null,
    condition: 'unknown',
  };
}

export { getWeatherPlanningMode, getDaysUntilDeparture, isWithinForecastHorizon };

/**
 * Resolve weather context for trip planning: forecast when soon, seasonal guidance when far ahead.
 * Never throws — returns unavailable fallback on fetch failure.
 */
export async function resolveWeatherForTrip(input: {
  location: string;
  startDate: string;
  tripDuration: TripDurationOption;
  endDate?: string;
  customDuration?: CustomTripDuration | null;
}): Promise<WeatherForecast> {
  const tripDestination = input.location.trim();
  if (!tripDestination) {
    return createUnavailableWeatherForecast(tripDestination);
  }

  const daysUntil = getDaysUntilDeparture(input.startDate);
  const weatherLocation = resolveWeatherLocation(tripDestination);
  console.log('[Weather] resolved location', {
    destination: tripDestination,
    weatherLocation,
    daysUntil,
  });

  if (!isWithinForecastHorizon(input.startDate)) {
    const mode = getWeatherPlanningMode(input.startDate);
    console.log('[Weather] using seasonal guidance', {
      destination: tripDestination,
      departureDate: input.startDate,
      mode,
      daysUntil,
    });
    return createSeasonalWeatherForecast(tripDestination, input.startDate);
  }

  const forecast = await fetchWeatherForecast(input);
  if (forecast.available) {
    return {
      ...forecast,
      planningMode: 'forecast',
      planningMessage: getWeatherPlanningMessage('forecast'),
    };
  }

  return {
    ...createUnavailableWeatherForecast(tripDestination, weatherLocation),
    planningMode: 'unavailable',
    planningMessage: WEATHER_PLANNING_MESSAGES.unavailable,
    rescheduleNote: WEATHER_PLANNING_MESSAGES.rescheduleNote,
  };
}

/**
 * Fetch weather for a trip destination. Never throws — returns unavailable fallback on failure.
 * Broad destinations (countries) are mapped to a default city via resolveWeatherLocation.
 * The trip destination label is preserved; only the geocoding query may differ.
 */
export async function fetchWeatherForecast(input: {
  location: string;
  startDate: string;
  tripDuration: TripDurationOption;
  endDate?: string;
  customDuration?: CustomTripDuration | null;
}): Promise<WeatherForecast> {
  const tripDestination = input.location.trim();
  if (!tripDestination) {
    return createUnavailableWeatherForecast(tripDestination);
  }

  try {
    const { startDate, endDate } = getTripDateRange(input.startDate, input.tripDuration, {
      endDate: input.endDate,
      customDuration: input.customDuration,
    });

    const weatherLocation = resolveWeatherLocation(tripDestination);
    console.log('[Weather] resolved location', {
      destination: tripDestination,
      weatherLocation,
    });

    const queries =
      weatherLocation === tripDestination ? [tripDestination] : [weatherLocation, tripDestination];

    for (const query of queries) {
      const forecast = await fetchWeatherForecastForQuery(tripDestination, query, {
        startDate,
        endDate,
      });
      if (forecast) {
        return forecast;
      }
    }

    console.warn('[Weather] fetch failed, continuing without weather', {
      destination: tripDestination,
      weatherLocation,
    });
    return createUnavailableWeatherForecast(tripDestination, weatherLocation);
  } catch (error) {
    console.warn('[Weather] fetch failed, continuing without weather', error);
    return createUnavailableWeatherForecast(
      tripDestination,
      resolveWeatherLocation(tripDestination),
    );
  }
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
    case 'unknown':
      return '🌤';
    default:
      return '🌤';
  }
}

export function isWeatherFetchErrorMessage(message: string): boolean {
  return /天気情報|天気予報|weather/i.test(message);
}
