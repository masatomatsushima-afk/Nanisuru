/**
 * 検索意図（PlaceSearchIntent[]）ごとに Google Places を検索し、結果を1つの候補プールへ束ねる。
 *
 * 安全策（API コストが無制限に増えないように定数化）:
 * - 同時通信数は最大 {@link MAX_CONCURRENT_SEARCHES}
 * - 旅行全体の検索呼び出し回数は最大 {@link MAX_API_CALLS_PER_TRIP}（段階的拡張の再検索も含む）
 * - 最終候補プールは最大 {@link MAX_FINAL_CANDIDATE_POOL} 件
 * - `placeId` で重複排除（同じ店が複数意図にヒットしても1件にまとめる）
 *
 * 段階的な検索拡張（結果が薄い意図だけ、呼び出し予算が残っていれば再検索する）:
 * 1. baseArea + category + city + country（最も絞り込んだクエリ）
 * 2. city + country + category（baseAreaを外して広げる）
 * 3. カテゴリの安全な同義語 + city + country（架空店舗は作らない・候補のみを広げる）
 */

import type { PlaceCandidate } from '@/types/place-candidate';
import type { PlaceCategory } from '@/lib/destination-safety';
import type { PlaceSearchIntent } from './place-search-intent';
import type { PlacesSearchInput } from './places-search-input';
import { searchPlacesSafe } from './places-search-service';

export const MAX_CONCURRENT_SEARCHES = 2;
export const MAX_API_CALLS_PER_TRIP = 8;
export const MAX_FINAL_CANDIDATE_POOL = 30;
const MIN_RESULTS_BEFORE_BROADENING = 2;

export type SearchExecutor = (input: PlacesSearchInput) => Promise<PlaceCandidate[]>;

export type PlaceSearchOrchestrationResult = {
  candidates: PlaceCandidate[];
  apiCallCount: number;
  candidatesPerIntent: Record<string, number>;
  totalCandidatesBeforeDedup: number;
  uniqueCandidateCount: number;
};

/** 既定の実行関数 — 既存の安全な入口（`searchPlacesSafe`）をそのまま使う。例外を投げない。 */
export async function defaultSearchExecutor(input: PlacesSearchInput): Promise<PlaceCandidate[]> {
  const result = await searchPlacesSafe(input);
  return result.ok ? result.candidates : [];
}

const SYNONYM_QUERY_BY_CATEGORY: Record<PlaceCategory, string> = {
  food: 'local food spots',
  cafe: 'coffee shop',
  sightseeing: 'landmarks',
  shopping: 'markets',
  nightlife: 'bars',
  activity: 'experiences',
};

function buildStageInput(intent: PlaceSearchIntent, stage: 1 | 2 | 3): PlacesSearchInput {
  const base: PlacesSearchInput = {
    destination: intent.destinationLabel,
    city: intent.city,
    country: intent.country,
    category: intent.category,
    limit: intent.desiredCount,
  };

  if (stage === 1) {
    return { ...base, baseArea: intent.baseArea, query: intent.query };
  }
  if (stage === 2) {
    // baseAreaを外し city+country+category へ広げる — destination外には出ない。
    return { ...base, query: intent.query };
  }
  // stage 3: 安全な同義語（架空店舗は作らない・候補の検索語だけを広げる）。
  return { ...base, query: SYNONYM_QUERY_BY_CATEGORY[intent.category] ?? intent.category };
}

/** 配列を最大 `limit` 件まで並列実行するシンプルな同時実行制御（外部依存なし）。 */
async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const current = nextIndex;
    nextIndex += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current]);
    await runNext();
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}

/**
 * 検索意図ごとに Google Places を検索し、重複排除済みの候補プールを返す。
 * 例外を投げない — 個々の検索が失敗しても他の意図の結果はそのまま活かす。
 */
export async function runPlaceSearchOrchestration(
  intents: readonly PlaceSearchIntent[],
  executor: SearchExecutor = defaultSearchExecutor,
): Promise<PlaceSearchOrchestrationResult> {
  let apiCallCount = 0;
  const candidatesPerIntent: Record<string, number> = {};
  const byPlaceId = new Map<string, PlaceCandidate>();
  let totalCandidatesBeforeDedup = 0;

  const budgetedIntents = intents.slice(0, MAX_API_CALLS_PER_TRIP);

  const addCandidates = (intentId: string, candidates: readonly PlaceCandidate[]): void => {
    candidatesPerIntent[intentId] = (candidatesPerIntent[intentId] ?? 0) + candidates.length;
    totalCandidatesBeforeDedup += candidates.length;
    for (const candidate of candidates) {
      if (candidate.placeId) byPlaceId.set(candidate.placeId, candidate);
    }
  };

  const stage1Results = await runWithConcurrency(budgetedIntents, MAX_CONCURRENT_SEARCHES, async (intent) => {
    if (apiCallCount >= MAX_API_CALLS_PER_TRIP) return { intent, candidates: [] as PlaceCandidate[] };
    apiCallCount += 1;
    const candidates = await executor(buildStageInput(intent, 1)).catch(() => []);
    return { intent, candidates };
  });

  for (const { intent, candidates } of stage1Results) {
    addCandidates(intent.intentId, candidates);
  }

  // 段階的拡張: 結果が薄かった意図だけ、呼び出し予算が残っていれば stage2 → stage3 で再検索する。
  for (const stage of [2, 3] as const) {
    if (apiCallCount >= MAX_API_CALLS_PER_TRIP) break;

    const weakIntents = stage1Results
      .filter((entry) => (candidatesPerIntent[entry.intent.intentId] ?? 0) < MIN_RESULTS_BEFORE_BROADENING)
      .map((entry) => entry.intent);

    for (const intent of weakIntents) {
      if (apiCallCount >= MAX_API_CALLS_PER_TRIP) break;
      apiCallCount += 1;
      const more = await executor(buildStageInput(intent, stage)).catch(() => []);
      addCandidates(intent.intentId, more);
    }
  }

  const unique = Array.from(byPlaceId.values());

  return {
    candidates: unique.slice(0, MAX_FINAL_CANDIDATE_POOL),
    apiCallCount,
    candidatesPerIntent,
    totalCandidatesBeforeDedup,
    uniqueCandidateCount: unique.length,
  };
}
