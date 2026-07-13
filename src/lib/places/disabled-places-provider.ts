/**
 * 外部通信なし — 常に空配列を返す PlacesProvider。
 */

import type { PlaceCandidate } from '@/types/place-candidate';
import type { PlacesProvider, PlaceSearchQuery } from './places-provider';

export class DisabledPlacesProvider implements PlacesProvider {
  readonly providerName = 'disabled';

  async searchPlaces(_query: PlaceSearchQuery): Promise<PlaceCandidate[]> {
    return [];
  }

  async getPlaceDetails(_placeId: string): Promise<PlaceCandidate | null> {
    return null;
  }
}
