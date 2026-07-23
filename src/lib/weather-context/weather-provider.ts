/**
 * Shared WeatherProvider contract.
 * Downstream plan code consumes WeatherContext only — never provider-native JSON.
 */

import type {
  WeatherContext,
  WeatherLocation,
  WeatherProviderId,
} from '@/types/weather-context';

export type WeatherProviderName = Exclude<WeatherProviderId, 'none'>;

export type WeatherProviderFetchInput = {
  location: WeatherLocation;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

export interface WeatherProvider {
  readonly providerName: WeatherProviderName;
  supportsLocation(input: WeatherProviderFetchInput): boolean;
  fetchWeatherContext(input: WeatherProviderFetchInput): Promise<WeatherContext>;
}

/** Env WEATHER_PROVIDER: open_meteo (default) | google | auto */
export type WeatherProviderMode = 'open_meteo' | 'google' | 'auto';

export function resolveWeatherProviderMode(
  envValue: string | undefined = process.env.WEATHER_PROVIDER,
): WeatherProviderMode {
  const raw = (envValue ?? 'open_meteo').trim().toLowerCase();
  if (raw === 'google' || raw === 'google_weather') return 'google';
  if (raw === 'auto') return 'auto';
  return 'open_meteo';
}
