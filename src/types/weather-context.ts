/**
 * Provider-agnostic Weather Context (Phase 1).
 * Plan generation / Places ranking / outfit UI must not depend on provider-shaped payloads.
 */

/** Runtime provider id stored on WeatherContext (never a raw Google/Open-Meteo payload). */
export type WeatherProviderId = 'open_meteo' | 'google_weather' | 'none';

/** @deprecated Use WeatherProviderId — kept as alias for existing imports. */
export type WeatherProvider = WeatherProviderId;

export type WeatherAvailability = boolean;

/**
 * Predictable soft-failure reasons. Never treat these as red hard errors.
 */
export type WeatherUnavailableReason =
  | 'location_unresolved'
  | 'outside_forecast_range'
  | 'unsupported_location'
  | 'missing_api_key'
  | 'api_disabled'
  | 'fetch_failed'
  | 'invalid_request'
  | 'no_forecast_data';

/** Normalized condition — provider codes mapped to lowercase snake when known. */
export type WeatherCondition = {
  /** e.g. "clear", "rain", "partly_cloudy", or passthrough lowercase of provider type */
  code: string;
  description: string | null;
};

export type WeatherLocation = {
  latitude: number;
  longitude: number;
  /** Human label when known (city / area / accommodation); never invent coords for a label. */
  label: string | null;
  /**
   * How coordinates were obtained.
   * accommodation → base_area → destination_coordinates → places_geocode → open_meteo_geocode
   */
  source:
    | 'accommodation'
    | 'base_area'
    | 'destination_coordinates'
    | 'places_geocode'
    | 'open_meteo_geocode';
};

export type DailyWeatherForecast = {
  date: string; // YYYY-MM-DD (local civil date at location)
  condition: WeatherCondition | null;
  /** Daytime / representative high (°C) when available */
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  feelsLikeMaxC: number | null;
  feelsLikeMinC: number | null;
  precipitationProbabilityPercent: number | null;
  precipitationAmountMm: number | null;
  windSpeedKph: number | null;
  humidityPercent: number | null;
  sunrise: string | null; // RFC3339 / ISO when available
  sunset: string | null;
};

export type HourlyWeatherForecast = {
  time: string; // RFC3339 / ISO local or offset datetime
  date: string; // YYYY-MM-DD derived for trip filtering
  condition: WeatherCondition | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  precipitationProbabilityPercent: number | null;
  precipitationAmountMm: number | null;
  windSpeedKph: number | null;
  humidityPercent: number | null;
};

export type WeatherContext = {
  weatherAvailable: WeatherAvailability;
  provider: WeatherProviderId;
  /** Optional attribution for future UI (e.g. "Weather data by Open-Meteo"). */
  attribution: string | null;
  fetchedAt: string | null; // ISO timestamp when fetch succeeded
  timezone: string | null; // IANA id when known
  location: WeatherLocation | null;
  forecastStartDate: string | null; // trip start YYYY-MM-DD
  forecastEndDate: string | null; // trip end YYYY-MM-DD
  daily: DailyWeatherForecast[];
  hourly: HourlyWeatherForecast[];
  /** True when some but not all trip days have forecast coverage */
  partialForecast: boolean;
  unavailableReason?: WeatherUnavailableReason;
};
