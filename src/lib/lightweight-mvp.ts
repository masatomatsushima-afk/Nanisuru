/**
 * Lightweight MVP mode — single switch to disable heavy/unrelated data fetching
 * while developing on a real device (mobile Safari). Only ever active in __DEV__,
 * so production builds are never affected even if left true by mistake.
 *
 * When on, plan generation skips:
 *   - Supabase Discover data (home preview + fetchPublicPlans)
 *   - Travel memories (Supabase travel_memories)
 *   - local_hidden_spots (ローカル穴場)
 *   - Travel secretary / AI chat context
 *   - Live weather + real-places lookups
 * and only sends the minimal fields needed to /api/generate-plan.
 */
export const LIGHTWEIGHT_MVP = true;

export function isLightweightMvp(): boolean {
  return LIGHTWEIGHT_MVP && __DEV__;
}

const loggedOnce = new Set<string>();

export function lightweightMvpLog(key: string, message: string): void {
  if (!isLightweightMvp() || loggedOnce.has(key)) return;
  loggedOnce.add(key);
  console.log(`[LightweightMVP] ${message}`);
}
