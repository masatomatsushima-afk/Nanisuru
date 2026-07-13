import type { PlaceCategory } from '@/lib/destination-safety';

/** mock-places-data / mock-places-provider 共通の検索条件型。 */
export type PlaceSearchQueryLike = {
  destinationLabel: string;
  city?: string;
  country?: string;
  baseArea?: string;
  categories?: PlaceCategory[];
  keyword?: string;
  maxResults?: number;
  coordinates?: { lat: number; lng: number };
};
