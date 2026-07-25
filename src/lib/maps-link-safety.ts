/**
 * Safe Google Maps link helpers — never emit URLs with invalid coords / place ids.
 */

import {
  buildGoogleMapsPlaceIdUrl,
  buildGoogleMapsPlaceUrl,
  buildGoogleMapsSearchUrl,
} from '@/lib/geo';
import { scopeMapsQueryToLocation } from '@/lib/destination-safety';
import type { ItineraryItem } from '@/types/plan';

export type MapsLinkType = 'place_id' | 'coordinates' | 'text_search' | 'none';

export type ResolvedMapsLink = {
  url: string;
  type: MapsLinkType;
};

const BROKEN_TOKEN_PATTERN = /(?:^|[^\w])(?:undefined|null|NaN|invalid)(?:$|[^\w])/i;

/** Coerce unknown lat/lng into a finite number, or null. */
export function parseCoordinateNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || /^(undefined|null|nan|invalid)$/i.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Valid geographic coordinates for Maps links.
 * Treats (0, 0) as unresolved (never a real trip pin in this product).
 */
export function hasValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): boolean {
  const lat = parseCoordinateNumber(latitude);
  const lng = parseCoordinateNumber(longitude);
  if (lat === null || lng === null) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function parseItemCoordinates(
  item: Pick<ItineraryItem, 'coordinates' | 'latitude' | 'longitude'>,
): { latitude: number; longitude: number } | null {
  const fromObject = item.coordinates;
  if (fromObject && hasValidCoordinates(fromObject.latitude, fromObject.longitude)) {
    return {
      latitude: parseCoordinateNumber(fromObject.latitude)!,
      longitude: parseCoordinateNumber(fromObject.longitude)!,
    };
  }
  if (hasValidCoordinates(item.latitude, item.longitude)) {
    return {
      latitude: parseCoordinateNumber(item.latitude)!,
      longitude: parseCoordinateNumber(item.longitude)!,
    };
  }
  return null;
}

/**
 * Accept only place IDs that look usable by Google Maps.
 * Rejects mock: ids, literal "undefined"/"null", empty, and query_place_id-breaking junk.
 */
export function isValidGooglePlaceId(placeId: unknown): boolean {
  if (typeof placeId !== 'string') return false;
  const trimmed = placeId.trim();
  if (!trimmed) return false;
  if (/^(undefined|null|nan|invalid)$/i.test(trimmed)) return false;
  if (BROKEN_TOKEN_PATTERN.test(trimmed)) return false;
  if (/^mock:/i.test(trimmed)) return false;
  // Google Place IDs are opaque but typically long alphanumeric (+ optional places/ prefix).
  if (trimmed.length < 12) return false;
  if (!/^(places\/)?[A-Za-z0-9_-]+$/.test(trimmed)) return false;
  return true;
}

export function sanitizePlaceId(placeId: unknown): string | null {
  return isValidGooglePlaceId(placeId) ? String(placeId).trim() : null;
}

/** True when a URL string contains tokens that would produce Loading...(invalid coord). */
export function urlLooksBrokenForMaps(url: string): boolean {
  const value = url.trim();
  if (!value) return true;
  if (/undefined|null|NaN|invalid/i.test(value)) return true;
  if (/query_place_id=(?:&|$)/i.test(value)) return true;
  if (/destination=(?:,|&|$)/i.test(value)) return true;
  if (/destination=(?:undefined|null|NaN)/i.test(value)) return true;
  if (/[?&]query=(?:&|$)/i.test(value)) return true;
  if (/@nan,@nan/i.test(value) || /@undefined/i.test(value)) return true;
  return false;
}

function isConcretePlaceName(name: string | undefined): boolean {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return false;
  if (trimmed.length < 2) return false;
  // Abstract / transit / stroll phrases — not safe as sole Maps query.
  if (/^(散策|移動|休憩|フリー|エリア|周辺|explore|stroll|area)$/i.test(trimmed)) return false;
  if (/を散策|周辺を|エリアを|チェックアウト|移動$/.test(trimmed)) return false;
  return true;
}

/**
 * Build a destination-scoped text search query: placeName + area + city + country.
 * Never returns a bare place name alone when destination context is available.
 */
export function buildSafeMapsSearchQuery(params: {
  placeName?: string | null;
  area?: string | null;
  city?: string | null;
  country?: string | null;
  mapsQuery?: string | null;
  locationFallback?: string | null;
}): string | null {
  const existing = params.mapsQuery?.trim();
  if (existing && !BROKEN_TOKEN_PATTERN.test(existing) && !/^(undefined|null)$/i.test(existing)) {
    const scoped = scopeMapsQueryToLocation(existing, params.locationFallback ?? undefined);
    if (scoped.trim() && !BROKEN_TOKEN_PATTERN.test(scoped)) return scoped.trim();
  }

  const placeName = params.placeName?.trim();
  if (!isConcretePlaceName(placeName)) return null;

  const parts = [
    placeName,
    params.area?.trim(),
    params.city?.trim(),
    params.country?.trim(),
  ].filter((part): part is string => Boolean(part && part.length > 0));

  // Deduplicate consecutive / case-insensitive repeats (e.g. Seoul Seoul).
  const deduped: string[] = [];
  for (const part of parts) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.toLowerCase() === part.toLowerCase()) continue;
    if (deduped.some((p) => p.toLowerCase() === part.toLowerCase()) && part !== placeName) {
      continue;
    }
    deduped.push(part);
  }

  if (deduped.length < 2 && params.locationFallback?.trim()) {
    deduped.push(params.locationFallback.trim());
  }

  if (deduped.length < 2) return null;

  const query = deduped.join(' ').trim();
  if (!query || BROKEN_TOKEN_PATTERN.test(query)) return null;
  return query;
}

