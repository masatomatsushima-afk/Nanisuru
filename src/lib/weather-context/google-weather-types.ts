/**
 * Minimal Google Weather API response shapes (internal only).
 * Downstream code must consume WeatherContext, not these types.
 */

export type GoogleTemperature = {
  degrees?: number;
  unit?: string;
};

export type GoogleWeatherCondition = {
  type?: string;
  description?: { text?: string; languageCode?: string };
  iconBaseUri?: string;
};

export type GooglePrecipitation = {
  probability?: { percent?: number; type?: string };
  qpf?: { quantity?: number; unit?: string };
  snowQpf?: { quantity?: number; unit?: string };
};

export type GoogleWind = {
  speed?: { value?: number; unit?: string };
  gust?: { value?: number; unit?: string };
  direction?: { degrees?: number; cardinal?: string };
};

export type GoogleForecastDayPart = {
  interval?: { startTime?: string; endTime?: string };
  weatherCondition?: GoogleWeatherCondition;
  precipitation?: GooglePrecipitation;
  wind?: GoogleWind;
  relativeHumidity?: number;
  cloudCover?: number;
  uvIndex?: number;
};

export type GoogleForecastDay = {
  interval?: { startTime?: string; endTime?: string };
  displayDate?: { year?: number; month?: number; day?: number };
  daytimeForecast?: GoogleForecastDayPart;
  nighttimeForecast?: GoogleForecastDayPart;
  maxTemperature?: GoogleTemperature;
  minTemperature?: GoogleTemperature;
  feelsLikeMaxTemperature?: GoogleTemperature;
  feelsLikeMinTemperature?: GoogleTemperature;
  sunEvents?: { sunriseTime?: string; sunsetTime?: string };
};

export type GoogleDaysLookupResponse = {
  forecastDays?: GoogleForecastDay[];
  timeZone?: { id?: string };
  nextPageToken?: string;
};

export type GoogleForecastHour = {
  interval?: { startTime?: string; endTime?: string };
  displayDateTime?: {
    year?: number;
    month?: number;
    day?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    nanos?: number;
    utcOffset?: string;
    timeZone?: { id?: string };
  };
  weatherCondition?: GoogleWeatherCondition;
  temperature?: GoogleTemperature;
  feelsLikeTemperature?: GoogleTemperature;
  precipitation?: GooglePrecipitation;
  wind?: GoogleWind;
  relativeHumidity?: number;
};

export type GoogleHoursLookupResponse = {
  forecastHours?: GoogleForecastHour[];
  timeZone?: { id?: string };
  nextPageToken?: string;
};
