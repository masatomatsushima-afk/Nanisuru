import type { WeatherForecast } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';

export type WeatherReplanEligibility =
  | {
      status: 'ready';
      highlight?: boolean;
      daysUntil: number;
      /** Button label — weatherAvailable / fetch_failed / etc. */
      buttonLabel: string;
    }
  | { status: 'future'; message: string }
  | { status: 'hidden' };

export type WeatherReplanPreviewSuccess = {
  success: true;
  beforePayload: SavedTripPayload;
  afterPayload: SavedTripPayload;
  freshWeather: WeatherForecast;
  previousWeather?: WeatherForecast;
  changePoints: string[];
  /** Number of daily forecast days used for this replan. */
  forecastDayCount?: number;
  reusedExistingWeatherContext?: boolean;
};

export type WeatherReplanPreviewFailure = {
  success: false;
  errorMessage: string;
};

export type WeatherReplanPreview = WeatherReplanPreviewSuccess | WeatherReplanPreviewFailure;

export type WeatherReplanRecord = {
  id: string;
  userId: string;
  tripId: string | null;
  planId: string | null;
  beforePlan: SavedTripPayload;
  afterPlan: SavedTripPayload;
  weatherContext: WeatherForecast;
  createdAt: string;
};
