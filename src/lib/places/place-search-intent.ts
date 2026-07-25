/**
 * Trip DNA / selected purposes → Google Places検索意図（PlaceSearchIntent[]）。
 *
 * 1回の生成につき「巨大な1クエリ」ではなく、複数の具体的な検索意図を作る。
 * 複数目的のときは purpose ごとのカテゴリ意図を合成し、巨大な組み合わせ if 文は書かない。
 */

import type { PlaceCategory } from '@/lib/destination-safety';
import { TIME_OF_DAY_SLOTS, type TimeOfDaySlot, type TripDnaProfile } from '@/lib/trip-dna/trip-dna-types';

export type PlaceSearchIntent = {
  intentId: string;
  /** trip-wide（日をまたいで候補を共有）のときは null。将来、日別に変えたい場合のための予約フィールド。 */
  dayIndex: number | null;
  timeSlot: TimeOfDaySlot;
  category: PlaceCategory;
  query: string;
  city?: string;
  country?: string;
  baseArea?: string;
  destinationLabel: string;
  desiredCount: number;
  requiredSpecificPlace: boolean;
  /** Canonical purpose this intent primarily serves (diagnostics). */
  purposeId?: string;
};

export type SearchIntentDestination = {
  destinationLabel: string;
  city?: string;
  country?: string;
  baseArea?: string;
};

export type SelectedPurposeLike = {
  purpose: string;
  weight?: number;
};

/** 旅行全体で作る検索意図の最大数（= Google Places呼び出し回数の土台。実際の呼び出し上限は orchestrator 側）。 */
export const MAX_SEARCH_INTENTS = 8;
/** 1つの検索意図で欲しい件数の目安。 */
export const DEFAULT_DESIRED_COUNT_PER_INTENT = 5;
/** 1つの時間帯スロットから採用するカテゴリ数の上限（例: 朝食 + カフェ の2つまで）。 */
const MAX_CATEGORIES_PER_SLOT = 2;

/**
 * slot × category → 自然な検索キーワード（英語ベース・DNA非依存の共通テーブル）。
 */
const QUERY_KEYWORDS_BY_CATEGORY: Record<
  PlaceCategory,
  Partial<Record<TimeOfDaySlot, string>> & { default: string }
> = {
  food: {
    morning: 'breakfast restaurants',
    midday: 'lunch restaurants local food',
    afternoon: 'restaurants street food',
    evening: 'dinner restaurants',
    night: 'late night restaurants',
    default: 'restaurants local food',
  },
  cafe: {
    morning: 'cafe breakfast',
    afternoon: 'dessert cafe',
    default: 'cafe',
  },
  sightseeing: {
    default: 'tourist attractions landmarks museum park temple shrine',
  },
  shopping: {
    midday: 'shopping mall department store',
    afternoon: 'fashion street shopping cosmetics store',
    evening: 'shopping street cosmetics store',
    default: 'shopping mall market fashion street',
  },
  nightlife: {
    default: 'bars nightlife',
  },
  activity: {
    default: 'things to do activities',
  },
};

/** Canonical purpose → categories to search (no combination if-trees). */
export const PURPOSE_SEARCH_CATEGORIES: Readonly<Record<string, readonly PlaceCategory[]>> = {
  gourmet: ['food', 'cafe'],
  shopping: ['shopping'],
  sightseeing: ['sightseeing'],
  nightlife: ['nightlife'],
  nature: ['activity', 'sightseeing'],
  ai: ['sightseeing', 'food', 'cafe', 'shopping'],
};

/** Alternate queries when a purpose returns 0 candidates (retry; still real Places only). */
export const PURPOSE_RETRY_QUERIES: Readonly<Record<string, readonly string[]>> = {
  gourmet: ['restaurant', 'local food', 'dessert cafe', 'street food'],
  shopping: ['shopping mall', 'fashion street', 'cosmetics store', 'department store', 'market'],
  sightseeing: ['landmark', 'tourist attraction', 'museum', 'park'],
  nightlife: ['bar', 'nightlife'],
  nature: ['park', 'garden', 'outdoor'],
  ai: ['tourist attraction', 'restaurant', 'shopping mall'],
};

