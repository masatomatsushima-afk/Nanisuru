/**
 * Places 検索の安全な入口。
 * 例外を投げず PlacesSearchResult を返す。外部通信は mock/google 実装に委譲（google は未実装）。
 */

import { getPlacesProvider, resolvePlacesMode, type PlacesProviderConfig } from './get-places-provider';
import { isGooglePlacesApiKeyConfigured } from './places-env';
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
    if (!isGooglePlacesApiKeyConfigured()) {
      return createPlacesErrorResult({
        provider: 'google_places',
        errorCode: 'missing_api_key',
        warning:
          'Google Places mode is enabled but GOOGLE_PLACES_API_KEY is not configured. No request was sent.',
      });
    }

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
