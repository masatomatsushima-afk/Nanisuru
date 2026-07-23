/** In-memory weather cache TTL (dev restart clears). Do not put API keys in cache keys. */
export const WEATHER_CONTEXT_CACHE_TTL_MS = 30 * 60 * 1000;

/** @deprecated Prefer resolveWeatherProviderMode(); default provider is open_meteo. */
export const WEATHER_CONTEXT_PROVIDER = 'open_meteo' as const;

export const GOOGLE_WEATHER_DAYS_URL =
  'https://weather.googleapis.com/v1/forecast/days:lookup';
export const GOOGLE_WEATHER_HOURS_URL =
  'https://weather.googleapis.com/v1/forecast/hours:lookup';

export const WEATHER_FETCH_TIMEOUT_MS = 10_000;

/** Round lat/lng for cache keys only (not for API requests). */
export const WEATHER_CACHE_COORD_DECIMALS = 3;