/** Known hub → nearby neighborhoods for query enrichment (config, not purpose×city if-trees). */
const BASE_AREA_NEARBY: Readonly<Record<string, readonly string[]>> = {
  難波: ['難波', '心斎橋', '道頓堀', '日本橋', '千日前', '黒門市場'],
  namba: ['Namba', 'Shinsaibashi', 'Dotonbori', 'Nipponbashi'],
  聖水: ['聖水', 'Seongsu'],
  seongsu: ['Seongsu', '성수'],
  明洞: ['明洞', 'Myeongdong'],
  myeongdong: ['Myeongdong'],
};

function buildQueryKeyword(category: PlaceCategory, slot: TimeOfDaySlot): string {
  const table = QUERY_KEYWORDS_BY_CATEGORY[category];
  return table[slot] ?? table.default;
}

function nearbyHint(baseArea?: string): string {
  if (!baseArea?.trim()) return '';
  const key = baseArea.trim().toLowerCase();
  const nearby =
    BASE_AREA_NEARBY[baseArea.trim()] ??
    BASE_AREA_NEARBY[key] ??
    null;
  if (!nearby?.length) return baseArea.trim();
  return nearby.slice(0, 3).join(' ');
}

function makeIntent(params: {
  intentId: string;
  slot: TimeOfDaySlot;
  category: PlaceCategory;
  query: string;
  destination: SearchIntentDestination;
  purposeId?: string;
}): PlaceSearchIntent {
  const areaHint = nearbyHint(params.destination.baseArea);
  const queryWithArea = areaHint
    ? `${params.query} ${areaHint}`.trim()
    : params.query;

  return {
    intentId: params.intentId,
    dayIndex: null,
    timeSlot: params.slot,
    category: params.category,
    query: queryWithArea,
    city: params.destination.city,
    country: params.destination.country,
    baseArea: params.destination.baseArea,
    destinationLabel: params.destination.destinationLabel,
    desiredCount: DEFAULT_DESIRED_COUNT_PER_INTENT,
    requiredSpecificPlace: true,
    purposeId: params.purposeId,
  };
}

/**
 * Ensure each selected purpose contributes at least one search intent.
 * Round-robin so secondary purposes are not starved by primary weight.
 */
function buildPurposeCoverageIntents(
  selectedPurposes: readonly SelectedPurposeLike[],
  destination: SearchIntentDestination,
  seenKeys: Set<string>,
  limit: number,
): PlaceSearchIntent[] {
  const intents: PlaceSearchIntent[] = [];
  if (selectedPurposes.length === 0 || limit <= 0) return intents;

  const slotsForWeight = (weight: number | undefined): TimeOfDaySlot[] => {
    if ((weight ?? 0) >= 0.5) return ['midday', 'afternoon', 'evening'];
    if ((weight ?? 0) >= 0.25) return ['afternoon', 'evening'];
    return ['afternoon'];
  };

  type Pending = { purposeId: string; slot: TimeOfDaySlot; category: PlaceCategory };
  const queues: Pending[][] = selectedPurposes.map((purpose) => {
    const categories = PURPOSE_SEARCH_CATEGORIES[purpose.purpose] ?? [];
    const pending: Pending[] = [];
    for (const slot of slotsForWeight(purpose.weight)) {
      for (const category of categories) {
        pending.push({ purposeId: purpose.purpose, slot, category });
      }
    }
    return pending;
  });

  const tryPush = (entry: Pending): boolean => {
    const slotKey = `${entry.slot}:${entry.category}`;
    const key = `purpose:${entry.purposeId}:${entry.slot}:${entry.category}`;
    if (seenKeys.has(key) || seenKeys.has(slotKey)) return false;
    seenKeys.add(key);
    seenKeys.add(slotKey);
    intents.push(
      makeIntent({
        intentId: key,
        slot: entry.slot,
        category: entry.category,
        query: buildQueryKeyword(entry.category, entry.slot),
        destination,
        purposeId: entry.purposeId,
      }),
    );
    return true;
  };

  // Pass 1: at least one intent per purpose (when possible).
  for (const queue of queues) {
    if (intents.length >= limit) break;
    while (queue.length > 0) {
      const next = queue.shift()!;
      if (tryPush(next)) break;
    }
  }

  // Pass 2: round-robin fill remaining budget.
  let progressed = true;
  while (intents.length < limit && progressed) {
    progressed = false;
    for (const queue of queues) {
      if (intents.length >= limit) break;
      while (queue.length > 0) {
        const next = queue.shift()!;
        if (tryPush(next)) {
          progressed = true;
          break;
        }
      }
    }
  }

  return intents;
}

