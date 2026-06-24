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
  { type: 'cafe', label: 'カフェ' },
  { type: 'restaurant', label: 'レストラン' },
  { type: 'tourist_attraction', label: '観光スポット' },
  { type: 'park', label: '公園' },
  { type: 'bar', label: 'バー' },
];
