/**
 * Server-side Google Weather API client.
 * Key: GOOGLE_WEATHER_API_KEY only (never EXPO_PUBLIC_).
 * Soft-fails — never throws for predictable API failures.
 *
 * Japan / Korea and other unsupported regions return 404 NOT_FOUND
 * ("Information is not supported for this location") → unsupported_location
 * (not a technical/red error).
 */

import {
  GOOGLE_WEATHER_DAYS_URL,
  GOOGLE_WEATHER_HOURS_URL,
  WEATHER_FETCH_TIMEOUT_MS,
} from './weather-context-constants';
import type {
  GoogleDaysLookupResponse,
  GoogleHoursLookupResponse,
} from './google-weather-types';
import type { WeatherUnavailableReason } from '@/types/weather-context';

const KEY_PLACEHOLDERS = new Set(['', 'your-google-weather-api-key']);

export function getServerGoogleWeatherApiKey(): string | undefined {
  const key = process.env.GOOGLE_WEATHER_API_KEY?.trim();
  if (!key || KEY_PLACEHOLDERS.has(key)) return undefined;
  // Guard against accidental EXPO_PUBLIC_ misuse — do not read EXPO_PUBLIC_GOOGLE_WEATHER_API_KEY.
  return key;
}

export type GoogleWeatherFetchOk = {
  ok: true;
  days: GoogleDaysLookupResponse;
  hours: GoogleHoursLookupResponse;
};

export type GoogleWeatherFetchErr = {
  ok: false;
  reason: Extract<
    WeatherUnavailableReason,
    'missing_api_key' | 'api_disabled' | 'fetch_failed' | 'unsupported_location'
  >;
  httpStatus?: number;
};

export type GoogleWeatherFetchResult = GoogleWeatherFetchOk | GoogleWeatherFetchErr;

function buildLookupUrl(
  base: string,
  apiKey: string,
  latitude: number,
  longitude: number,
  extra: Record<string, string | number>,
): string {
  const params = new URLSearchParams();
  // key is appended only for the outbound Google request — never returned to clients.
  params.set('key', apiKey);
  params.set('location.latitude', String(latitude));
  params.set('location.longitude', String(longitude));
  params.set('unitsSystem', 'METRIC');
  params.set('languageCode', 'ja');
  for (const [k, v] of Object.entries(extra)) {
    params.set(k, String(v));
  }
  return `${base}?${params.toString()}`;
}

function extractGoogleErrorMessage(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const err = (json as { error?: { message?: unknown; status?: unknown } }).error;
  const message = typeof err?.message === 'string' ? err.message : '';
  const status = typeof err?.status === 'string' ? err.status : '';
  return `${status} ${message}`.trim();
}

export function isGoogleUnsupportedLocation(status: number, json: unknown): boolean {
  if (status === 404) return true;
  const combined = extractGoogleErrorMessage(json);
  if (/NOT_FOUND/i.test(combined) && /not supported for this location/i.test(combined)) {
    return true;
  }
  return /not supported for this location/i.test(combined);
}

async function fetchJson(
  url: string,
  signal: AbortSignal,
): Promise<
  | { ok: true; status: number; json: unknown }
  | { ok: false; status: number; json: unknown }
> {
  const response = await fetch(url, { method: 'GET', signal });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok) {
    return { ok: false, status: response.status, json };
  }
  return { ok: true, status: response.status, json };
}

/**
 * Fetch daily + hourly forecasts for a coordinate.
 * Does not log the URL (contains key) or response bodies.
 */
export async function fetchGoogleWeatherForecasts(params: {
  latitude: number;
  longitude: number;
  /** Hours to request (1–240). Default covers ~10 days. */
  hours?: number;
  days?: number;
}): Promise<GoogleWeatherFetchResult> {
  const apiKey = getServerGoogleWeatherApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }

  const days = Math.min(10, Math.max(1, params.days ?? 10));
  const hours = Math.min(240, Math.max(1, params.hours ?? 240));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_FETCH_TIMEOUT_MS);

  try {
    const daysUrl = buildLookupUrl(
      GOOGLE_WEATHER_DAYS_URL,
      apiKey,
      params.latitude,
      params.longitude,
      { days, pageSize: days },
    );

    // Fetch days first; hours best-effort (partial hourly is OK).
    const daysResult = await fetchJson(daysUrl, controller.signal);
    if (!daysResult.ok) {
      if (isGoogleUnsupportedLocation(daysResult.status, daysResult.json)) {
        return { ok: false, reason: 'unsupported_location', httpStatus: daysResult.status };
      }
      if (daysResult.status === 403 || daysResult.status === 401) {
        return { ok: false, reason: 'api_disabled', httpStatus: daysResult.status };
      }
      return { ok: false, reason: 'fetch_failed', httpStatus: daysResult.status };
    }

    let hoursJson: GoogleHoursLookupResponse = {};
    try {
      // Paginate hourly until we have enough or no next page (cap pages to avoid long loops).
      const collected: NonNullable<GoogleHoursLookupResponse['forecastHours']> = [];
      let pageToken: string | undefined;
      let pages = 0;
      let lastTimezone: GoogleHoursLookupResponse['timeZone'];
      do {
        const pageExtra: Record<string, string | number> = {
          hours,
          pageSize: Math.min(48, hours),
        };
        if (pageToken) pageExtra.pageToken = pageToken;
        const pageUrl = buildLookupUrl(
          GOOGLE_WEATHER_HOURS_URL,
          apiKey,
          params.latitude,
          params.longitude,
          pageExtra,
        );
        const hoursResult = await fetchJson(pageUrl, controller.signal);
        if (!hoursResult.ok) break;
        const page = hoursResult.json as GoogleHoursLookupResponse;
        if (page.forecastHours?.length) collected.push(...page.forecastHours);
        if (page.timeZone) lastTimezone = page.timeZone;
        pageToken = typeof page.nextPageToken === 'string' ? page.nextPageToken : undefined;
        pages += 1;
      } while (pageToken && collected.length < hours && pages < 12);
      hoursJson = { forecastHours: collected, timeZone: lastTimezone };
    } catch {
      // Hourly failure does not fail the whole fetch if daily succeeded.
      hoursJson = {};
    }

    return {
      ok: true,
      days: daysResult.json as GoogleDaysLookupResponse,
      hours: hoursJson,
    };
  } catch {
    return { ok: false, reason: 'fetch_failed' };
  } finally {
    clearTimeout(timeoutId);
  }
}
