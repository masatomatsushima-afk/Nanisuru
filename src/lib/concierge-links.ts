import type { ItineraryItem } from '@/types/plan';

export function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^https?:\/\/.+/i.test(trimmed);
}

export function buildGoogleMapsUrl(activity: string, location: string): string {
  const query = [activity, location].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
  return buildGoogleMapsUrl(item.activity, location);
}

export function hasTravelTime(item: ItineraryItem): boolean {
  const value = item.travelTimeToNext?.trim();
  return Boolean(value && value !== '—' && value !== '-');
}

export function usesDirectReservationLink(item: ItineraryItem): boolean {
  return isValidHttpUrl(item.reservationUrl);
}
