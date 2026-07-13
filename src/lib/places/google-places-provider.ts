/**
 * Google Places (New) 実装用の空Providerです。
 *
 * 重要: このファイルは設計の土台のみです。
 * - API キーの追加・読み込みは行いません
 * - HTTP通信は一切行いません
 * - どこからも呼び出されていません（未配線）
 *
 * 実装時は docs/GOOGLE_PLACES_INTEGRATION_PLAN.md の
 * 「2. 必要そうな Google Places API」を参照して searchPlaces / getPlaceDetails を実装する。
 */

import type { PlaceCandidate } from '@/types/place-candidate';
import type { PlacesProvider, PlaceSearchQuery } from './places-provider';

export class GooglePlacesProvider implements PlacesProvider {
  readonly providerName = 'google_places';

  async searchPlaces(_query: PlaceSearchQuery): Promise<PlaceCandidate[]> {
    console.warn(
      '[GooglePlacesProvider] searchPlaces() is not implemented yet (design-only stub). Returning [].',
    );
    return [];
  }

  async getPlaceDetails(_placeId: string): Promise<PlaceCandidate | null> {
    console.warn(
      '[GooglePlacesProvider] getPlaceDetails() is not implemented yet (design-only stub). Returning null.',
    );
    return null;
  }
}
