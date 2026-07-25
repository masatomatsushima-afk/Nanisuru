/**
 * Weather replan (β): reuse Plan Detail weather, minimal local adjust, shared quality gates.
 * Never hang forever — AbortController + timeout. Never apply partial broken plans.
 */

import { getTodayIsoDate, type WeatherForecast } from '@/lib/weather';
import { resolveWeatherForPlanGeneration } from '@/lib/weather-context/resolve-weather-for-plan';
import {
  aggregateWeatherFitFromModifiers,
  buildDailyWeatherModifiers,
  weatherContextToLegacyForecast,
} from '@/lib/weather-context/daily-weather-modifier';
import { applyWeatherToItinerary } from '@/lib/weather-context/apply-weather-to-itinerary';
import {
  getEarliestActivityStartMinutes,
  getLatestActivityEndMinutes,
} from '@/lib/itinerary-quality';
import type { ItineraryDay } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type { WeatherContext } from '@/types/weather-context';
import type { WeatherReplanPreview } from '@/types/weather-replan';
import {
  getWeatherReplanUnavailableMessage,
  isUsableLegacyForecast,
  isUsableWeatherContext,
  logWeatherReplanDev,
  tripOverlapsForecastDays,
  type WeatherReplanResolveSource,
} from '@/lib/weather-replan-resolve';
import {
  buildValidatedReplanPayload,
  demoteInventedSpecificClaims,
  runWeatherReplanQualityGates,
  WEATHER_REPLAN_TIMEOUT_MS,
} from '@/lib/weather-replan-pipeline';

export { getWeatherReplanEligibility } from '@/lib/weather-replan-eligibility';
export { slimPlanDetailsForRoute, demoteInventedSpecificClaims } from '@/lib/weather-replan-pipeline';

export const WEATHER_REPLAN_ERRORS = {
  fetchFailed: '天気の取得に失敗しました。時間を置いて再度お試しください。',
  noForecast: '最新の天気予報がまだ利用できません。出発が近づいてから再度お試しください。',
  aiFailed: '再調整できませんでした。元のプランは変更されていません。',
  timedOut: '再調整できませんでした。元のプランは変更されていません。',
} as const;

function legacyFromWeatherContext(
  weatherContext: WeatherContext,
  locationName: string,
  tripDate: string,
): WeatherForecast {
  const modifiers = buildDailyWeatherModifiers(weatherContext);
  return weatherContextToLegacyForecast({
    weatherContext,
    modifiers,
    locationName,
    tripDate,
  });
}

type ResolvedReplanWeather = {
  weather: WeatherForecast;
  weatherContext: WeatherContext | undefined;
  source: WeatherReplanResolveSource;
  refetchAttempted: boolean;
  reusedExisting: boolean;
};

