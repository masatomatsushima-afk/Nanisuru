/**
 * Google Places (New) 連携 — 最小構成。
 *
 * 重要:
 * - Google への実HTTP通信は必ずサーバー側（`src/app/api/places-search+api.ts`）で行う。
 * - このファイル（クライアント側で実行される）は自社の同一オリジンAPIルートにのみ fetch する。
 *   Google のエンドポイントへ直接通信しない・APIキーを保持しない。
 * - 取得フィールドは place_id / name / rating / reviewCount / address / location / openNow /
 *   category(primaryType) / photo(resource name) のみ。レビュー本文はまだ取得しない。
 * - Web以外（プロキシに到達できない環境）やエラー時は例外を投げず空配列を返す（自動fallback）。
 */

import type { PlaceCategory } from '@/lib/destination-safety';
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
  reviewCount: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  isOpenNow: boolean | null;
  primaryType: string | null;
  photoRef: string | null;
};

type PlacesSearchApiResponse = {
  ok: boolean;
  candidates?: PlacesSearchApiCandidate[];
  errorCode?: string;
  warning?: string;
};

/** Google Places (New) の primaryType を Nanisuru 内部の PlaceCategory へ変換（不明時は undefined）。 */
const GOOGLE_TYPE_TO_CATEGORY: Record<string, PlaceCategory> = {
  restaurant: 'food',
  meal_takeaway: 'food',
  meal_delivery: 'food',
  food: 'food',
  bakery: 'food',
  market: 'food',
  supermarket: 'food',
  cafe: 'cafe',
  coffee_shop: 'cafe',
  bar: 'nightlife',
  night_club: 'nightlife',
  tourist_attraction: 'sightseeing',
  museum: 'sightseeing',
  park: 'sightseeing',
  art_gallery: 'sightseeing',
  historical_landmark: 'sightseeing',
  place_of_worship: 'sightseeing',
  amusement_park: 'activity',
  zoo: 'activity',
  aquarium: 'activity',
  shopping_mall: 'shopping',
  clothing_store: 'shopping',
  department_store: 'shopping',
  gift_shop: 'shopping',
};

function mapPrimaryTypeToCategory(primaryType: string | null): PlaceCategory | undefined {
  if (!primaryType) return undefined;
  return GOOGLE_TYPE_TO_CATEGORY[primaryType];
}

/** destination lock を維持するため、city/country を必ず含む検索文字列を作る。 */
function buildTextQuery(query: PlaceSearchQuery): string {
  const destinationSuffix = [query.city, query.country].filter(Boolean).join(' ').trim();

  // categories が単一の明確な絞り込み（例: ['food']）のときだけクエリに含める。
  // generate-plan からは食事・カフェ・観光・ショッピング等を広く候補に含めたいため
  // 全カテゴリ配列を渡しており、その場合に categories[0]（常に 'food'）を紛れ込ませると
  // 毎回「food ...」で検索してしまい候補が飲食店に偏る — ここでは絞り込みなしにする。
  const categoryHint = query.categories?.length === 1 ? query.categories[0] : undefined;

  const leadParts = [query.keyword, categoryHint, query.baseArea]
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
          maxResultCount: query.maxResults ?? 10,
        }),
      });

      const data = (await response.json()) as PlacesSearchApiResponse;

      if (!data.ok || !data.candidates?.length) {
        if (__DEV__) {
          // Dev-only diagnostic (no secrets): errorCode/warning here surface Google's HTTP
          // status (e.g. "Google Places 403") set by /api/places-search — never the key itself.
          console.warn('[GooglePlacesProvider] no candidates:', {
            httpStatus: response.status,
            errorCode: data.errorCode,
            warning: data.warning,
          });
        }
        return [];
      }

      if (__DEV__) {
        console.log('[GooglePlacesProvider] candidates received', {
          httpStatus: response.status,
          count: data.candidates.length,
        });
      }

      return data.candidates.map((candidate): PlaceCandidate => ({
        placeId: candidate.placeId,
        placeName: candidate.placeName,
        rating: candidate.rating,
        reviewCount: candidate.reviewCount,
        address: candidate.address ?? undefined,
        coordinates:
          candidate.lat != null && candidate.lng != null
            ? { lat: candidate.lat, lng: candidate.lng }
            : null,
        openingHours:
          candidate.isOpenNow != null ? { isOpenNow: candidate.isOpenNow } : undefined,
        category: mapPrimaryTypeToCategory(candidate.primaryType),
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
