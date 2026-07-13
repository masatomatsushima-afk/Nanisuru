/**
 * Google Places 連携の将来設計用インターフェースです。
 * 設計のみ — 実装・通信・APIキー追加はまだ行いません。
 * 詳細: docs/GOOGLE_PLACES_INTEGRATION_PLAN.md（セクション4「先に作るべき内部構造」）
 *
 * 将来、`generate-plan.ts` の候補取得ステップ（`fetchSpotCandidatesForTrip()` 相当）が
 * ここで定義した `PlacesProvider` の実装（例: `GooglePlacesProvider`）を呼び出し、
 * `SpotCandidate[]`（既存: `@/types/spot-candidate`）に変換して AI プロンプトへ渡す想定。
 * 現時点ではどこからも呼び出されない（配線なし）。
 */

import type { PlaceCategory } from '@/lib/destination-safety';
import type { PlaceCandidate } from '@/types/place-candidate';

/** 検索条件。既存フォーム入力（destinationLabel / baseArea 等）とそのまま対応させる想定。 */
export type PlaceSearchQuery = {
  destinationLabel: string;
  city?: string;
  country?: string;
  baseArea?: string;
  coordinates?: { lat: number; lng: number };
  categories?: PlaceCategory[];
  keyword?: string;
  maxResults?: number;
};

/**
 * 候補取得プロバイダの共通インターフェース。
 * 将来 `GooglePlacesProvider` がこれを実装する。seed/mock 実装への差し替えも同じ形で可能。
 */
export interface PlacesProvider {
  /** プロバイダ識別名（ログ・デバッグ用）。 */
  readonly providerName: string;

  /** 検索条件に合う候補を返す（将来: Text Search / Nearby Search 相当）。 */
  searchPlaces(query: PlaceSearchQuery): Promise<PlaceCandidate[]>;

  /** placeId 単体の詳細取得（将来: Place Details 相当）。任意実装。 */
  getPlaceDetails?(placeId: string): Promise<PlaceCandidate | null>;
}