async function resolveWeatherForReplan(payload: SavedTripPayload): Promise<ResolvedReplanWeather> {
  const tripDate = payload.details.tripDate ?? getTodayIsoDate();
  const tripEnd = payload.details.tripEndDate ?? tripDate;
  const locationName =
    payload.details.destinationLabel?.trim() ||
    payload.location.trim() ||
    '目的地';

  const existingWeather = payload.details.weather;
  const existingContext = payload.details.weatherContext;
  const existingUsable =
    isUsableWeatherContext(existingContext) || isUsableLegacyForecast(existingWeather);
  const requestedDateRange = `${tripDate}..${tripEnd}`;

  let refetchAttempted = false;
  let refreshed: Awaited<ReturnType<typeof resolveWeatherForPlanGeneration>> | null = null;

  try {
    refetchAttempted = true;
    refreshed = await resolveWeatherForPlanGeneration({
      location: locationName,
      country: payload.details.country,
      city: payload.details.city,
      baseArea: payload.details.baseArea,
      accommodation: payload.details.accommodation,
      destinationLabel: payload.details.destinationLabel,
      tripDate,
      tripEndDate: tripEnd,
      tripDuration: payload.tripDuration,
      customDuration: payload.customDuration,
      budget: payload.budget,
      currency: payload.currency,
      people: payload.people,
      companion: payload.companion,
      personality: payload.personality,
      mood: payload.mood ?? '',
    });
  } catch (error) {
    console.warn('[WeatherReplan] weather refetch failed', error);
    refreshed = null;
  }

  const refreshedCtx = refreshed?.weatherContext;
  const refreshedWeather = refreshed?.weather;
  const refreshedUsable =
    isUsableWeatherContext(refreshedCtx) || isUsableLegacyForecast(refreshedWeather);

  if (refreshedUsable && refreshedWeather) {
    const dailyDates =
      refreshedCtx?.daily.map((d) => d.date) ?? refreshedWeather.days.map((d) => d.date);
    const overlaps =
      dailyDates.length === 0 ||
      tripOverlapsForecastDays(tripDate, tripEnd, dailyDates) ||
      refreshedWeather.days.length > 0;

    if (overlaps) {
      logWeatherReplanDev({
        weatherAvailableAtPlanDetail: existingUsable,
        weatherAvailableAtReplan: true,
        dailyCountAtReplan: refreshedCtx?.daily.length ?? refreshedWeather.days.length,
        hourlyCountAtReplan: refreshedCtx?.hourly.length ?? 0,
        requestedDateRange,
        forecastDateRange:
          refreshedCtx?.forecastStartDate && refreshedCtx?.forecastEndDate
            ? `${refreshedCtx.forecastStartDate}..${refreshedCtx.forecastEndDate}`
            : null,
        unavailableReason: refreshedCtx?.unavailableReason ?? null,
        reusedExistingWeatherContext: false,
        weatherRefetchAttempted: true,
        weatherReplanEligible: true,
        resolveSource: 'refetch',
      });
      return {
        weather: refreshedWeather,
        weatherContext: refreshedCtx,
        source: 'refetch',
        refetchAttempted: true,
        reusedExisting: false,
      };
    }
  }

  if (isUsableWeatherContext(existingContext)) {
    const weather = isUsableLegacyForecast(existingWeather)
      ? existingWeather!
      : legacyFromWeatherContext(existingContext!, locationName, tripDate);
    logWeatherReplanDev({
      weatherAvailableAtPlanDetail: true,
      weatherAvailableAtReplan: true,
      dailyCountAtReplan: existingContext!.daily.length,
      hourlyCountAtReplan: existingContext!.hourly.length,
      requestedDateRange,
      forecastDateRange:
        existingContext!.forecastStartDate && existingContext!.forecastEndDate
          ? `${existingContext!.forecastStartDate}..${existingContext!.forecastEndDate}`
          : null,
      unavailableReason: null,
      reusedExistingWeatherContext: true,
      weatherRefetchAttempted: refetchAttempted,
      weatherReplanEligible: true,
      resolveSource: refetchAttempted ? 'refetch_failed_reused_existing' : 'existing_weather_context',
    });
    return {
      weather,
      weatherContext: existingContext,
      source: refetchAttempted ? 'refetch_failed_reused_existing' : 'existing_weather_context',
      refetchAttempted,
      reusedExisting: true,
    };
  }

  if (isUsableLegacyForecast(existingWeather)) {
    logWeatherReplanDev({
      weatherAvailableAtPlanDetail: true,
      weatherAvailableAtReplan: true,
      dailyCountAtReplan: existingWeather!.days.length,
      hourlyCountAtReplan: 0,
      requestedDateRange,
      forecastDateRange: null,
      unavailableReason: null,
      reusedExistingWeatherContext: true,
      weatherRefetchAttempted: refetchAttempted,
      weatherReplanEligible: true,
      resolveSource: refetchAttempted ? 'refetch_failed_reused_existing' : 'existing_plan_weather',
    });
    return {
      weather: existingWeather!,
      weatherContext: existingContext,
      source: refetchAttempted ? 'refetch_failed_reused_existing' : 'existing_plan_weather',
      refetchAttempted,
      reusedExisting: true,
    };
  }

  logWeatherReplanDev({
    weatherAvailableAtPlanDetail: false,
    weatherAvailableAtReplan: false,
    dailyCountAtReplan: refreshedCtx?.daily.length ?? 0,
    hourlyCountAtReplan: refreshedCtx?.hourly.length ?? 0,
    requestedDateRange,
    forecastDateRange: null,
    unavailableReason:
      refreshedCtx?.unavailableReason ?? existingWeather?.unavailableReason ?? 'fetch_failed',
    reusedExistingWeatherContext: false,
    weatherRefetchAttempted: refetchAttempted,
    weatherReplanEligible: false,
    resolveSource: 'unavailable',
  });

  return {
    weather:
      refreshedWeather ??
      existingWeather ??
      ({
        available: false,
        locationName,
        planningMode: 'unavailable',
        days: [],
        summary: '',
        hasRainExpected: false,
        isMostlySunny: false,
        unavailableReason: 'fetch_failed',
      } as WeatherForecast),
    weatherContext: refreshedCtx ?? existingContext,
    source: 'unavailable',
    refetchAttempted,
    reusedExisting: false,
  };
}

