import type { PlaceCategory, PopularityType } from '@/lib/destination-safety';

/** Where a spot name came from. `google_places` = confirmed real candidate from Google Places. */
export type SpotCandidateSource = 'seed' | 'openai' | 'google_places' | 'google_places_later' | 'fallback';

/**
 * A concrete place candidate attached to an itinerary item. Today this is usually a single
 * seed/OpenAI entry; later Google Places API can populate `placeId`, ratings, and multiple
 * candidates for AI to pick from.
 */
export type SpotCandidate = {
  placeName: string;
  area?: string;
  mapsQuery?: string;
  socialQuery?: string;
  category?: PlaceCategory;
  popularityType?: PopularityType;
  placeId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  source: SpotCandidateSource;
  confidence?: 'high' | 'medium' | 'low';
};