/** Retry intents when candidateCountByPurpose[purpose] === 0. */
export function buildPurposeRetryIntents(
  purposeId: string,
  destination: SearchIntentDestination,
  alreadyUsedIds: ReadonlySet<string>,
  limit = 2,
): PlaceSearchIntent[] {
  const categories = PURPOSE_SEARCH_CATEGORIES[purposeId] ?? [];
  const queries = PURPOSE_RETRY_QUERIES[purposeId] ?? [];
  const intents: PlaceSearchIntent[] = [];
  let qi = 0;

  for (const category of categories) {
    for (; qi < queries.length && intents.length < limit; qi += 1) {
      const intentId = `retry:${purposeId}:${category}:${queries[qi]}`;
      if (alreadyUsedIds.has(intentId)) continue;
      intents.push(
        makeIntent({
          intentId,
          slot: 'afternoon',
          category,
          query: queries[qi],
          destination,
          purposeId,
        }),
      );
    }
  }

  return intents;
}

/**
 * Trip DNA の `timeOfDayRules` から検索意図を作る。
 * selectedPurposes がある場合は、先に目的別カバレッジ意図を確保してから DNA 意図を足す。
 */
export function buildPlaceSearchIntents(
  dna: TripDnaProfile,
  destination: SearchIntentDestination,
  options?: { selectedPurposes?: readonly SelectedPurposeLike[] | null },
): PlaceSearchIntent[] {
  const forbidden = new Set(dna.forbiddenCategories);
  const seenKeys = new Set<string>();
  const intents: PlaceSearchIntent[] = [];
  const selected = options?.selectedPurposes ?? [];

  if (selected.length > 0) {
    const purposeBudget = Math.min(MAX_SEARCH_INTENTS, Math.max(3, selected.length * 2));
    intents.push(...buildPurposeCoverageIntents(selected, destination, seenKeys, purposeBudget));
  }

  for (const slot of TIME_OF_DAY_SLOTS) {
    if (intents.length >= MAX_SEARCH_INTENTS) break;
    const rule = dna.timeOfDayRules.find((entry) => entry.slot === slot);
    const preferred = (rule?.preferredCategories ?? []).filter((category) => !forbidden.has(category));

    for (const category of preferred.slice(0, MAX_CATEGORIES_PER_SLOT)) {
      const key = `${slot}:${category}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      intents.push(
        makeIntent({
          intentId: key,
          slot,
          category,
          query: buildQueryKeyword(category, slot),
          destination,
        }),
      );

      if (intents.length >= MAX_SEARCH_INTENTS) return intents;
    }
  }

  return intents;
}

/** Count how many candidates map to each selected purpose (by category). */
export function countCandidatesByPurpose(
  candidates: readonly { category?: PlaceCategory | null }[],
  selectedPurposes: readonly SelectedPurposeLike[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const purpose of selectedPurposes) {
    const categories = new Set(PURPOSE_SEARCH_CATEGORIES[purpose.purpose] ?? []);
    counts[purpose.purpose] = candidates.filter(
      (candidate) => candidate.category && categories.has(candidate.category),
    ).length;
  }
  return counts;
}
