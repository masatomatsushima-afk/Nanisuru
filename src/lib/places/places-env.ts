/**
 * Places 連携の環境変数型と検証（値の直書きは禁止）。
 *
 * - EXPO_PUBLIC_PLACES_MODE … クライアントから参照可（disabled | mock | google）
 * - GOOGLE_PLACES_API_KEY … サーバー専用。EXPO_PUBLIC_ 前缀を付けないこと。
 */

export type PlacesMode = 'disabled' | 'mock' | 'google';

const VALID_MODES = new Set<PlacesMode>(['disabled', 'mock', 'google']);

const PLACES_MODE_PLACEHOLDERS = new Set(['', 'disabled', 'off', 'none']);

const GOOGLE_PLACES_KEY_PLACEHOLDERS = new Set([
  '',
  'your-google-places-api-key',
  'your-google-maps-api-key',
]);

export type PlacesEnvValidation = {
  mode: PlacesMode;
  /** API キーが設定されているか（値そのものは返さない）。 */
  hasGooglePlacesApiKey: boolean;
  warnings: string[];
};

export function parsePlacesMode(raw: string | undefined): PlacesMode {
  const normalized = raw?.trim().toLowerCase();
  if (normalized && VALID_MODES.has(normalized as PlacesMode)) {
    return normalized as PlacesMode;
  }
  return 'disabled';
}

/** 実行時の Places モード。未設定・無効値は disabled。 */
export function getPlacesModeFromEnv(): PlacesMode {
  const raw = process.env.EXPO_PUBLIC_PLACES_MODE;
  if (!raw || PLACES_MODE_PLACEHOLDERS.has(raw.trim().toLowerCase())) {
    return 'disabled';
  }
  return parsePlacesMode(raw);
}

/**
 * Google Places API キーが設定されているか（キー本体は返さない）。
 * サーバー専用 env のみ参照 — クライアント bundle へ露出させない。
 */
export function isGooglePlacesApiKeyConfigured(): boolean {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key || GOOGLE_PLACES_KEY_PLACEHOLDERS.has(key)) return false;
  return true;
}

/** 起動時/開発時の軽量検証。例外は投げない。 */
export function validatePlacesEnv(): PlacesEnvValidation {
  const mode = getPlacesModeFromEnv();
  const hasGooglePlacesApiKey = isGooglePlacesApiKeyConfigured();
  const warnings: string[] = [];

  if (mode === 'google' && !hasGooglePlacesApiKey) {
    warnings.push(
      'EXPO_PUBLIC_PLACES_MODE=google ですが GOOGLE_PLACES_API_KEY が未設定です。候補は返しません。',
    );
  }

  if (mode === 'google' && hasGooglePlacesApiKey) {
    warnings.push(
      'Google Places モードが有効です。/api/places-search 経由でサーバーからのみ外部通信します。',
    );
  }

  return { mode, hasGooglePlacesApiKey, warnings };
}
