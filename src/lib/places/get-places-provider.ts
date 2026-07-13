/**
 * PlacesProvider ファクトリー — disabled / mock / google を安全に切り替える。
 * プラン生成には未接続。
 */

import { DisabledPlacesProvider } from './disabled-places-provider';
import { GooglePlacesProvider } from './google-places-provider';
import { MockPlacesProvider } from './mock-places-provider';
import { getPlacesModeFromEnv, parsePlacesMode, type PlacesMode } from './places-env';
import type { PlacesProvider } from './places-provider';

export type PlacesProviderConfig = {
  /** 未指定時は EXPO_PUBLIC_PLACES_MODE → disabled */
  mode?: PlacesMode | string;
};

const providerCache = new Map<PlacesMode, PlacesProvider>();

export function resolvePlacesMode(config?: PlacesProviderConfig): PlacesMode {
  if (config?.mode != null) {
    return parsePlacesMode(String(config.mode));
  }
  return getPlacesModeFromEnv();
}

/** モードに応じた PlacesProvider を返す。無効モードは disabled にフォールバック。 */
export function getPlacesProvider(config?: PlacesProviderConfig): PlacesProvider {
  const mode = resolvePlacesMode(config);

  const cached = providerCache.get(mode);
  if (cached) return cached;

  let provider: PlacesProvider;
  switch (mode) {
    case 'mock':
      provider = new MockPlacesProvider();
      break;
    case 'google':
      provider = new GooglePlacesProvider();
      break;
    case 'disabled':
    default:
      provider = new DisabledPlacesProvider();
      break;
  }

  providerCache.set(mode, provider);
  return provider;
}

/** テスト用 — キャッシュをクリア。 */
export function resetPlacesProviderCache(): void {
  providerCache.clear();
}
