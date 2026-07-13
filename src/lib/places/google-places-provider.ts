/**
 * Google Places (New) 連携 — 最小構成。
 *
 * 重要:
 * - Google への実HTTP通信は必ずサーバー側（`src/app/api/places-search+api.ts`）で行う。
 * - このファイル（クライアント側で実行される）は自社の同一オリジンAPIルートにのみ fetch する。
 *   Google のエンドポイントへ直接通信しない・APIキーを保持しない。
 * - 取得フィールドは place_id / name / rating / address / photo(resource name) のみ。
 * - Web以外（プロキシに到達できない環境）やエラー時は例外を投げず空配列を返す（自動fallback）。
 */

import type { PlaceCandidate } from '@/types/place-candidate';
import type { PlacesProvider, PlaceSearchQuery } from './places-provider';

const PLACES_SEARCH_PATH = '/api/places-search';
const REQUEST_TIMEOUT_MS = 9_000;

/**
 * True only in an actual browser (incl. iPhone Safari via react-native-web), where a same-origin
 * relative fetch to our own API route resolves correctly. Avoids importing `react-native` here so
 * this module stays safe to import from plain Node tooling (verify scripts) too.
 */
function hasReachableServerProxy(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}

type PlacesSearchApiCandidate = {
  placeId: string;
  placeName: string;
  rating: number | null;
  address: string | null;
  photoRef: string | null;
};

type PlacesSearchApiResponse = {
  ok: boolean;
  candidates?: PlacesSearchApiCandidate[];
  errorCode?: string;
  warning?: string;
};

/** destination lock を維持するため、city/country を必ず含む検索文字列を作る。 */
function buildTextQuery(query: PlaceSearchQuery): string {
  const destinationSuffix = [query.city, query.country].filter(Boolean).join(' ').trim();

  const leadParts = [query.keyword, query.categories?.[0], query.baseArea]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const lead = leadParts.length > 0 ? leadParts.join(' ') : query.destinationLabel.trim();

  if (!destinationSuffix) return lead;
  return lead.toLowerCase().includes(destinationSuffix.toLowerCase())
    ? lead
    : `${lead} ${destinationSuffix}`.trim();
}

export class GooglePlacesProvider implements PlacesProvider {
  readonly providerName = 'google_places';

  async searchPlaces(query: PlaceSearchQuery): Promise<PlaceCandidate[]> {
    // MVP is tested via mobile Safari (react-native-web) — same-origin fetch works there.
    // Non-web runtimes have no reachable proxy configured yet; fail safe instead of crashing.
    if (!hasReachableServerProxy()) {
      console.warn('[GooglePlacesProvider] no server proxy reachable on this platform — returning [].');
      return [];
    }

    const textQuery = buildTextQuery(query);
    if (!textQuery) return [];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(PLACES_SEARCH_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query: textQuery,
          maxResultCount: query.maxResults ?? 8,
        }),
      });

      const data = (await response.json()) as PlacesSearchApiResponse;

      if (!data.ok || !data.candidates?.length) {
        if (data.warning) {
          console.warn('[GooglePlacesProvider] no candidates:', data.errorCode, data.warning);
        }
        return [];
      }

      return data.candidates.map((candidate): PlaceCandidate => ({
        placeId: candidate.placeId,
        placeName: candidate.placeName,
        rating: candidate.rating,
        address: candidate.address ?? undefined,
        city: query.city,
        country: query.country,
        area: query.baseArea,
        photos: candidate.photoRef ? [{ url: '', name: candidate.photoRef }] : undefined,
        source: 'google_places',
        confidence: 'high',
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Google Places fetch error';
      console.warn('[GooglePlacesProvider] searchPlaces failed (falling back to []):', message);
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getPlaceDetails(_placeId: string): Promise<PlaceCandidate | null> {
    // Minimal scope for this phase — Place Details not implemented yet. Safe no-op.
    return null;
  }
}