function buildLocalChangePoints(
  before: SavedTripPayload,
  afterDays: ItineraryDay[],
  weather: WeatherForecast,
  outdoorRescheduled: number,
): string[] {
  const points: string[] = [];
  if (outdoorRescheduled > 0) {
    points.push(`雨や暑さの影響がある屋外予定を${outdoorRescheduled}件、時間帯または代替案で調整しました`);
  }
  if (weather.hasRainExpected) {
    points.push('雨の可能性がある日は、屋内候補とバックアップを強化しました');
  }
  const maxTemp = Math.max(...weather.days.map((d) => d.temperatureMax), 0);
  if (maxTemp >= 30) {
    points.push('気温が高い時間帯は、長時間の屋外を控えめにしました');
  }

  for (const afterDay of afterDays) {
    const beforeDay = before.days.find((d) => d.dayNumber === afterDay.dayNumber);
    if (!beforeDay) continue;
    for (let i = 0; i < afterDay.items.length; i += 1) {
      const beforeItem = beforeDay.items[i];
      const afterItem = afterDay.items[i];
      if (beforeItem && afterItem && beforeItem.time !== afterItem.time) {
        points.push(`${afterDay.label}の「${afterItem.activity}」の時間を天気に合わせてずらしました`);
      }
    }
  }

  if (points.length === 0) {
    points.push('最新の天気予報に合わせて、必要な箇所だけ再調整しました');
  }
  return [...new Set(points)].slice(0, 6);
}

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      reject(new DOMException('Weather replan timed out', 'TimeoutError'));
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    promise
      .then((value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      });
  });
}

/**
 * β-stable weather replan:
 * 1) Resolve usable weather (prefer Plan Detail)
 * 2) Local applyWeatherToItinerary (minimal change — no full AI rewrite)
 * 3) Shared quality gates (Places / schedule / specificity)
 * 4) Return validated payload only
 */
