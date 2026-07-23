/** Open-Meteo forecast API response shapes (internal only). */

export type OpenMeteoForecastResponse = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    apparent_temperature?: Array<number | null>;
    relative_humidity_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    precipitation?: Array<number | null>;
    weather_code?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
  };
  daily?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    apparent_temperature_max?: Array<number | null>;
    apparent_temperature_min?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    sunrise?: Array<string | null>;
    sunset?: Array<string | null>;
  };
};
