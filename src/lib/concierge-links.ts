import type { ItineraryItem } from '@/types/plan';
import { buildGoogleMapsSearchUrl } from '@/lib/geo';
import { scopeMapsQueryToLocation } from '@/lib/destination-safety';

export function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^https?:\/\/.+/i.test(trimmed);
}

function isGoogleMapsUrl(value: string): boolean {
  return /google\.com\/maps/i.test(value);
}

export function buildGoogleMapsUrl(activity: string, location: string): string {
  const query = [activity, location].filter(Boolean).join(' ');
  return buildGoogleMapsSearchUrl(query);
}

/**
 * Builds the query used for both "open in Google Maps" and "directions" links. Always prefers
 * the item's own destination-scoped mapsQuery (set at generation time); only falls back to raw
 * title/address text for legacy items that predate mapsQuery, and even then the destination is
 * appended so the search can never resolve near the device's current location instead of the
 * actual trip destination.
 */
export function buildDirectionsDestination(item: ItineraryItem, location?: string): string {
  if (item.mapsQuery?.trim()) {
    return item.mapsQuery.trim();
  }

  const name = item.activity.trim();
  const address = item.placeAddress?.trim();
  const base = name && address ? `${name}, ${address}` : name;
  return scopeMapsQueryToLocation(base, location);
}

export function getPlaceMapsUrl(item: ItineraryItem, location?: string): string {
  const website = item.websiteUrl?.trim();
  if (website && isGoogleMapsUrl(website)) {
    return website;
  }
  return buildGoogleMapsSearchUrl(buildDirectionsDestination(item, location));
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
  return item.isSpecificPlace !== false && Boolean(item.mapsQuery?.trim() || item.activity?.trim());
}

export function hasTravelTime(item: ItineraryItem): boolean {
  const value = item.travelTimeToNext?.trim();
  return Boolean(value && value !== '—' && value !== '-');
}

export function usesDirectReservationLink(item: ItineraryItem): boolean {
  return isValidHttpUrl(item.reservationUrl);
}
