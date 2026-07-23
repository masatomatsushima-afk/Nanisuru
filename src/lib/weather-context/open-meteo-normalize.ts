/**
 * Normalize Open-Meteo forecast → provider-agnostic WeatherContext slices.
 * Missing fields stay null — never invent values.
 */

import type {
  DailyWeatherForecast,
  HourlyWeatherForecast,
  WeatherCondition,
  WeatherContext,
  WeatherLocation,
} from '@/types/weather-context';
import {
  finalizeWeatherContext,
  OPEN_METEO_ATTRIBUTION,
  createUnavailableWeatherContext,
} from './weather-context-assemble';
import { dateFromIsoTimestamp, finiteInt, finiteNumber, parseIsoDateOnly } from './weather-context-numbers';
import type { OpenMeteoForecastResponse } from './open-meteo-types';

/**
 * WMO weather interpretation codes → shared condition codes + JP label.
 * @see https://open-meteo.com/en/docs
 */
export function mapOpenMeteoWeatherCode(code: number | null): WeatherCondition | null {
  if (code === null || !Number.isFinite(code)) return null;
  const c = Math.trunc(code);

  if (c === 0) return { code: 'clear', description: '快晴' };
  if (c === 1) return { code: 'mostly_clear', description: '晴れ' };
  if (c === 2) return { code: 'partly_cloudy', description: '一部曇り' };
  if (c === 3) return { code: 'cloudy', description: '曇り' };
  if (c === 45 || c === 48) return { code: 'fog', description: '霧' };
  if (c >= 51 && c <= 57) return { code: 'drizzle', description: '霧雨' };
  if (c >= 61 && c <= 67) return { code: 'rain', description: '雨' };
  if (c >= 71 && c <= 77) return { code: 'snow', description: '雪' };
  if (c >= 80 && c <= 82) return { code: 'rain_showers', description: 'にわか雨' };
  if (c >= 85 && c <= 86) return { code: 'snow_showers', description: 'にわか雪' };
  if (c >= 95) return { code: 'thunderstorm', description: '雷雨' };
  return { code: 'unknown', description: null };
}

function atNumber(arr: Array<number | null> | undefined, index: number): number | null {
  if (!arr || index < 0 || index >= arr.length) return null;
  return finiteNumber(arr[index]);
}

function atInt(arr: Array<number | null> | undefined, index: number): number | null {
  if (!arr || index < 0 || index >= arr.length) return null;
  return finiteInt(arr[index]);
}

function atString(arr: Array<string | null> | undefined, index: number): string | null {
  if (!arr || index < 0 || index >= arr.length) return null;
  const v = arr[index];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function normalizeOpenMeteoDaily(
  data: OpenMeteoForecastResponse,
): DailyWeatherForecast[] {
  const times = data.daily?.time ?? [];
  const out: DailyWeatherForecast[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const date = parseIsoDateOnly(times[i] ?? '') ?? dateFromIsoTimestamp(times[i]);
    if (!date) continue;
    const code = atInt(data.daily?.weather_code, i);
    out.push({
      date,
      condition: mapOpenMeteoWeatherCode(code),
      temperatureMaxC: atNumber(data.daily?.temperature_2m_max, i),
      temperatureMinC: atNumber(data.daily?.temperature_2m_min, i),
      feelsLikeMaxC: atNumber(data.daily?.apparent_temperature_max, i),
      feelsLikeMinC: atNumber(data.daily?.apparent_temperature_min, i),
      precipitationProbabilityPercent: atInt(data.daily?.precipitation_probability_max, i),
      precipitationAmountMm: atNumber(data.daily?.precipitation_sum, i),
      windSpeedKph: null, // daily wind not requested
      humidityPercent: null, // daily humidity not requested
      sunrise: atString(data.daily?.sunrise, i),
      sunset: atString(data.daily?.sunset, i),
    });
  }
  return out;
}

export function normalizeOpenMeteoHourly(
  data: OpenMeteoForecastResponse,
): HourlyWeatherForecast[] {
  const times = data.hourly?.time ?? [];
  const out: HourlyWeatherForecast[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const timeRaw = times[i];
    if (typeof timeRaw !== 'string' || !timeRaw.trim()) continue;
    const time = timeRaw.trim();
    const date = dateFromIsoTimestamp(time) ?? parseIsoDateOnly(time.slice(0, 10));
    if (!date) continue;
    const code = atInt(data.hourly?.weather_code, i);
    out.push({
      time,
      date,
      condition: mapOpenMeteoWeatherCode(code),
      temperatureC: atNumber(data.hourly?.temperature_2m, i),
      feelsLikeC: atNumber(data.hourly?.apparent_temperature, i),
      precipitationProbabilityPercent: atInt(data.hourly?.precipitation_probability, i),
      precipitationAmountMm: atNumber(data.hourly?.precipitation, i),
      windSpeedKph: atNumber(data.hourly?.wind_speed_10m, i),
      humidityPercent: atInt(data.hourly?.relative_humidity_2m, i),
    });
  }
  return out;
}

export function buildWeatherContextFromOpenMeteo(params: {
  location: WeatherLocation;
  startDate: string;
  endDate: string;
  data: OpenMeteoForecastResponse;
  fetchedAt?: string;
}): WeatherContext {
  const timezone =
    typeof params.data.timezone === 'string' && params.data.timezone.trim()
      ? params.data.timezone.trim()
      : null;

  const daily = normalizeOpenMeteoDaily(params.data);
  const hourly = normalizeOpenMeteoHourly(params.data);

  if (daily.length === 0 && hourly.length === 0) {
    return createUnavailableWeatherContext({
      reason: 'no_forecast_data',
      location: params.location,
      timezone,
      forecastStartDate: params.startDate,
      forecastEndDate: params.endDate,
      attribution: OPEN_METEO_ATTRIBUTION,
    });
  }

  return finalizeWeatherContext({
    provider: 'open_meteo',
    attribution: OPEN_METEO_ATTRIBUTION,
    location: params.location,
    timezone,
    startDate: params.startDate,
    endDate: params.endDate,
    daily,
    hourly,
    fetchedAt: params.fetchedAt,
  });
}
