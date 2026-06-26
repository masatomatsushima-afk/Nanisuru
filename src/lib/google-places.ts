import {
  buildGoogleMapsPlaceUrl,
  estimateWalkMinutes,
  formatDistanceLabel,
  haversineDistanceMeters,
} from '@/lib/geo';
import { getGoogleMapsApiKey, isGoogleMapsConfigured } from '@/lib/env';
import type { GeoCoordinates, NearbyPlace, NearbyPlaceCategory } from '@/types/nearby-places';
import { NEARBY_PLACE_CATEGORIES, PLAN_PLACE_SEARCH_QUOTAS } from '@/types/nearby-places';

const PLACES_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const DEFAULT_SEARCH_RADIUS_METERS = 2_000;
const DEFAULT_MAX_RESULTS_PER_CATEGORY = 4;
const PLACE_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri,places.primaryType';

type PlacesApiPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  googleMapsUri?: string;
  primaryType?: string;
};

type PlacesApiResponse = {
  places?: PlacesApiPlace[];
  error?: { message?: string; status?: string };
};

export type LocationGeocodeResult = {
  latitude: number;
  longitude: number;
  label: string;
  address: string;
};

function parsePlacesApiError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as PlacesApiResponse;
    const message = parsed.error?.message;
    if (message) {
      if (message.includes('API key') || status === 403) {
        return 'Google Maps APIキーが無効です。.env の EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を確認してください。';
      }
      return `Google Places APIエラー: ${message}`;
    }
  } catch {
    // fall through
  }
  return `Google Places APIエラー (${status})`;
}

function mapPlacesApiPlace(
  place: PlacesApiPlace,
  origin: GeoCoordinates,
  category: NearbyPlaceCategory,
  categoryLabel: string,
): NearbyPlace | null {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  const name = place.displayName?.text?.trim();
  if (latitude == null || longitude == null || !name) return null;

  const distanceMeters = haversineDistanceMeters(origin, { latitude, longitude });
  const walkMinutes = estimateWalkMinutes(distanceMeters);

  return {
    id: place.id ?? `${category}-${latitude}-${longitude}-${name}`,
    name,
    address: place.formattedAddress ?? '',
    category,
    categoryLabel,
    latitude,
    longitude,
    distanceMeters,
    distanceLabel: formatDistanceLabel(distanceMeters),
    walkMinutes,
    rating: place.rating,
    mapsUrl: place.googleMapsUri ?? buildGoogleMapsPlaceUrl(latitude, longitude, name),
  };
}

async function postPlacesRequest(
  url: string,
  body: Record<string, unknown>,
): Promise<PlacesApiPlace[]> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error(
      'Google Maps APIキーが未設定です。\n.env に EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を追加してください。',
    );
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACE_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(parsePlacesApiError(response.status, errorBody));
  }

  const data = (await response.json()) as PlacesApiResponse;
  return data.places ?? [];
}

