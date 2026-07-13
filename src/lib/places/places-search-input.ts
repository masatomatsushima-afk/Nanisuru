/**
 * Places 検索の共通入力型。
 * フォーム入力・将来の generate-plan 接続点でそのまま使える形。
 */

import type { PlaceCategory } from '@/lib/destination-safety';
import type { PlaceSearchQuery } from './places-provider';

export type PlacesSearchInput = {
  destination: string;
  city?: string;
  country?: string;
  baseArea?: string;
  accommodation?: string;
  category?: PlaceCategory;
  categories?: PlaceCategory[];
  query?: string;
  dateTime?: string;
  budget?: number;
  limit?: number;
  coordinates?: { lat: number; lng: number };
};

/** PlacesProvider 向けの内部クエリへ変換。 */
export function toPlaceSearchQuery(input: PlacesSearchInput): PlaceSearchQuery {
  const categories =
    input.categories?.length
      ? input.categories
      : input.category
        ? [input.category]
        : undefined;

  return {
    destinationLabel: input.destination,
    city: input.city,
    country: input.country,
    baseArea: input.baseArea ?? input.accommodation,
    coordinates: input.coordinates,
    categories,
    keyword: input.query,
    maxResults: input.limit,
  };
}
