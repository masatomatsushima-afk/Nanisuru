/**
 * Environment variables for Nanisuru.
 *
 * Add your keys to `.env` (never commit this file):
 *   EXPO_PUBLIC_OPENAI_API_KEY=sk-...
 *   EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...  （プラン生成の実在スポット取得・現在地検索）
 *
 * Restart Expo after changing `.env`: npx expo start --clear
 *
 * Note: EXPO_PUBLIC_* vars are bundled into the client app.
 * For production, proxy OpenAI calls through your own backend.
 */

const PLACEHOLDER_KEYS = new Set(['', 'sk-your-key-here', 'your-api-key-here']);

export function getOpenAiApiKey(): string | undefined {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
  if (!key || PLACEHOLDER_KEYS.has(key)) return undefined;
  return key;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}

const SUPABASE_PLACEHOLDER_VALUES = new Set(['', 'your-supabase-url', 'your-supabase-anon-key']);

export function getSupabaseUrl(): string | undefined {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!url || SUPABASE_PLACEHOLDER_VALUES.has(url)) return undefined;
  return url;
}

export function getSupabaseAnonKey(): string | undefined {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key || SUPABASE_PLACEHOLDER_VALUES.has(key)) return undefined;
  return key;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

const GOOGLE_MAPS_PLACEHOLDER_KEYS = new Set(['', 'your-google-maps-api-key']);

export function getGoogleMapsApiKey(): string | undefined {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key || GOOGLE_MAPS_PLACEHOLDER_KEYS.has(key)) return undefined;
  return key;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey());
}
