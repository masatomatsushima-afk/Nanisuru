/**
 * POST /api/weather-context
 * Server-side weather → normalized WeatherContext (default: Open-Meteo).
 * Predictable failures return HTTP 200 with weatherAvailable: false.
 */

import { buildWeatherContext } from '@/lib/weather-context/weather-context-service';
import type { NamedPlaceLike } from '@/lib/weather-context/weather-location-resolver';

type WeatherContextRequestBody = {
  destination?: string;
  country?: string;
  city?: string;
  baseArea?: NamedPlaceLike;
  accommodation?: NamedPlaceLike;
  coordinates?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  startDate?: string;
  endDate?: string;
};

export async function POST(request: Request): Promise<Response> {
  let body: WeatherContextRequestBody;
  try {
    body = (await request.json()) as WeatherContextRequestBody;
  } catch {
    return Response.json(
      {
        ok: true,
        weatherContext: {
          weatherAvailable: false,
          provider: 'none',
          fetchedAt: null,
          timezone: null,
          location: null,
          forecastStartDate: null,
          forecastEndDate: null,
          daily: [],
          hourly: [],
          partialForecast: false,
          unavailableReason: 'invalid_request',
          attribution: null,
        },
      },
      { status: 200 },
    );
  }

  try {
    const { weatherContext } = await buildWeatherContext({
      destination: body.destination,
      country: body.country,
      city: body.city,
      baseArea: body.baseArea,
      accommodation: body.accommodation,
      coordinates: body.coordinates,
      startDate: body.startDate,
      endDate: body.endDate,
    });

    return Response.json({ ok: true, weatherContext }, { status: 200 });
  } catch {
    // Absolute soft-fail — never surface a red 500 for weather.
    return Response.json(
      {
        ok: true,
        weatherContext: {
          weatherAvailable: false,
          provider: 'none',
          attribution: null,
          fetchedAt: null,
          timezone: null,
          location: null,
          forecastStartDate: null,
          forecastEndDate: null,
          daily: [],
          hourly: [],
          partialForecast: false,
          unavailableReason: 'fetch_failed',
        },
      },
      { status: 200 },
    );
  }
}