async function searchPlacesByType(
  origin: GeoCoordinates,
  category: NearbyPlaceCategory,
  categoryLabel: string,
  options?: { radiusMeters?: number; maxResults?: number; openNow?: boolean },
): Promise<NearbyPlace[]> {
  const radiusMeters = options?.radiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS;
  const maxResultCount = options?.maxResults ?? DEFAULT_MAX_RESULTS_PER_CATEGORY;

  const requestBody: Record<string, unknown> = {
    includedTypes: [category],
    maxResultCount,
    languageCode: 'ja',
    locationRestriction: {
      circle: {
        center: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
        radius: radiusMeters,
      },
    },
  };

  if (options?.openNow) {
    requestBody.openNow = true;
  }

  const places = await postPlacesRequest(PLACES_NEARBY_URL, requestBody);

  const results: NearbyPlace[] = [];
  for (const place of places) {
    const mapped = mapPlacesApiPlace(place, origin, category, categoryLabel);
    if (mapped) results.push(mapped);
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function mapPrimaryTypeToCategory(primaryType?: string): {
  category: NearbyPlaceCategory;
  categoryLabel: string;
} {
  const type = primaryType?.toLowerCase() ?? '';
  if (type.includes('cafe') || type.includes('coffee')) {
    return { category: 'cafe', categoryLabel: 'カフェ' };
  }
  if (type.includes('restaurant') || type.includes('food') || type.includes('meal')) {
    return { category: 'restaurant', categoryLabel: 'レストラン' };
  }
  if (type.includes('park') || type.includes('garden')) {
    return { category: 'park', categoryLabel: '公園' };
  }
  if (type.includes('museum')) {
    return { category: 'museum', categoryLabel: '博物館' };
  }
  if (type.includes('art_gallery') || type.includes('gallery')) {
    return { category: 'art_gallery', categoryLabel: '美術館' };
  }
  if (type.includes('shopping_mall') || type.includes('shopping')) {
    return { category: 'shopping_mall', categoryLabel: 'ショッピング' };
  }
  if (type.includes('book_store') || type.includes('bookshop')) {
    return { category: 'book_store', categoryLabel: '書店' };
  }
  if (type.includes('bar') || type.includes('night_club')) {
    return { category: 'bar', categoryLabel: 'バー' };
  }
  return { category: 'tourist_attraction', categoryLabel: '観光スポット' };
}

export type PlanPlacesSearchResult = {
  places: NearbyPlace[];
  center: GeoCoordinates;
  locationLabel: string;
  address: string;
};

export async function searchPlacesForPlan(
  location: string,
  maxResults = 16,
): Promise<PlanPlacesSearchResult | null> {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const geocoded = await geocodeLocationQuery(trimmed);
  if (!geocoded) return null;

  const center: GeoCoordinates = {
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
  };

  const groups = await Promise.all(
    PLAN_PLACE_SEARCH_QUOTAS.map(({ type, label, maxResults: perTypeMax }) =>
      searchPlacesByType(center, type, label, {
        radiusMeters: 5_000,
        maxResults: perTypeMax,
      }).catch(() => [] as NearbyPlace[]),
    ),
  );

  const seen = new Set<string>();
  const merged: NearbyPlace[] = [];

  for (const group of groups) {
    for (const place of group) {
      const key = place.id || place.name;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(place);
    }
  }

  if (merged.length === 0) {
    const fallbackPlaces = await postPlacesRequest(PLACES_TEXT_URL, {
      textQuery: `${trimmed} 観光 公園 美術館`,
      languageCode: 'ja',
      maxResultCount: maxResults,
    });

    for (const place of fallbackPlaces) {
      const latitude = place.location?.latitude;
      const longitude = place.location?.longitude;
      const name = place.displayName?.text?.trim();
      if (latitude == null || longitude == null || !name) continue;

      const { category, categoryLabel } = mapPrimaryTypeToCategory(place.primaryType);
      const item = mapPlacesApiPlace(place, center, category, categoryLabel);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
  }

  if (merged.length === 0) return null;

  return {
    places: merged.slice(0, maxResults),
    center,
    locationLabel: geocoded.label,
    address: geocoded.address,
  };
}

export async function geocodeLocationQuery(query: string): Promise<LocationGeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const places = await postPlacesRequest(PLACES_TEXT_URL, {
    textQuery: trimmed,
    languageCode: 'ja',
    maxResultCount: 1,
  });

  const place = places[0];
  const latitude = place?.location?.latitude;
  const longitude = place?.location?.longitude;
  if (latitude == null || longitude == null) return null;

  return {
    latitude,
    longitude,
    label: place.displayName?.text?.trim() || trimmed,
    address: place.formattedAddress ?? '',
  };
}

export async function searchPlacesInArea(
  origin: GeoCoordinates,
  options?: { radiusMeters?: number; maxPerCategory?: number },
): Promise<NearbyPlace[]> {
  if (!isGoogleMapsConfigured()) {
    throw new Error(
      'Google Maps APIキーが未設定です。\n.env に EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を追加してください。',
    );
  }

  const radiusMeters = options?.radiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS;
  const maxPerCategory = options?.maxPerCategory ?? DEFAULT_MAX_RESULTS_PER_CATEGORY;

  const results = await Promise.all(
    NEARBY_PLACE_CATEGORIES.map(({ type, label }) =>
      searchPlacesByType(origin, type, label, { radiusMeters, maxResults: maxPerCategory }),
    ),
  );

  const seen = new Set<string>();
  const merged: NearbyPlace[] = [];

  for (const group of results) {
    for (const place of group) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      merged.push(place);
    }
  }

  return merged.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function searchPlacesByTextQuery(
  textQuery: string,
  origin: GeoCoordinates,
  category: NearbyPlaceCategory,
  categoryLabel: string,
  maxResults = 5,
): Promise<NearbyPlace[]> {
  const places = await postPlacesRequest(PLACES_TEXT_URL, {
    textQuery,
    languageCode: 'ja',
    maxResultCount: maxResults,
    includedType: category,
    locationBias: {
      circle: {
        center: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
        radius: 15_000,
      },
    },
  });

  const results: NearbyPlace[] = [];
  for (const place of places) {
    const mapped = mapPlacesApiPlace(place, origin, category, categoryLabel);
    if (mapped) results.push(mapped);
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function searchNearbyPlaces(origin: GeoCoordinates): Promise<NearbyPlace[]> {
  return searchPlacesInArea(origin, {
    radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
    maxPerCategory: DEFAULT_MAX_RESULTS_PER_CATEGORY,
  });
}

async function searchPlacesByGoogleType(
  origin: GeoCoordinates,
  includedType: string,
  category: NearbyPlaceCategory,
  categoryLabel: string,
  options?: { radiusMeters?: number; maxResults?: number; openNow?: boolean },
): Promise<NearbyPlace[]> {
  const radiusMeters = options?.radiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS;
  const maxResultCount = options?.maxResults ?? DEFAULT_MAX_RESULTS_PER_CATEGORY;

  const requestBody: Record<string, unknown> = {
    includedTypes: [includedType],
    maxResultCount,
    languageCode: 'ja',
    locationRestriction: {
      circle: {
        center: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
        radius: radiusMeters,
      },
    },
  };

  if (options?.openNow) {
    requestBody.openNow = true;
  }

  const places = await postPlacesRequest(PLACES_NEARBY_URL, requestBody);
  const results: NearbyPlace[] = [];
  for (const place of places) {
    const mapped = mapPlacesApiPlace(place, origin, category, categoryLabel);
    if (mapped) results.push(mapped);
  }
  return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function searchAfterPlanPlaces(
  origin: GeoCoordinates,
  options?: { radiusMeters?: number; openNow?: boolean },
): Promise<NearbyPlace[]> {
  if (!isGoogleMapsConfigured()) return [];

  const radiusMeters = options?.radiusMeters ?? 1_500;
  const openNow = options?.openNow ?? true;
  const searchOpts = { radiusMeters, maxResults: 4, openNow };

  const groups = await Promise.all([
    searchPlacesByType(origin, 'bar', 'バー', searchOpts).catch(() => [] as NearbyPlace[]),
    searchPlacesByGoogleType(origin, 'night_club', 'bar', 'ナイトクラブ', searchOpts).catch(
      () => [] as NearbyPlace[],
    ),
    searchPlacesByType(origin, 'cafe', '夜カフェ', searchOpts).catch(() => [] as NearbyPlace[]),
    searchPlacesByType(origin, 'restaurant', 'レストラン', searchOpts).catch(
      () => [] as NearbyPlace[],
    ),
    searchPlacesByTextQuery('カラオケ', origin, 'bar', 'カラオケ', 3).catch(
      () => [] as NearbyPlace[],
    ),
    searchPlacesByTextQuery('ラーメン 深夜', origin, 'restaurant', '締めラーメン', 3).catch(
      () => [] as NearbyPlace[],
    ),
    searchPlacesByTextQuery('コンビニ', origin, 'restaurant', 'コンビニ', 2).catch(
      () => [] as NearbyPlace[],
    ),
    searchPlacesByTextQuery('夜景 展望', origin, 'tourist_attraction', '夜景', 3).catch(
      () => [] as NearbyPlace[],
    ),
  ]);

  const seen = new Set<string>();
  const merged: NearbyPlace[] = [];
  for (const group of groups) {
    for (const place of group) {
      const key = place.id || place.name;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(place);
    }
  }

  if (merged.length === 0 && openNow) {
    return searchAfterPlanPlaces(origin, { radiusMeters, openNow: false });
  }

  return merged.sort((a, b) => a.distanceMeters - b.distanceMeters);
}
