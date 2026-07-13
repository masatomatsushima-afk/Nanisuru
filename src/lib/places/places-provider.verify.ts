/**
 * PlacesProvider 切替の簡易検証（外部通信なし）。
 */

import { getPlacesProvider, resetPlacesProviderCache, resolvePlacesMode } from './get-places-provider';
import { parsePlacesMode } from './places-env';
import { searchPlacesSafe } from './places-search-service';

export type VerificationCase = {
  name: string;
  passed: boolean;
  detail: string;
};

export type VerificationReport = {
  ok: boolean;
  cases: VerificationCase[];
};

function assert(name: string, condition: boolean, detail: string): VerificationCase {
  return { name, passed: condition, detail };
}

const SAMPLE_INPUT = {
  destination: 'ソウル',
  city: 'Seoul',
  country: 'Korea',
  limit: 5,
};

export async function runPlacesProviderVerification(): Promise<VerificationReport> {
  const cases: VerificationCase[] = [];
  resetPlacesProviderCache();

  const disabledResult = await searchPlacesSafe(SAMPLE_INPUT, { mode: 'disabled' });
  cases.push(
    assert(
      'disabled_returns_empty_without_crash',
      disabledResult.ok &&
        disabledResult.provider === 'disabled' &&
        disabledResult.candidates.length === 0,
      `provider=${disabledResult.provider}, count=${disabledResult.candidates.length}`,
    ),
  );

  const mockResult = await searchPlacesSafe(SAMPLE_INPUT, { mode: 'mock' });
  cases.push(
    assert(
      'mock_returns_fixed_candidates',
      mockResult.ok && mockResult.provider === 'mock' && mockResult.candidates.length > 0,
      `provider=${mockResult.provider}, count=${mockResult.candidates.length}, first=${mockResult.candidates[0]?.placeName ?? 'none'}`,
    ),
  );

  let googleThrew = false;
  let googleResult = null as Awaited<ReturnType<typeof searchPlacesSafe>> | null;
  try {
    googleResult = await searchPlacesSafe(SAMPLE_INPUT, { mode: 'google' });
  } catch {
    googleThrew = true;
  }

  cases.push(
    assert(
      'google_unimplemented_does_not_crash',
      !googleThrew &&
        googleResult != null &&
        googleResult.candidates.length === 0 &&
        (googleResult.errorCode === 'missing_api_key' ||
          googleResult.errorCode === 'no_candidates'),
      googleThrew
        ? 'searchPlacesSafe threw'
        : `errorCode=${googleResult?.errorCode}, warning=${googleResult?.warning ?? 'none'}`,
    ),
  );

  cases.push(
    assert(
      'invalid_mode_falls_back_to_disabled',
      parsePlacesMode('unexpected-mode') === 'disabled' &&
        resolvePlacesMode({ mode: 'bogus' }) === 'disabled' &&
        getPlacesProvider({ mode: 'bogus' }).providerName === 'disabled',
      `resolved=${resolvePlacesMode({ mode: 'bogus' })}, provider=${getPlacesProvider({ mode: 'bogus' }).providerName}`,
    ),
  );

  resetPlacesProviderCache();

  const ok = cases.every((item) => item.passed);
  return { ok, cases };
}

export function formatPlacesProviderVerificationReport(report: VerificationReport): string {
  const lines = report.cases.map(
    (item) => `${item.passed ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`,
  );
  lines.unshift(report.ok ? 'ALL PASSED' : 'SOME FAILED');
  return lines.join('\n');
}
