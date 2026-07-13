/**
 * Mock PlacesProvider — 外部通信なし。固定候補を返す。
 */

import type { PlaceCandidate } from '@/types/place-candidate';
import type { PlacesProvider, PlaceSearchQuery } from './places-provider';
import { getMockCandidatesForQuery, MOCK_PLACE_CANDIDATES } from './mock-places-data';
import { filterPlaceCandidates } from './place-candidate-safety';
import { rankPlaceCandidates } from './place-candidate-ranking';

export class MockPlacesProvider implements PlacesProvider {
  readonly providerName = 'mock';

  async searchPlaces(query: PlaceSearchQuery): Promise<PlaceCandidate[]> {
    const pool = getMockCandidatesForQuery(query);
    const context = {
      destinationLabel: query.destinationLabel,
      city: query.city,
      country: query.country,
      baseArea: query.baseArea,
      categories: query.categories,
      coordinates: query.coordinates,
      preferOpenNow: true,
    };

    const { kept } = filterPlaceCandidates(pool, context);
    const ranked = rankPlaceCandidates(kept, context);

    const maxResults =
      Number.isFinite(query.maxResults) && (query.maxResults ?? 0) > 0
        ? Math.floor(query.maxResults!)
        : ranked.length;

    return ranked.slice(0, maxResults).map((entry) => entry.candidate);
  }

  async getPlaceDetails(placeId: string): Promise<PlaceCandidate | null> {
    const found = MOCK_PLACE_CANDIDATES.find((candidate) => candidate.placeId === placeId);
    return found ?? null;
  }
}
