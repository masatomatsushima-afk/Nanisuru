/**
 * Places 検索の安全な入口。
 * 例外を投げず PlacesSearchResult を返す。Google 実通信は /api/places-search（サーバー）経由のみ。
 */

import { getPlacesProvider, resolvePlacesMode, type PlacesProviderConfig } from './get-places-provider';
import { toPlaceSearchQuery, type PlacesSearchInput } from './places-search-input';
import {
  createDisabledPlacesResult,
  createPlacesErrorResult,
  createPlacesSuccessResult,
  type PlacesSearchResult,
} from './places-search-result';

export async function searchPlacesSafe(
  input: PlacesSearchInput,
  config?: PlacesProviderConfig,
): Promise<PlacesSearchResult> {
  const mode = resolvePlacesMode(config);

  if (mode === 'disabled') {
    return createDisabledPlacesResult();
  }

  if (mode === 'google') {
    // APIキーの有無はクライアントでは判定しない（GOOGLE_PLACES_API_KEY はサーバー専用 env のため
    // ブラウザ bundle では常に未設定扱いになる）。/api/places-search 側で検証し、失敗時は [] を返す。
    try {
      const provider = getPlacesProvider({ mode: 'google' });
      const candidates = await provider.searchPlaces(toPlaceSearchQuery(input));

      if (candidates.length === 0) {
        return createPlacesSuccessResult({
          provider: provider.providerName,
          candidates: [],
          warning: 'Google Places returned no candidates for this destination/area.',
          errorCode: 'no_candidates',
        });
      }

      return createPlacesSuccessResult({
        provider: provider.providerName,
        candidates,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Places search error';
      console.warn('[searchPlacesSafe] google mode failed:', message);
      return createPlacesErrorResult({
        provider: 'google_places',
        errorCode: 'search_failed',
        warning: message,
      });
    }
  }

  try {
    const provider = getPlacesProvider({ mode: 'mock' });
    const candidates = await provider.searchPlaces(toPlaceSearchQuery(input));
    return createPlacesSuccessResult({
      provider: provider.providerName,
      candidates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Places search error';
    console.warn('[searchPlacesSafe] mock mode failed:', message);
    return createPlacesErrorResult({
      provider: 'mock',
      errorCode: 'search_failed',
      warning: message,
    });
  }
}