export async function previewWeatherReplan(
  payload: SavedTripPayload,
  options?: { abortSignal?: AbortSignal },
): Promise<WeatherReplanPreview> {
  const startedAt = Date.now();
  console.info('[weather-replan]', { replanStarted: true });

  const tripDate = payload.details.tripDate ?? getTodayIsoDate();
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (options?.abortSignal) {
    if (options.abortSignal.aborted) controller.abort();
    else options.abortSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const resolved = await withTimeout(
      resolveWeatherForReplan(payload),
      Math.min(15_000, WEATHER_REPLAN_TIMEOUT_MS),
      controller.signal,
    );

    if (resolved.source === 'unavailable' || !isUsableLegacyForecast(resolved.weather)) {
      console.info('[weather-replan]', {
        replanCompleted: false,
        originalPlanPreservedOnFailure: true,
        loadingCleared: true,
      });
      return {
        success: false,
        errorMessage: getWeatherReplanUnavailableMessage(
          resolved.weather,
          resolved.weatherContext,
        ),
      };
    }

    const freshWeather = resolved.weather;
    const weatherContext = resolved.weatherContext;
    const modifiers =
      weatherContext && isUsableWeatherContext(weatherContext)
        ? buildDailyWeatherModifiers(weatherContext)
        : [];
    const weatherFit =
      weatherContext && modifiers.length > 0
        ? aggregateWeatherFitFromModifiers(modifiers)
        : undefined;

    // Minimal local adjustment — preserves google placeIds and most of the original itinerary.
    const applied = applyWeatherToItinerary({
      days: payload.days,
      modifiers,
      weatherContext: weatherContext ?? {
        weatherAvailable: true,
        provider: 'open_meteo',
        attribution: null,
        fetchedAt: null,
        timezone: null,
        location: null,
        forecastStartDate: tripDate,
        forecastEndDate: payload.details.tripEndDate ?? tripDate,
        daily: [],
        hourly: [],
        partialForecast: false,
      },
      tripStartDate: tripDate,
      rainyDayAlternatives: payload.details.rainyDayAlternatives,
      earliestActivityMinutes: getEarliestActivityStartMinutes(payload.details.travelTiming),
      latestActivityMinutes: getLatestActivityEndMinutes(payload.details.travelTiming),
    });

    let days = demoteInventedSpecificClaims(applied.days);
    const changePoints = buildLocalChangePoints(
      payload,
      days,
      freshWeather,
      applied.outdoorItemsRescheduled,
    );

    const remainingMs = Math.max(5_000, WEATHER_REPLAN_TIMEOUT_MS - (Date.now() - startedAt));
    const gate = await withTimeout(
      runWeatherReplanQualityGates({
        payload,
        days,
        weather: freshWeather,
        weatherContext,
        weatherFit,
        changePoints,
        abortSignal: controller.signal,
      }),
      remainingMs,
      controller.signal,
    );

    days = demoteInventedSpecificClaims(gate.days);
    const validated = buildValidatedReplanPayload(payload, {
      ...gate,
      days,
      details: {
        ...gate.details,
        rainyDayAlternatives: applied.rainyDayAlternatives,
        weatherReplanChanges: changePoints,
      },
    });

    console.info('[weather-replan]', {
      replanCompleted: true,
      loadingCleared: true,
      reusedWeatherContext: resolved.reusedExisting,
      googleCandidateCount: gate.googleCandidateCount,
      finalSpecificPlaceCount: gate.finalSpecificPlaceCount,
      abstractItemCount: gate.abstractItemCount,
      invalidMapsItemCount: gate.invalidMapsItemCount,
      scheduleValidationPassed: gate.scheduleValidationPassed,
      itemCountByDay: gate.itemCountByDay,
      elapsedMs: Date.now() - startedAt,
    });

    return {
      success: true,
      beforePayload: payload,
      afterPayload: validated,
      freshWeather,
      previousWeather: payload.details.weather,
      changePoints,
      forecastDayCount: freshWeather.days.length,
      reusedExistingWeatherContext: resolved.reusedExisting,
    };
  } catch (error) {
    const timedOut =
      (error instanceof DOMException && error.name === 'TimeoutError') ||
      (error instanceof Error && /timed out|timeout/i.test(error.message));
    console.warn('[WeatherReplan] failed', {
      replanTimedOut: timedOut,
      originalPlanPreservedOnFailure: true,
      loadingCleared: true,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    return {
      success: false,
      errorMessage: timedOut ? WEATHER_REPLAN_ERRORS.timedOut : WEATHER_REPLAN_ERRORS.aiFailed,
    };
  } finally {
    options?.abortSignal?.removeEventListener('abort', onExternalAbort);
    console.info('[weather-replan]', { loadingCleared: true });
  }
}

export function applyWeatherReplanPreview(
  preview: Extract<WeatherReplanPreview, { success: true }>,
): SavedTripPayload {
  return preview.afterPayload;
}

/** @deprecated Kept for prompt helpers / tests — replan no longer full-rewrites via AI by default. */
export function buildWeatherReplanInstruction(
  previousWeather: WeatherForecast | undefined,
  freshWeather: WeatherForecast,
): string {
  const daySummaries = freshWeather.days
    .map((day) => `- ${day.label}: ${day.condition}・降水${day.precipitationProbability}%`)
    .join('\n');
  return (
    '最新の天気予報に合わせて、ベースプランを最小限の変更で再調整してください。\n' +
    `${previousWeather?.summary ?? ''}\n${freshWeather.summary}\n${daySummaries}`
  );
}
