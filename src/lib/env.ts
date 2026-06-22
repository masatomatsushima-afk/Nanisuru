/**
 * Environment variables for Nanisuru.
 *
 * Add your key to `.env` (never commit this file):
 *   EXPO_PUBLIC_OPENAI_API_KEY=sk-...
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
