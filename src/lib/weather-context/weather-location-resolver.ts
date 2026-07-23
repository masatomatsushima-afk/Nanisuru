/**
 * Resolve lat/lng for Weather Context without inventing coordinates.
 *
 * Priority:
 * 1. accommodation / hotel existing coordinates
 * 2. baseArea existing coordinates
 * 3. destination city existing Google Places coordinates (request.coordinates / Places text search)
 * 4. existing safe Open-Meteo geocode (same pattern as src/lib/weather.ts)
 */

import type { WeatherLocation } from '@/types/weather-context';
import { finiteNumber, isValidLatitude, isValidLongitude } from './weather-context-numbers';

export type CoordLike = {
  latitude?: unknown;
  longitude?: unknown;
  lat?: unknown;
  lng?: unknown;
};

export type NamedPlaceLike =
  | string
  | (CoordLike & { name?: unknown; label?: unknown })
  | null
  | undefined;

export type WeatherLocationResolveInput = {
  destination?: string | null;
  country?: string | null;
  city?: string | null;
  baseArea?: NamedPlaceLike;
  accommodation?: NamedPlaceLike;
  /** Destination-city coordinates already known (e.g. from Places). */
  coordinates?: CoordLike | null;
};

export type WeatherLocationResolveResult = {
  location: WeatherLocation | null;
  locationResolved: boolean;
};

type ParsedCoords = { latitude: number; longitude: number };

function parseCoords(value: CoordLike | null | undefined): ParsedCoords | null {
  if (!value || typeof value !== 'object') return null;
  const latitude = finiteNumber(value.latitude ?? value.lat);
  const longitude = finiteNumber(value.longitude ?? value.lng);
  if (latitude === null || longitude === null) return null;
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  return { latitude, longitude };
}

function namedLabel(value: NamedPlaceLike): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t || null;
  }
  if (value && typeof value === 'object') {
    const name =
      (typeof value.name === 'string' && value.name.trim()) ||
      (typeof value.label === 'string' && value.label.trim()) ||
      '';
    return name || null;
  }
  return null;
}

function namedCoords(value: NamedPlaceLike): ParsedCoords | null {
  if (!value || typeof value === 'string') return null;
  return parseCoords(value);
}

function buildLabel(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);
  return cleaned.length ? cleaned.join(' · ') : null;
}

const PLACES_KEY_PLACEHOLDERS = new Set([
  '',
  'your-google-places-api-key',
  'your-google-maps-api-key',
]);

function getPlacesApiKey(): string | undefined {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key || PLACES_KEY_PLACEHOLDERS.has(key)) return undefined;
  return key;
}

type GeocodeResult = { latitude: number; longitude: number; label: string };

/**
 * Destination city via Google Places Text Search (real Places lat/lng).
 * Soft-fails to null — never invents coordinates.
 */
async function geocodeViaGooglePlaces(query: string): Promise<GeocodeResult | null> {
  const apiKey = getPlacesApiKey();
  if (!apiKey || !query.trim()) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.location,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: query.trim(), maxResultCount: 1 }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const data = (await response.json()) as {
      places?: Array<{
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }>;
    };
    const place = data.places?.[0];
    const latitude = finiteNumber(place?.location?.latitude);
    const longitude = finiteNumber(place?.location?.longitude);
    if (latitude === null || longitude === null) return null;
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;

    const label =
      place?.displayName?.text?.trim() ||
      place?.formattedAddress?.trim() ||
      query.trim();
    return { latitude, longitude, label };
  } catch {
    return null;
  }
}

type OpenMeteoGeocodeResponse = {
  results?: Array<{
    name?: string;
    admin1?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }>;
};

/**
 * Existing safe location resolver (Open-Meteo geocoding), same approach as weather.ts.
 */
async function geocodeViaOpenMeteo(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
      '&count=5&language=ja&format=json';
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as OpenMeteoGeocodeResponse;
    const result = data.results?.[0];
    const latitude = finiteNumber(result?.latitude);
    const longitude = finiteNumber(result?.longitude);
    if (latitude === null || longitude === null) return null;
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;

    const label = [result?.name, result?.admin1, result?.country].filter(Boolean).join('・') || q;
    return { latitude, longitude, label };
  } catch {
    return null;
  }
}

function cityCountryQuery(input: WeatherLocationResolveInput): string | null {
  const city = input.city?.trim() || '';
  const country = input.country?.trim() || '';
  const destination = input.destination?.trim() || '';
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (destination && country) return `${destination}, ${country}`;
  if (destination) return destination;
  if (country) return country;
  return null;
}

/**
 * Resolve weather location. Never invents lat/lng.
 */
export async function resolveWeatherLocation(
  input: WeatherLocationResolveInput,
): Promise<WeatherLocationResolveResult> {
  const accommodationCoords = namedCoords(input.accommodation);
  if (accommodationCoords) {
    return {
      locationResolved: true,
      location: {
        ...accommodationCoords,
        label: namedLabel(input.accommodation) ?? buildLabel([input.city, input.country]),
        source: 'accommodation',
      },
    };
  }

  const baseAreaCoords = namedCoords(input.baseArea);
  if (baseAreaCoords) {
    return {
      locationResolved: true,
      location: {
        ...baseAreaCoords,
        label: namedLabel(input.baseArea) ?? buildLabel([input.city, input.country]),
        source: 'base_area',
      },
    };
  }

  const destinationCoords = parseCoords(input.coordinates ?? undefined);
  if (destinationCoords) {
    return {
      locationResolved: true,
      location: {
        ...destinationCoords,
        label: buildLabel([input.city, input.country, input.destination]),
        source: 'destination_coordinates',
      },
    };
  }

  const query = cityCountryQuery(input);
  const baseAreaName = namedLabel(input.baseArea);
  const accommodationName = namedLabel(input.accommodation);

  // Prefer Places for destination city when key is available (real Google Places coords).
  if (query) {
    const places = await geocodeViaGooglePlaces(query);
    if (places) {
      return {
        locationResolved: true,
        location: {
          latitude: places.latitude,
          longitude: places.longitude,
          label: places.label,
          source: 'places_geocode',
        },
      };
    }
  }

  // Existing safe resolver — try specific names then city/country.
  const geocodeCandidates = [
    accommodationName && query ? `${accommodationName}, ${query}` : null,
    baseAreaName && query ? `${baseAreaName}, ${query}` : null,
    query,
    accommodationName,
    baseAreaName,
  ].filter((v): v is string => Boolean(v));

  for (const candidate of geocodeCandidates) {
    const geo = await geocodeViaOpenMeteo(candidate);
    if (geo) {
      return {
        locationResolved: true,
        location: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          label: geo.label,
          source: 'open_meteo_geocode',
        },
      };
    }
  }

  return { location: null, locationResolved: false };
}
