/**
 * Weather Context orchestration (Phase 1).
 * Soft-fail only — never throws for predictable weather failures.
 * Does not mutate plans, Places ranking, or OpenAI prompts.
 *
 * Default provider: Open-Meteo (WEATHER_PROVIDER=open_meteo).
 * Google kept for WEATHER_PROVIDER=google | auto.
 */

import type { WeatherContext, WeatherUnavailableReason } from '@/types/weather-context';
import { googleWeatherProvider } from './google-weather-provider';
import { openMeteoWeatherProvider } from './open-meteo-weather-provider';
import {
  buildWeatherCacheKey,
  getWeatherCache,
  setWeatherCache,
} from './weather-context-cache';
import { createUnavailableWeatherContext } from './weather-context-assemble';
import { logWeatherContextDev } from './weather-context-log';
import { parseIsoDateOnly } from './weather-context-numbers';
import {
  resolveWeatherLocation,
  type WeatherLocationResolveInput,
} from './weather-location-resolver';
import {
  resolveWeatherProviderMode,
  type WeatherProviderName,
} from './weather-provider';

export type BuildWeatherContextInput = WeatherLocationResolveInput & {
  startDate?: string | null;
  endDate?: string | null;
};

export type BuildWeatherContextResult = {
  weatherContext: WeatherContext;
  cacheHit: boolean;
  elapsedMs: number;
};

function emitDevLog(params: {
  weatherContext: WeatherContext;
  cacheHit: boolean;
  elapsedMs: number;
  locationResolved: boolean;
  startDate: string | null;
  endDate: string | null;
}): void {
  const { weatherContext } = params;
  logWeatherContextDev({
    weatherProvider: weatherContext.provider,
    weatherAvailable: weatherContext.weatherAvailable,
    unavailableReason: weatherContext.unavailableReason,
    locationResolved: params.locationResolved,
    requestedDateRange: `${params.startDate ?? '?'}..${params.endDate ?? '?'}`,
    returnedDailyCount: weatherContext.daily.length,
    returnedHourlyCount: weatherContext.hourly.length,
    partialForecast: weatherContext.partialForecast,
    cacheHit: params.cacheHit,
    elapsedMs: params.elapsedMs,
  });
}

function cacheProviderName(mode: ReturnType<typeof resolveWeatherProviderMode>): WeatherProviderName {
  // Cache under the primary provider for the configured mode (auto → open_meteo).
  return mode === 'google' ? 'google_weather' : 'open_meteo';
}

function shouldFallbackToGoogle(ctx: WeatherContext): boolean {
  if (ctx.weatherAvailable) return false;
  const reason: WeatherUnavailableReason | undefined = ctx.unavailableReason;
  return reason === 'fetch_failed' || reason === 'no_forecast_data';
}

/**
 * Build WeatherContext for a trip. Safe for API routes — always returns a context object.
 */
export async function buildWeatherContext(
  input: BuildWeatherContextInput,
): Promise<BuildWeatherContextResult> {
  const started = Date.now();
  const startDate = parseIsoDateOnly(input.startDate ?? '');
  const endDate = parseIsoDateOnly(input.endDate ?? '');
  const mode = resolveWeatherProviderMode();

  if (!startDate || !endDate || startDate > endDate) {
    const weatherContext = createUnavailableWeatherContext({
      reason: 'invalid_request',
      forecastStartDate: input.startDate ?? null,
      forecastEndDate: input.endDate ?? null,
    });
    const elapsedMs = Date.now() - started;
    emitDevLog({
      weatherContext,
      cacheHit: false,
      elapsedMs,
      locationResolved: false,
      startDate,
      endDate,
    });
    return { weatherContext, cacheHit: false, elapsedMs };
  }

  const resolved = await resolveWeatherLocation(input);
  if (!resolved.locationResolved || !resolved.location) {
    const weatherContext = createUnavailableWeatherContext({
      reason: 'location_unresolved',
      forecastStartDate: startDate,
      forecastEndDate: endDate,
    });
    const elapsedMs = Date.now() - started;
    emitDevLog({
      weatherContext,
      cacheHit: false,
      elapsedMs,
      locationResolved: false,
      startDate,
      endDate,
    });
    return { weatherContext, cacheHit: false, elapsedMs };
  }

  const providerKey = cacheProviderName(mode);
  const cacheKey = buildWeatherCacheKey({
    provider: providerKey,
    latitude: resolved.location.latitude,
    longitude: resolved.location.longitude,
    startDate,
    endDate,
  });
  const cached = getWeatherCache(cacheKey);
  if (cached) {
    const elapsedMs = Date.now() - started;
    emitDevLog({
      weatherContext: cached,
      cacheHit: true,
      elapsedMs,
      locationResolved: true,
      startDate,
      endDate,
    });
    return { weatherContext: cached, cacheHit: true, elapsedMs };
  }

  const fetchInput = {
    location: resolved.location,
    startDate,
    endDate,
  };

  let weatherContext: WeatherContext;

  if (mode === 'google') {
    weatherContext = await googleWeatherProvider.fetchWeatherContext(fetchInput);
  } else {
    // open_meteo (default) or auto — Open-Meteo first
    weatherContext = await openMeteoWeatherProvider.fetchWeatherContext(fetchInput);

    // auto: one-shot Google fallback only on technical Open-Meteo failure (never loops).
    if (mode === 'auto' && shouldFallbackToGoogle(weatherContext)) {
      const googleResult = await googleWeatherProvider.fetchWeatherContext(fetchInput);
      if (googleResult.weatherAvailable) {
        weatherContext = googleResult;
      }
      // If Google also fails, keep the original Open-Meteo soft-failure context.
    }
  }

  // Cache successful available contexts and outside_forecast_range / unsupported_location.
  if (
    weatherContext.weatherAvailable ||
    weatherContext.unavailableReason === 'outside_forecast_range' ||
    weatherContext.unavailableReason === 'unsupported_location'
  ) {
    setWeatherCache(cacheKey, weatherContext);
  }

  const elapsedMs = Date.now() - started;
  emitDevLog({
    weatherContext,
    cacheHit: false,
    elapsedMs,
    locationResolved: true,
    startDate,
    endDate,
  });

  return { weatherContext, cacheHit: false, elapsedMs };
}
