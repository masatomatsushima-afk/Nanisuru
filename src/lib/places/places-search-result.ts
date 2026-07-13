/**
 * Places 検索の安全な結果型。
 * 例外ではなく ok / warning / errorCode で状態を返す。
 */

import type { PlaceCandidate } from '@/types/place-candidate';

export type PlacesSearchErrorCode =
  | 'disabled'
  | 'invalid_mode'
  | 'missing_api_key'
  | 'provider_not_implemented'
  | 'search_failed';

export type PlacesSearchResult = {
  ok: boolean;
  provider: string;
  candidates: PlaceCandidate[];
  warning?: string;
  errorCode?: PlacesSearchErrorCode;
};

export function createDisabledPlacesResult(warning?: string): PlacesSearchResult {
  return {
    ok: true,
    provider: 'disabled',
    candidates: [],
    warning: warning ?? 'Places search is disabled.',
    errorCode: 'disabled',
  };
}

export function createPlacesErrorResult(params: {
  provider: string;
  errorCode: PlacesSearchErrorCode;
  warning: string;
}): PlacesSearchResult {
  return {
    ok: false,
    provider: params.provider,
    candidates: [],
    warning: params.warning,
    errorCode: params.errorCode,
  };
}

export function createPlacesSuccessResult(params: {
  provider: string;
  candidates: PlaceCandidate[];
  warning?: string;
  errorCode?: PlacesSearchErrorCode;
}): PlacesSearchResult {
  return {
    ok: true,
    provider: params.provider,
    candidates: params.candidates,
    warning: params.warning,
    errorCode: params.errorCode,
  };
}
