/**
 * Single entry for plan generation: WeatherContext → DailyWeatherModifier → legacy WeatherForecast.
 * Soft-fails — never throws for predictable weather failures.
 */

import type { PlanInput } from '@/lib/prompts';
import type { WeatherForecast } from '@/lib/weather';
import type { WeatherContext } from '@/types/weather-context';
import { createUnavailableWeatherForecast, getTripDateRange, resolveWeatherLocation } from '@/lib/weather';
import { resolveDestinationDetailsFromPlanInput } from '@/lib/destination-detail-input';
import { buildWeatherContext } from './weather-context-service';
import { createUnavailableWeatherContext } from './weather-context-assemble';
import {
  aggregateWeatherFitFromModifiers,
  buildDailyWeatherModifiers,
  buildWeatherPlanDiagnostics,
  emptyWeatherPlanDiagnostics,
  weatherContextToLegacyForecast,
  type DailyWeatherModifier,
  type WeatherPlanDiagnostics,
} from './daily-weather-modifier';
import type { PlaceWeatherFitContext } from '@/lib/places/place-ranking-context';

export type ResolveWeatherForPlanResult = {
  weatherContext: WeatherContext;
  modifiers: DailyWeatherModifier[];
  weather: WeatherForecast;
  weatherFit: PlaceWeatherFitContext | undefined;
  diagnostics: WeatherPlanDiagnostics;
};

function logWeatherPlanDev(diagnostics: WeatherPlanDiagnostics): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[weather-plan]', {
    weatherProvider: diagnostics.weatherProvider,
    weatherAvailable: diagnostics.weatherAvailable,
    unavailableReason: diagnostics.unavailableReason ?? null,
    requestedDateRange: diagnostics.requestedDateRange ?? null,
    returnedDailyCount: diagnostics.returnedDailyCount ?? null,
    returnedHourlyCount: diagnostics.returnedHourlyCount ?? null,
    weatherModifierCount: diagnostics.weatherModifierCount,
    rainyDayCount: diagnostics.rainyDayCount,
    hotDayCount: diagnostics.hotDayCount,
    coldDayCount: diagnostics.coldDayCount,
    weatherAdjustedCandidateCount: diagnostics.weatherAdjustedCandidateCount,
    outdoorItemsRescheduled: diagnostics.outdoorItemsRescheduled,
    weatherBackupCount: diagnostics.weatherBackupCount,
    outfitUsedForecast: diagnostics.outfitUsedForecast,
    fallbackType: diagnostics.fallbackType,
  });
}

/**
 * Fetch WeatherContext once for a plan (uses in-memory cache).
 * On failure → seasonal/unavailable legacy forecast without inventing rain.
 */
export async function resolveWeatherForPlanGeneration(
  input: PlanInput & { departureDate?: string; returnDate?: string },
): Promise<ResolveWeatherForPlanResult> {
  const details = resolveDestinationDetailsFromPlanInput(input);
  const locationName =
    details.destinationLabel?.trim() ||
    details.effectiveLocation?.trim() ||
    input.location.trim() ||
    '目的地';

  // Prefer tripDate; accept departureDate if a normalized log payload was passed by mistake.
  const tripStart =
    (typeof input.tripDate === 'string' && input.tripDate.trim()) ||
    (typeof input.departureDate === 'string' && input.departureDate.trim()) ||
    '';
  const tripEnd =
    (typeof input.tripEndDate === 'string' && input.tripEndDate.trim()) ||
    (typeof input.returnDate === 'string' && input.returnDate.trim()) ||
    undefined;

  if (!tripStart) {
    console.warn('[weather-plan] missing tripDate/departureDate — treating as fetch_failed');
    const weatherLocation = resolveWeatherLocation(locationName);
    const weather = createUnavailableWeatherForecast(locationName, weatherLocation);
    weather.unavailableReason = 'invalid_request';
    weather.planningMessage =
      '天気予報を取得できませんでした。時間を置いて再取得してください。';
    weather.summary = weather.planningMessage;
    const weatherContext = createUnavailableWeatherContext({
      reason: 'invalid_request',
      forecastStartDate: null,
      forecastEndDate: null,
    });
    const diagnostics = emptyWeatherPlanDiagnostics({
      weatherProvider: 'none',
      unavailableReason: 'invalid_request',
      returnedDailyCount: 0,
      returnedHourlyCount: 0,
    });
    logWeatherPlanDev(diagnostics);
    return {
      weatherContext,
      modifiers: [],
      weather,
      weatherFit: undefined,
      diagnostics,
    };
  }

  const { startDate, endDate } = getTripDateRange(tripStart, input.tripDuration, {
    endDate: tripEnd,
    customDuration: input.customDuration,
  });

  try {
    const { weatherContext } = await buildWeatherContext({
      destination: locationName,
      country: details.country ?? input.country,
      city: details.city ?? input.city,
      baseArea: details.baseArea
        ? { name: details.baseArea }
        : input.baseArea
          ? { name: input.baseArea }
          : undefined,
      accommodation: details.accommodation
        ? { name: details.accommodation }
        : input.accommodation
          ? { name: input.accommodation }
          : undefined,
      startDate,
      endDate,
    });

    const modifiers = buildDailyWeatherModifiers(weatherContext);
    const weather = weatherContextToLegacyForecast({
      weatherContext,
      modifiers,
      locationName,
      tripDate: startDate,
    });
    const aggregate = aggregateWeatherFitFromModifiers(modifiers);
    const weatherFit =
      weatherContext.weatherAvailable && modifiers.length > 0 ? aggregate : undefined;

    const diagnostics = buildWeatherPlanDiagnostics({
      weatherContext,
      modifiers,
      outfitUsedForecast: weatherContext.weatherAvailable,
      requestedDateRange: `${startDate}..${endDate}`,
    });
    logWeatherPlanDev(diagnostics);

    return { weatherContext, modifiers, weather, weatherFit, diagnostics };
  } catch (error) {
    console.warn('[weather-plan] resolve failed, continuing without forecast', error);
    const weatherLocation = resolveWeatherLocation(locationName);
    const weather = createUnavailableWeatherForecast(locationName, weatherLocation);
    const weatherContext = createUnavailableWeatherContext({
      reason: 'fetch_failed',
      forecastStartDate: startDate,
      forecastEndDate: endDate,
    });
    const diagnostics = emptyWeatherPlanDiagnostics({
      weatherProvider: 'none',
      unavailableReason: 'fetch_failed',
      requestedDateRange: `${startDate}..${endDate}`,
      returnedDailyCount: 0,
      returnedHourlyCount: 0,
    });
    logWeatherPlanDev(diagnostics);
    return {
      weatherContext,
      modifiers: [],
      weather,
      weatherFit: undefined,
      diagnostics,
    };
  }
}

export function mergeWeatherPlanDiagnostics(
  base: WeatherPlanDiagnostics,
  patch: Partial<WeatherPlanDiagnostics>,
): WeatherPlanDiagnostics {
  const next = { ...base, ...patch };
  logWeatherPlanDev(next);
  return next;
}
