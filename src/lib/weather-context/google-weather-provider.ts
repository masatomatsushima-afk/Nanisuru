/**
 * Google WeatherProvider — kept for WEATHER_PROVIDER=google | auto fallback.
 * Not deleted. Japan/Korea often return unsupported_location (soft).
 */

import type { WeatherContext } from '@/types/weather-context';
import { fetchGoogleWeatherForecasts } from './google-weather-client';
import { buildWeatherContextFromGoogle } from './weather-context-normalize';
import {
  createUnavailableWeatherContext,
  GOOGLE_WEATHER_ATTRIBUTION,
} from './weather-context-assemble';
import type { WeatherProvider, WeatherProviderFetchInput } from './weather-provider';

export class GoogleWeatherProvider implements WeatherProvider {
  readonly providerName = 'google_weather' as const;

  /**
   * Google Weather coverage is region-limited; we still attempt when coords are valid.
   * Unsupported regions soft-fail as unsupported_location after the API responds.
   */
  supportsLocation(input: WeatherProviderFetchInput): boolean {
    const { latitude, longitude } = input.location;
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  async fetchWeatherContext(input: WeatherProviderFetchInput): Promise<WeatherContext> {
    if (!this.supportsLocation(input)) {
      return createUnavailableWeatherContext({
        reason: 'location_unresolved',
        location: input.location,
        forecastStartDate: input.startDate,
        forecastEndDate: input.endDate,
        attribution: GOOGLE_WEATHER_ATTRIBUTION,
      });
    }

    const fetched = await fetchGoogleWeatherForecasts({
      latitude: input.location.latitude,
      longitude: input.location.longitude,
    });

    if (!fetched.ok) {
      return createUnavailableWeatherContext({
        reason: fetched.reason,
        location: input.location,
        forecastStartDate: input.startDate,
        forecastEndDate: input.endDate,
        attribution: GOOGLE_WEATHER_ATTRIBUTION,
        provider: 'none',
      });
    }

    if (!fetched.days.forecastDays?.length) {
      return createUnavailableWeatherContext({
        reason: 'no_forecast_data',
        location: input.location,
        timezone: fetched.days.timeZone?.id ?? null,
        forecastStartDate: input.startDate,
        forecastEndDate: input.endDate,
        attribution: GOOGLE_WEATHER_ATTRIBUTION,
      });
    }

    return buildWeatherContextFromGoogle({
      location: input.location,
      startDate: input.startDate,
      endDate: input.endDate,
      daysResponse: fetched.days,
      hoursResponse: fetched.hours,
    });
  }
}

export const googleWeatherProvider = new GoogleWeatherProvider();
