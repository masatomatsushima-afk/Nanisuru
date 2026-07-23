/**
 * Normalize Google Weather responses → provider-agnostic WeatherContext slices.
 * Missing fields stay null — never invent temperatures / precip / conditions.
 */

import type {
  DailyWeatherForecast,
  HourlyWeatherForecast,
  WeatherCondition,
  WeatherContext,
  WeatherLocation,
} from '@/types/weather-context';
import type {
  GoogleForecastDay,
  GoogleForecastDayPart,
  GoogleForecastHour,
  GoogleDaysLookupResponse,
  GoogleHoursLookupResponse,
  GooglePrecipitation,
  GoogleTemperature,
  GoogleWeatherCondition,
  GoogleWind,
} from './google-weather-types';
import {
  createUnavailableWeatherContext,
  finalizeWeatherContext,
  GOOGLE_WEATHER_ATTRIBUTION,
} from './weather-context-assemble';
import {
  dateFromIsoTimestamp,
  finiteInt,
  finiteNumber,
  formatDisplayDate,
} from './weather-context-numbers';

// Re-export for existing imports
export { createUnavailableWeatherContext } from './weather-context-assemble';

function mapCondition(raw: GoogleWeatherCondition | undefined | null): WeatherCondition | null {
  if (!raw) return null;
  const type = typeof raw.type === 'string' ? raw.type.trim() : '';
  const description =
    typeof raw.description?.text === 'string' && raw.description.text.trim()
      ? raw.description.text.trim()
      : null;
  if (!type && !description) return null;
  const code = type ? type.toLowerCase() : 'unknown';
  return { code, description };
}

function tempDegrees(value: GoogleTemperature | undefined | null): number | null {
  return finiteNumber(value?.degrees);
}

function precipProbability(p: GooglePrecipitation | undefined | null): number | null {
  return finiteInt(p?.probability?.percent);
}

function precipAmountMm(p: GooglePrecipitation | undefined | null): number | null {
  const qpf = finiteNumber(p?.qpf?.quantity);
  if (qpf !== null) return qpf;
  return finiteNumber(p?.snowQpf?.quantity);
}

function windSpeedKph(w: GoogleWind | undefined | null): number | null {
  return finiteNumber(w?.speed?.value);
}

function humidity(part: GoogleForecastDayPart | undefined | null): number | null {
  return finiteInt(part?.relativeHumidity);
}

function pickDayPart(day: GoogleForecastDay): GoogleForecastDayPart | undefined {
  return day.daytimeForecast ?? day.nighttimeForecast;
}

export function normalizeDailyForecast(day: GoogleForecastDay): DailyWeatherForecast | null {
  const date =
    formatDisplayDate(day.displayDate ?? {}) ??
    dateFromIsoTimestamp(day.interval?.startTime);
  if (!date) return null;

  const part = pickDayPart(day);
  return {
    date,
    condition: mapCondition(part?.weatherCondition),
    temperatureMaxC: tempDegrees(day.maxTemperature),
    temperatureMinC: tempDegrees(day.minTemperature),
    feelsLikeMaxC: tempDegrees(day.feelsLikeMaxTemperature),
    feelsLikeMinC: tempDegrees(day.feelsLikeMinTemperature),
    precipitationProbabilityPercent: precipProbability(part?.precipitation),
    precipitationAmountMm: precipAmountMm(part?.precipitation),
    windSpeedKph: windSpeedKph(part?.wind),
    humidityPercent: humidity(part),
    sunrise:
      typeof day.sunEvents?.sunriseTime === 'string' && day.sunEvents.sunriseTime.trim()
        ? day.sunEvents.sunriseTime.trim()
        : null,
    sunset:
      typeof day.sunEvents?.sunsetTime === 'string' && day.sunEvents.sunsetTime.trim()
        ? day.sunEvents.sunsetTime.trim()
        : null,
  };
}

export function normalizeHourlyForecast(hour: GoogleForecastHour): HourlyWeatherForecast | null {
  const time =
    (typeof hour.interval?.startTime === 'string' && hour.interval.startTime.trim()) || null;
  const date =
    formatDisplayDate(hour.displayDateTime ?? {}) ?? (time ? dateFromIsoTimestamp(time) : null);
  if (!time || !date) return null;

  return {
    time,
    date,
    condition: mapCondition(hour.weatherCondition),
    temperatureC: tempDegrees(hour.temperature),
    feelsLikeC: tempDegrees(hour.feelsLikeTemperature),
    precipitationProbabilityPercent: precipProbability(hour.precipitation),
    precipitationAmountMm: precipAmountMm(hour.precipitation),
    windSpeedKph: windSpeedKph(hour.wind),
    humidityPercent: finiteInt(hour.relativeHumidity),
  };
}

/**
 * Filter Google forecasts to the trip date window and set availability flags.
 */
export function buildWeatherContextFromGoogle(params: {
  location: WeatherLocation;
  startDate: string;
  endDate: string;
  daysResponse: GoogleDaysLookupResponse;
  hoursResponse: GoogleHoursLookupResponse;
  fetchedAt?: string;
}): WeatherContext {
  const timezone =
    (typeof params.daysResponse.timeZone?.id === 'string' &&
      params.daysResponse.timeZone.id.trim()) ||
    (typeof params.hoursResponse.timeZone?.id === 'string' &&
      params.hoursResponse.timeZone.id.trim()) ||
    null;

  const allDaily = (params.daysResponse.forecastDays ?? [])
    .map(normalizeDailyForecast)
    .filter((d): d is DailyWeatherForecast => d !== null);

  const allHourly = (params.hoursResponse.forecastHours ?? [])
    .map(normalizeHourlyForecast)
    .filter((h): h is HourlyWeatherForecast => h !== null);

  if (allDaily.length === 0 && allHourly.length === 0) {
    return createUnavailableWeatherContext({
      reason: 'no_forecast_data',
      location: params.location,
      timezone,
      forecastStartDate: params.startDate,
      forecastEndDate: params.endDate,
      attribution: GOOGLE_WEATHER_ATTRIBUTION,
    });
  }

  return finalizeWeatherContext({
    provider: 'google_weather',
    attribution: GOOGLE_WEATHER_ATTRIBUTION,
    location: params.location,
    timezone,
    startDate: params.startDate,
    endDate: params.endDate,
    daily: allDaily,
    hourly: allHourly,
    fetchedAt: params.fetchedAt,
  });
}
