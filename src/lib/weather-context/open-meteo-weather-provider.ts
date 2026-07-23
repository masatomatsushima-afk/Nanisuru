/**
 * Open-Meteo WeatherProvider — primary for Japan / Korea / global coverage.
 */

import type { WeatherContext } from '@/types/weather-context';
import { fetchOpenMeteoForecast } from './open-meteo-client';
import { buildWeatherContextFromOpenMeteo } from './open-meteo-normalize';
import { createUnavailableWeatherContext, OPEN_METEO_ATTRIBUTION } from './weather-context-assemble';
import type { WeatherProvider, WeatherProviderFetchInput } from './weather-provider';

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly providerName = 'open_meteo' as const;

  /** Open-Meteo covers worldwide land/ocean grids — always supported when coords are valid. */
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
        attribution: OPEN_METEO_ATTRIBUTION,
      });
    }

    const fetched = await fetchOpenMeteoForecast({
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    if (!fetched.ok) {
      return createUnavailableWeatherContext({
        reason: fetched.reason,
        location: input.location,
        forecastStartDate: input.startDate,
        forecastEndDate: input.endDate,
        attribution: OPEN_METEO_ATTRIBUTION,
      });
    }

    return buildWeatherContextFromOpenMeteo({
      location: input.location,
      startDate: input.startDate,
      endDate: input.endDate,
      data: fetched.data,
    });
  }
}

export const openMeteoWeatherProvider = new OpenMeteoWeatherProvider();
