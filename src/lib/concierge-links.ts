import type { ItineraryItem } from '@/types/plan';
import { buildGoogleMapsDirectionsUrl } from '@/lib/geo';
import {
  buildDirectionsDestinationSafe,
  canOfferDirectionsForItem,
  logMapsLinkDiagnostics,
  resolveItineraryMapsLink,
  sanitizePlaceId,
} from '@/lib/maps-link-safety';
import { scopeMapsQueryToLocation } from '@/lib/destination-safety';

export function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^https?:\/\/.+/i.test(trimmed);
}

/**
 * Builds the query used for both "open in Google Maps" and "directions" links. Always prefers
 * the item's own destination-scoped mapsQuery (set at generation time); only falls back to raw
 * title/address text for legacy items that predate mapsQuery, and even then the destination is
 * appended so the search can never resolve near the device's current location instead of the
 * actual trip destination.
 *
 * Returns empty string when nothing safe can be built — callers must not open Maps with it.
 */
export function buildDirectionsDestination(item: ItineraryItem, location?: string): string {
  return (
    buildDirectionsDestinationSafe(item, location) ||
    scopeMapsQueryToLocation(
      item.mapsQuery?.trim() || item.placeName?.trim() || item.activity.trim(),
      location,
    )
  );
}

/**
 * Maps button URL. Priority:
 * A) valid placeId → place_id URL
 * B) valid coordinates → coord URL
 * C) concrete name + city/country text search
 * D) empty string (caller must hide the button — never open a broken Maps page)
 */
export function getPlaceMapsUrl(item: ItineraryItem, location?: string): string {
  if (process.env.NODE_ENV !== 'production') {
    logMapsLinkDiagnostics(item, location);
  }
  return resolveItineraryMapsLink(item, location)?.url ?? '';
}

/** Null when no safe Maps URL exists for this item. */
export function getPlaceMapsUrlOrNull(item: ItineraryItem, location?: string): string | null {
  if (process.env.NODE_ENV !== 'production') {
    logMapsLinkDiagnostics(item, location);
  }
  return resolveItineraryMapsLink(item, location)?.url ?? null;
}

export function buildReservationSearchUrl(activity: string, location: string): string {
  const query = [activity, '予約', location].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function getReservationUrl(item: ItineraryItem, location: string): string {
  if (isValidHttpUrl(item.reservationUrl)) {
    return item.reservationUrl!.trim();
  }
  return buildReservationSearchUrl(item.activity, location);
}

export function getWebsiteUrl(item: ItineraryItem, location: string): string | null {
  if (isValidHttpUrl(item.websiteUrl)) {
    return item.websiteUrl!.trim();
  }
  return null;
}

export function getMapsUrl(item: ItineraryItem, location: string): string {
  return getPlaceMapsUrl(item, location);
}

/** True when it's safe to offer live "directions from current location" for this item. */
export function canOfferDirections(item: ItineraryItem): boolean {
  return canOfferDirectionsForItem(item);
}

export function hasTravelTime(item: ItineraryItem): boolean {
  const value = item.travelTimeToNext?.trim();
  return Boolean(value && value !== '—' && value !== '-');
}

export function usesDirectReservationLink(item: ItineraryItem): boolean {
  return isValidHttpUrl(item.reservationUrl);
}

/** Build directions URL only when destination is safe; otherwise null. */
export function getDirectionsUrlFromCurrentLocation(
  item: ItineraryItem,
  originLatitude: number,
  originLongitude: number,
  location?: string,
): string | null {
  if (!canOfferDirections(item)) return null;
  if (!Number.isFinite(originLatitude) || !Number.isFinite(originLongitude)) return null;

  const destination = buildDirectionsDestinationSafe(item, location);
  if (!destination) return null;

  const url = buildGoogleMapsDirectionsUrl(
    originLatitude,
    originLongitude,
    destination,
    sanitizePlaceId(item.placeId),
  );
  if (!url || /undefined|null|NaN|invalid/i.test(url) || /destination=(?:&|$)/i.test(url)) {
    return null;
  }
  return url;
}
