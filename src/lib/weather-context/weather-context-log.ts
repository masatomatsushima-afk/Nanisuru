/**
 * Safe weather-context diagnostic logs (dev only).
 * Never log API keys, full Google payloads, or secrets.
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

export type WeatherContextDevLog = {
  weatherProvider: string;
  weatherAvailable: boolean;
  unavailableReason?: string;
  locationResolved: boolean;
  requestedDateRange: string;
  returnedDailyCount: number;
  returnedHourlyCount: number;
  partialForecast: boolean;
  cacheHit: boolean;
  elapsedMs: number;
};

export function logWeatherContextDev(payload: WeatherContextDevLog): void {
  if (!IS_DEV) return;
  console.info('[weather-context]', {
    weatherProvider: payload.weatherProvider,
    weatherAvailable: payload.weatherAvailable,
    unavailableReason: payload.unavailableReason ?? null,
    locationResolved: payload.locationResolved,
    requestedDateRange: payload.requestedDateRange,
    returnedDailyCount: payload.returnedDailyCount,
    returnedHourlyCount: payload.returnedHourlyCount,
    partialForecast: payload.partialForecast,
    cacheHit: payload.cacheHit,
    elapsedMs: payload.elapsedMs,
  });
}
