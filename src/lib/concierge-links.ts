import type { ItineraryItem } from '@/types/plan';
import { buildGoogleMapsSearchUrl } from '@/lib/geo';

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

export function buildDirectionsDestination(item: ItineraryItem): string {
  const name = item.activity.trim();
  const address = item.placeAddress?.trim();
  if (name && address) {
    return `${name}, ${address}`;
  }
  return name;
}

export function getPlaceMapsUrl(item: ItineraryItem): string {
  const website = item.websiteUrl?.trim();
  if (website && isGoogleMapsUrl(website)) {
    return website;
  }
  return buildGoogleMapsSearchUrl(buildDirectionsDestination(item));
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
  return getPlaceMapsUrl(item);
}

export function hasTravelTime(item: ItineraryItem): boolean {
  const value = item.travelTimeToNext?.trim();
  return Boolean(value && value !== '—' && value !== '-');
}

export function usesDirectReservationLink(item: ItineraryItem): boolean {
  return isValidHttpUrl(item.reservationUrl);
}
