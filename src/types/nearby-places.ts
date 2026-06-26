import type { CurrencyCode } from '@/constants/currency';

export type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

export type NearbyPlaceCategory =
  | 'cafe'
  | 'restaurant'
  | 'tourist_attraction'
  | 'park'
  | 'museum'
  | 'art_gallery'
  | 'shopping_mall'
  | 'book_store'
  | 'bar';

export type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  category: NearbyPlaceCategory;
  categoryLabel: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  distanceLabel: string;
  walkMinutes: number;
  rating?: number;
  mapsUrl?: string;
};

export type PlacesDataSource = 'google' | 'cache' | 'static';

export type NearbyPlacesContext = {
  coordinates: GeoCoordinates;
  locationLabel: string;
  searchedAt: string;
  places: NearbyPlace[];
  geocodeAddress?: string;
  inferredCurrency?: CurrencyCode;
  source?: PlacesDataSource;
  notice?: string;
};

export const NEARBY_PLACE_CATEGORIES: ReadonlyArray<{
  type: NearbyPlaceCategory;
  label: string;
}> = [
  { type: 'tourist_attraction', label: '観光スポット' },
  { type: 'park', label: '公園' },
  { type: 'museum', label: '博物館' },
  { type: 'art_gallery', label: '美術館' },
  { type: 'shopping_mall', label: 'ショッピング' },
  { type: 'book_store', label: '書店' },
  { type: 'cafe', label: 'カフェ' },
  { type: 'restaurant', label: 'レストラン' },
  { type: 'bar', label: 'バー' },
];

export const PLAN_PLACE_SEARCH_QUOTAS: ReadonlyArray<{
  type: NearbyPlaceCategory;
  label: string;
  maxResults: number;
}> = [
  { type: 'tourist_attraction', label: '観光スポット', maxResults: 3 },
  { type: 'park', label: '公園', maxResults: 2 },
  { type: 'museum', label: '博物館', maxResults: 2 },
  { type: 'art_gallery', label: '美術館', maxResults: 1 },
  { type: 'shopping_mall', label: 'ショッピング', maxResults: 1 },
  { type: 'book_store', label: '書店', maxResults: 1 },
  { type: 'cafe', label: 'カフェ', maxResults: 2 },
  { type: 'restaurant', label: 'レストラン', maxResults: 2 },
  { type: 'bar', label: 'バー', maxResults: 1 },
];