export function resolveItineraryMapsLink(
  item: ItineraryItem,
  location?: string,
): ResolvedMapsLink | null {
  // Prefer an already-valid Maps website URL only when it does not look broken.
  const website = item.websiteUrl?.trim();
  if (website && /google\.com\/maps/i.test(website) && !urlLooksBrokenForMaps(website)) {
    return { url: website, type: 'place_id' };
  }

  const placeId = sanitizePlaceId(item.placeId);
  const coords = parseItemCoordinates(item);
  const searchQuery = buildSafeMapsSearchQuery({
    placeName: item.placeName || item.activity,
    area: item.placeAddress,
    city: undefined,
    country: undefined,
    mapsQuery: item.mapsQuery,
    locationFallback: location,
  });

  // A. Valid placeId
  if (placeId) {
    const fallbackQuery =
      searchQuery ||
      scopeMapsQueryToLocation(
        item.placeName?.trim() || item.activity.trim() || 'destination',
        location,
      );
    if (!fallbackQuery.trim() || BROKEN_TOKEN_PATTERN.test(fallbackQuery)) {
      // placeId alone without a safe query — still usable if placeId is real.
      const url = buildGoogleMapsPlaceIdUrl(placeId, item.placeName?.trim() || 'place');
      if (!urlLooksBrokenForMaps(url)) return { url, type: 'place_id' };
    } else {
      const url = buildGoogleMapsPlaceIdUrl(placeId, fallbackQuery);
      if (!urlLooksBrokenForMaps(url)) return { url, type: 'place_id' };
    }
  }

  // B. Valid coordinates
  if (coords) {
    const label =
      item.placeName?.trim() ||
      searchQuery ||
      item.activity.trim() ||
      'place';
    const url = buildGoogleMapsPlaceUrl(coords.latitude, coords.longitude, label);
    if (!urlLooksBrokenForMaps(url)) return { url, type: 'coordinates' };
  }

  // C. Concrete name + destination-scoped text search
  if (searchQuery) {
    const url = buildGoogleMapsSearchUrl(searchQuery);
    if (!urlLooksBrokenForMaps(url)) return { url, type: 'text_search' };
  }

  // D. Nothing safe
  return null;
}

/** Directions only for confirmed specific places with a valid placeId or coordinates. */
export function canOfferDirectionsForItem(item: ItineraryItem): boolean {
  if (item.isSpecificPlace !== true) return false;
  if (item.activityCategory === '移動') return false;
  return Boolean(sanitizePlaceId(item.placeId) || parseItemCoordinates(item));
}

export function buildDirectionsDestinationSafe(
  item: ItineraryItem,
  location?: string,
): string | null {
  const coords = parseItemCoordinates(item);
  if (coords) {
    return `${coords.latitude},${coords.longitude}`;
  }

  const placeId = sanitizePlaceId(item.placeId);
  const searchQuery = buildSafeMapsSearchQuery({
    placeName: item.placeName || item.activity,
    area: item.placeAddress,
    mapsQuery: item.mapsQuery,
    locationFallback: location,
  });

  if (placeId && searchQuery) return searchQuery;
  if (searchQuery) return searchQuery;
  return null;
}

export function logMapsLinkDiagnostics(
  item: ItineraryItem,
  location?: string,
): void {
  if (process.env.NODE_ENV === 'production') return;
  const resolved = resolveItineraryMapsLink(item, location);
  const directionsAvailable = canOfferDirectionsForItem(item);
  console.info('[maps-link]', {
    hasPlaceId: Boolean(sanitizePlaceId(item.placeId)),
    hasValidCoordinates: Boolean(parseItemCoordinates(item)),
    hasSafeMapsQuery: Boolean(
      buildSafeMapsSearchQuery({
        placeName: item.placeName || item.activity,
        area: item.placeAddress,
        mapsQuery: item.mapsQuery,
        locationFallback: location,
      }),
    ),
    source: item.source ?? null,
    isSpecificPlace: item.isSpecificPlace ?? null,
    mapsLinkType: resolved?.type ?? 'none',
    directionsAvailable,
    invalidMapsDataBlocked: resolved === null,
  });
}
