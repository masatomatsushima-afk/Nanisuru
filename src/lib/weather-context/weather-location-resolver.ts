/**
 * Resolve lat/lng for Weather Context without inventing coordinates.
 *
 * Priority:
 * 1. accommodation / hotel existing coordinates
 * 2. baseArea existing coordinates
 * 3. destination city existing Google Places coordinates (request.coordinates / Places text search)
 * 4. existing safe Open-Meteo geocode (same pattern as src/lib/weather.ts)
 *
 * Open-Meteo often returns 0 for "city, country" and for some Japanese kanji city names.
 * We therefore try Latin aliases and the legacy country→city mapper before giving up.
 */

import { resolveWeatherLocation as mapDestinationToWeatherCity } from '@/lib/weather';
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

/** Japanese (and common) place labels → Open-Meteo-friendly Latin queries. */
const GEOCODE_LATIN_ALIASES: Record<string, string> = {
  大阪: 'Osaka',
  東京: 'Tokyo',
  京都: 'Kyoto',
  神戸: 'Kobe',
  名古屋: 'Nagoya',
  福岡: 'Fukuoka',
  札幌: 'Sapporo',
  横浜: 'Yokohama',
  ソウル: 'Seoul',
  釜山: 'Busan',
  済州: 'Jeju',
  韓国: 'Seoul',
  日本: 'Tokyo',
  パリ: 'Paris',
  メルボルン: 'Melbourne',
  シドニー: 'Sydney',
  バンコク: 'Bangkok',
  ニューヨーク: 'New York',
};

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

function latinAlias(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return GEOCODE_LATIN_ALIASES[key] ?? null;
}

/**
 * Build geocode query candidates that Open-Meteo actually resolves.
 * Prefer single-token Latin city names; avoid leading with "city, country"
 * (often returns zero results for JP/KR locales).
 */
export function buildWeatherGeocodeCandidates(input: WeatherLocationResolveInput): string[] {
  const city = input.city?.trim() || '';
  const country = input.country?.trim() || '';
  const destination = input.destination?.trim() || '';
  const baseAreaName = namedLabel(input.baseArea);
  const accommodationName = namedLabel(input.accommodation);

  const mappedDestination = destination ? mapDestinationToWeatherCity(destination) : '';
  const mappedCountry = country ? mapDestinationToWeatherCity(country) : '';
  const mappedCity = city ? mapDestinationToWeatherCity(city) : '';

  const destForCombo = latinAlias(destination) ?? (mappedDestination || destination);
  const countryForCombo = latinAlias(country) ?? country;

  const ordered: string[] = [
    latinAlias(city),
    latinAlias(destination),
    latinAlias(country),
    mappedCity !== city ? mappedCity : null,
    city,
    mappedDestination !== destination ? mappedDestination : null,
    destination,
    // Country-only → default city (e.g. 韓国 → Seoul)
    mappedCountry && mappedCountry !== country ? mappedCountry : null,
    latinAlias(mappedCountry),
    // Combined forms last (sometimes work for Latin pairs like Osaka, Japan)
    city && country ? `${latinAlias(city) ?? city}, ${countryForCombo}` : null,
    city && country ? `${city}, ${country}` : null,
    destination && country && destForCombo ? `${destForCombo}, ${countryForCombo}` : null,
    baseAreaName ? latinAlias(baseAreaName) ?? baseAreaName : null,
    accommodationName ? latinAlias(accommodationName) ?? accommodationName : null,
    country,
  ].filter((v): v is string => Boolean(v && v.trim()));

  // Dedupe while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const q of ordered) {
    const key = q.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(q.trim());
  }
  return unique;
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

  const candidates = buildWeatherGeocodeCandidates(input);

  // Prefer Places for the strongest candidate when key is available.
  for (const query of candidates.slice(0, 3)) {
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

  for (const candidate of candidates) {
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
