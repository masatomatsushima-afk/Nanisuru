/**
 * Server-side Open-Meteo forecast client (no API key).
 * Soft-fails — never throws for predictable network failures.
 */

import { WEATHER_FETCH_TIMEOUT_MS } from './weather-context-constants';
import type { OpenMeteoForecastResponse } from './open-meteo-types';

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export type OpenMeteoFetchOk = {
  ok: true;
  data: OpenMeteoForecastResponse;
};

export type OpenMeteoFetchErr = {
  ok: false;
  reason: 'fetch_failed' | 'no_forecast_data';
  httpStatus?: number;
};

export type OpenMeteoFetchResult = OpenMeteoFetchOk | OpenMeteoFetchErr;

/**
 * Fetch daily + hourly forecast for coordinates within [startDate, endDate].
 * timezone=auto → response.timezone is the location IANA zone.
 */
export async function fetchOpenMeteoForecast(params: {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
}): Promise<OpenMeteoFetchResult> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', String(params.latitude));
  url.searchParams.set('longitude', String(params.longitude));
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
    ].join(','),
  );
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'sunrise',
      'sunset',
    ].join(','),
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('start_date', params.startDate);
  url.searchParams.set('end_date', params.endDate);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      return { ok: false, reason: 'fetch_failed', httpStatus: response.status };
    }
    const data = (await response.json()) as OpenMeteoForecastResponse;
    const hasDaily = Boolean(data.daily?.time?.length);
    const hasHourly = Boolean(data.hourly?.time?.length);
    if (!hasDaily && !hasHourly) {
      return { ok: false, reason: 'no_forecast_data', httpStatus: response.status };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'fetch_failed' };
  } finally {
    clearTimeout(timeoutId);
  }
}
