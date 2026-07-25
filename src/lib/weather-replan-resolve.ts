/**
 * Weather replan — resolve usable forecast without contradicting Plan Detail.
 */

import type { WeatherForecast } from '@/lib/weather';
import type { WeatherContext } from '@/types/weather-context';
import { getWeatherUnavailableUserMessage } from '@/lib/weather-planning';

export type WeatherReplanResolveSource =
  | 'existing_plan_weather'
  | 'existing_weather_context'
  | 'refetch'
  | 'refetch_failed_reused_existing'
  | 'unavailable';

export function isUsableLegacyForecast(weather?: WeatherForecast | null): boolean {
  if (!weather) return false;
  if (weather.available === false) return false;
  if (weather.planningMode === 'seasonal' || weather.planningMode === 'unavailable') return false;
  if (!Array.isArray(weather.days) || weather.days.length === 0) return false;
  return true;
}

export function isUsableWeatherContext(ctx?: WeatherContext | null): boolean {
  if (!ctx) return false;
  if (!ctx.weatherAvailable) return false;
  if (!Array.isArray(ctx.daily) || ctx.daily.length === 0) return false;
  const provider = ctx.provider;
  if (provider !== 'open_meteo' && provider !== 'google_weather') return false;
  return true;
}

/** Trip has at least one day overlapping forecast daily dates (ISO YYYY-MM-DD). */
export function tripOverlapsForecastDays(
  tripStart: string | undefined,
  tripEnd: string | undefined,
  dailyDates: string[],
): boolean {
  if (!tripStart?.trim() || dailyDates.length === 0) return false;
  const start = tripStart.trim();
  const end = (tripEnd?.trim() || start);
  return dailyDates.some((date) => date >= start && date <= end);
}

export function getWeatherReplanUnavailableMessage(
  weather?: WeatherForecast | null,
  weatherContext?: WeatherContext | null,
): string {
  const reason =
    weatherContext?.unavailableReason ??
    weather?.unavailableReason ??
    (weather?.planningMode === 'seasonal' ? 'outside_forecast_range' : 'fetch_failed');

  switch (reason) {
    case 'outside_forecast_range':
      return '旅行日はまだ予報対象期間外です。出発が近づいたら最新の天気で再調整できます。';
    case 'location_unresolved':
      return '旅行先の位置を確認できないため、天気を取得できませんでした。';
    case 'fetch_failed':
    case 'no_forecast_data':
    case 'missing_api_key':
    case 'api_disabled':
    case 'unsupported_location':
    case 'invalid_request':
      return '天気の取得に失敗しました。時間を置いて再度お試しください。';
    default:
      return getWeatherUnavailableUserMessage(reason);
  }
}

export function logWeatherReplanDev(payload: {
  weatherAvailableAtPlanDetail: boolean;
  weatherAvailableAtReplan: boolean;
  dailyCountAtReplan: number;
  hourlyCountAtReplan: number;
  requestedDateRange: string | null;
  forecastDateRange: string | null;
  unavailableReason: string | null;
  reusedExistingWeatherContext: boolean;
  weatherRefetchAttempted: boolean;
  weatherReplanEligible: boolean;
  resolveSource: WeatherReplanResolveSource;
}): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[weather-replan]', payload);
}
