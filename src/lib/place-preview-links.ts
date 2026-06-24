import type { ItineraryItem } from '@/types/plan';

function extractCityFromAddress(address: string): string | undefined {
  const trimmed = address.trim();
  if (!trimmed) return undefined;

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2] ?? parts[0];
    const withoutPostal = candidate.replace(/\s+\d{4,}/, '').trim();
    return withoutPostal || candidate;
  }

  return trimmed.length <= 40 ? trimmed : undefined;
}

export function resolvePlaceCity(
  item: ItineraryItem,
  tripLocation?: string,
): string | undefined {
  const trip = tripLocation?.trim();
  if (trip) return trip;

  const address = item.placeAddress?.trim();
  if (!address) return undefined;

  return extractCityFromAddress(address) ?? address;
}

export function buildPlacePreviewSearchQuery(
  item: ItineraryItem,
  tripLocation?: string,
): string {
  const name = item.activity.trim();
  const city = resolvePlaceCity(item, tripLocation);
  const category = item.placeCategory?.trim();

  return [name, city, category].filter(Boolean).join(' ');
}

export function buildInstagramSearchUrl(query: string): string {
  return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(query)}`;
}

export function buildTikTokSearchUrl(query: string): string {
  return `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;
}

export function buildGoogleImagesSearchUrl(query: string): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

export function getPlacePreviewLinks(item: ItineraryItem, tripLocation?: string) {
  const query = buildPlacePreviewSearchQuery(item, tripLocation);

  return {
    query,
    instagram: buildInstagramSearchUrl(query),
    tiktok: buildTikTokSearchUrl(query),
    googleImages: buildGoogleImagesSearchUrl(query),
  };
}
