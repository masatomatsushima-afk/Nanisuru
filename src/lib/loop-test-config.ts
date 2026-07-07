/**
 * Loop isolation harness — flip ONE flag to true at a time, reload mobile Safari,
 * and check the terminal for the last [LoopTest] line before the crash.
 *
 * Restore order (test mobile Safari after each step):
 *   screenHome ✓ → screenExplore ✓ → screenFavorites ✓ → screenProfile ✓
 *   travelPlanForm (full) ✓ → screenAi
 *   authProvider + userLocationProvider enabled for Discover
 *   customTabBar last
 */

export const LOOP_TEST_RESTORE = {
  /** A. Root providers — Discover needs auth + location */
  authProvider: true,
  userLocationProvider: true,
  themeProvider: false,
  animatedSplash: false,
  devProbes: false,
  rootIndexGate: false,
  fullRootStack: false,

  /** B. Tab screens — enable one at a time */
  screenHome: true,
  screenExplore: true,
  screenFavorites: true,
  screenAi: false,
  screenProfile: true,

  /**
   * Travel Plan form — bisect via travelFormRestoreLevel if Symbol/loop errors return.
   * Levels: shell → destination → dates → time → budget → budgetIncludes → people →
   *         companion → purpose → custom → generate → overlay → full
   */
  travelPlanForm: true,
  travelPlanPlaceholder: false,
  travelFormRestoreLevel: 'full' as string,
  /** Travel plan submit + generation flow (overlay → AI → result screen) */
  travelPlanGeneration: true,
  /** Plan Detail screen with the real day-by-day itinerary (was disabled during Symbol-error bisection). */
  planDetailRoute: true,

  /** Home UI sections — disable one at a time to bisect Symbol errors */
  homeSectionHeader: true,
  homeSectionHero: true,
  homeSectionCategories: true,
  homeSectionActionCards: true,
  homeSectionDiscoverPreview: true,
  homeSectionPreferenceCard: true,

  /** C. Custom bottom nav — enable last */
  customTabBar: false,

  /** Maps to src/lib/preferences-disabled.ts — no React provider exists */
  preferencesIo: false,
} as const;

const loggedKeys = new Set<string>();

export function loopTestLogOnce(key: string, message: string): void {
  if (!__DEV__ || loggedKeys.has(key)) return;
  loggedKeys.add(key);
  console.log(`[LoopTest] ${message}`);
}

export function loopTestLog(message: string): void {
  if (__DEV__) {
    console.log(`[LoopTest] ${message}`);
  }
}
