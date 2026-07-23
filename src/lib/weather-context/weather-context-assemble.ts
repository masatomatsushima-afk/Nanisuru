/**
 * Assemble provider-normalized daily/hourly rows into a trip-window WeatherContext.
 */

import type {
  DailyWeatherForecast,
  HourlyWeatherForecast,
  WeatherContext,
  WeatherLocation,
  WeatherProviderId,
  WeatherUnavailableReason,
} from '@/types/weather-context';
import { enumerateDateRange, parseIsoDateOnly } from './weather-context-numbers';

export const OPEN_METEO_ATTRIBUTION = 'Weather data by Open-Meteo';
export const GOOGLE_WEATHER_ATTRIBUTION = 'Weather data by Google';

export function createUnavailableWeatherContext(params: {
  reason: WeatherUnavailableReason;
  forecastStartDate?: string | null;
  forecastEndDate?: string | null;
  location?: WeatherLocation | null;
  timezone?: string | null;
  provider?: WeatherProviderId;
  attribution?: string | null;
}): WeatherContext {
  return {
    weatherAvailable: false,
    provider: params.provider ?? 'none',
    attribution: params.attribution ?? null,
    fetchedAt: null,
    timezone: params.timezone ?? null,
    location: params.location ?? null,
    forecastStartDate: params.forecastStartDate ?? null,
    forecastEndDate: params.forecastEndDate ?? null,
    daily: [],
    hourly: [],
    partialForecast: false,
    unavailableReason: params.reason,
  };
}

function sanitizeFinite(value: number | null): number | null {
  if (value === null) return null;
  return Number.isFinite(value) ? value : null;
}

function sanitizeDaily(day: DailyWeatherForecast): DailyWeatherForecast {
  return {
    ...day,
    temperatureMaxC: sanitizeFinite(day.temperatureMaxC),
    temperatureMinC: sanitizeFinite(day.temperatureMinC),
    feelsLikeMaxC: sanitizeFinite(day.feelsLikeMaxC),
    feelsLikeMinC: sanitizeFinite(day.feelsLikeMinC),
    precipitationProbabilityPercent: sanitizeFinite(day.precipitationProbabilityPercent),
    precipitationAmountMm: sanitizeFinite(day.precipitationAmountMm),
    windSpeedKph: sanitizeFinite(day.windSpeedKph),
    humidityPercent: sanitizeFinite(day.humidityPercent),
  };
}

function sanitizeHourly(hour: HourlyWeatherForecast): HourlyWeatherForecast {
  return {
    ...hour,
    temperatureC: sanitizeFinite(hour.temperatureC),
    feelsLikeC: sanitizeFinite(hour.feelsLikeC),
    precipitationProbabilityPercent: sanitizeFinite(hour.precipitationProbabilityPercent),
    precipitationAmountMm: sanitizeFinite(hour.precipitationAmountMm),
    windSpeedKph: sanitizeFinite(hour.windSpeedKph),
    humidityPercent: sanitizeFinite(hour.humidityPercent),
  };
}

/**
 * Filter provider forecasts to the trip date window and set availability flags.
 * Does not invent missing fields — only filters and sanitizes finite numbers.
 */
export function finalizeWeatherContext(params: {
  provider: Exclude<WeatherProviderId, 'none'>;
  attribution: string | null;
  location: WeatherLocation;
  timezone: string | null;
  startDate: string;
  endDate: string;
  daily: DailyWeatherForecast[];
  hourly: HourlyWeatherForecast[];
  fetchedAt?: string;
}): WeatherContext {
  const startDate = parseIsoDateOnly(params.startDate);
  const endDate = parseIsoDateOnly(params.endDate);

  if (!startDate || !endDate || startDate > endDate) {
    return createUnavailableWeatherContext({
      reason: 'invalid_request',
      location: params.location,
      forecastStartDate: params.startDate ?? null,
      forecastEndDate: params.endDate ?? null,
      provider: 'none',
      attribution: params.attribution,
    });
  }

  const tripDates = enumerateDateRange(startDate, endDate);
  const tripDateSet = new Set(tripDates);

  const daily = params.daily
    .filter((d) => tripDateSet.has(d.date))
    .map(sanitizeDaily);
  const hourly = params.hourly
    .filter((h) => tripDateSet.has(h.date))
    .map(sanitizeHourly);

  const coveredDates = new Set(daily.map((d) => d.date));
  const coveredCount = tripDates.filter((d) => coveredDates.has(d)).length;

  if (coveredCount === 0) {
    return createUnavailableWeatherContext({
      reason: 'outside_forecast_range',
      location: params.location,
      timezone: params.timezone,
      forecastStartDate: startDate,
      forecastEndDate: endDate,
      provider: 'none',
      attribution: params.attribution,
    });
  }

  return {
    weatherAvailable: true,
    provider: params.provider,
    attribution: params.attribution,
    fetchedAt: params.fetchedAt ?? new Date().toISOString(),
    timezone: params.timezone,
    location: params.location,
    forecastStartDate: startDate,
    forecastEndDate: endDate,
    daily,
    hourly,
    partialForecast: coveredCount < tripDates.length,
  };
}
