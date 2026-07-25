/**
 * Weather replan button eligibility — kept free of generate-plan / RN imports
 * so verify scripts can import it safely.
 */

import {
  FORECAST_HORIZON_DAYS,
  getDaysUntilDeparture,
  WEATHER_PLANNING_MESSAGES,
} from '@/lib/weather-planning';
import type { WeatherForecast } from '@/lib/weather';
import type { WeatherReplanEligibility } from '@/types/weather-replan';

function resolveStoredPlanningMode(weather?: WeatherForecast) {
  if (weather?.available !== false && (weather?.days?.length ?? 0) > 0) {
    return 'forecast' as const;
  }
  if (weather?.planningMode) return weather.planningMode;
  if (weather?.unavailableReason === 'outside_forecast_range' || weather?.seasonalContext) {
    return 'seasonal' as const;
  }
  if (weather?.available === false) return 'unavailable' as const;
  return 'forecast' as const;
}

function hasLiveForecast(weather?: WeatherForecast): boolean {
  return Boolean(
    weather &&
      weather.available !== false &&
      weather.days.length > 0 &&
      weather.planningMode !== 'seasonal' &&
      weather.planningMode !== 'unavailable',
  );
}

/** Decide whether to show re-plan button or future note. */
export function getWeatherReplanEligibility(
  tripDate: string | undefined,
  weather?: WeatherForecast,
): WeatherReplanEligibility {
  if (!tripDate?.trim()) {
    return { status: 'hidden' };
  }

  const daysUntil = getDaysUntilDeparture(tripDate);
  const reason = weather?.unavailableReason;

  if (hasLiveForecast(weather)) {
    return {
      status: 'ready',
      highlight: false,
      daysUntil,
      buttonLabel: '天気に合わせて再調整',
    };
  }

  // Outside forecast range: show note only — do not offer a refetch that cannot succeed.
  if (reason === 'outside_forecast_range' || daysUntil > FORECAST_HORIZON_DAYS) {
    return {
      status: 'future',
      message:
        reason === 'outside_forecast_range'
          ? '出発が近づいたら再調整'
          : WEATHER_PLANNING_MESSAGES.rescheduleNote,
    };
  }

  if (reason === 'location_unresolved') {
    return { status: 'hidden' };
  }

  if (
    reason === 'fetch_failed' ||
    reason === 'no_forecast_data' ||
    reason === 'missing_api_key' ||
    reason === 'api_disabled' ||
    reason === 'unsupported_location' ||
    reason === 'invalid_request' ||
    weather?.available === false ||
    resolveStoredPlanningMode(weather) === 'unavailable'
  ) {
    return {
      status: 'ready',
      highlight: false,
      daysUntil,
      buttonLabel: '天気を再取得',
    };
  }

  // Seasonal guidance within horizon (legacy plans without unavailableReason).
  if (resolveStoredPlanningMode(weather) === 'seasonal') {
    return {
      status: 'ready',
      highlight: true,
      daysUntil,
      buttonLabel: '天気に合わせて再調整',
    };
  }

  return {
    status: 'ready',
    highlight: false,
    daysUntil,
    buttonLabel: '天気に合わせて再調整',
  };
}
