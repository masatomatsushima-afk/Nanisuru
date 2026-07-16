/**
 * Trip DNA → Google Places検索意図（PlaceSearchIntent[]）。
 *
 * 1回の生成につき「巨大な1クエリ」ではなく、DNAの timeOfDayRules から複数の具体的な検索意図
 * （朝食・ランチ・カフェ・ディナー・観光・買い物…）を作る。DNAごとの if 分岐は書かない —
 * timeOfDayRules / categoryPriority / forbiddenCategories という設定データだけを読んで動く
 * 純粋関数（外部通信なし・Node実行可）。
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
};

export type SearchIntentDestination = {
  destinationLabel: string;
  city?: string;
  country?: string;
  baseArea?: string;
};

/** 旅行全体で作る検索意図の最大数（= Google Places呼び出し回数の土台。実際の呼び出し上限は orchestrator 側）。 */
export const MAX_SEARCH_INTENTS = 8;
/** 1つの検索意図で欲しい件数の目安。 */
export const DEFAULT_DESIRED_COUNT_PER_INTENT = 5;
/** 1つの時間帯スロットから採用するカテゴリ数の上限（例: 朝食 + カフェ の2つまで）。 */
const MAX_CATEGORIES_PER_SLOT = 2;

/**
 * slot × category → 自然な検索キーワード（英語ベース・DNA非依存の共通テーブル）。
 * 「グルメ専用」ではなく、food/cafe というカテゴリが登場する *どの* DNA でも同じテーブルを使う。
 */
const QUERY_KEYWORDS_BY_CATEGORY: Record<PlaceCategory, Partial<Record<TimeOfDaySlot, string>> & { default: string }> = {
  food: {
    morning: 'breakfast restaurants',
    midday: 'lunch restaurants',
    afternoon: 'restaurants',
    evening: 'dinner restaurants',
    night: 'late night restaurants',
    default: 'restaurants',
  },
  cafe: {
    morning: 'cafe breakfast',
    afternoon: 'dessert cafe',
    default: 'cafe',
  },
  sightseeing: {
    default: 'tourist attractions',
  },
  shopping: {
    default: 'shopping',
  },
  nightlife: {
    default: 'bars nightlife',
  },
  activity: {
    default: 'things to do activities',
  },
};

function buildQueryKeyword(category: PlaceCategory, slot: TimeOfDaySlot): string {
  const table = QUERY_KEYWORDS_BY_CATEGORY[category];
  return table[slot] ?? table.default;
}

/**
 * Trip DNA の `timeOfDayRules` から、旅行全体で使う検索意図の一覧を作る。
 * 各スロットの `preferredCategories` は既にそのスロットにとって自然な順（例: 午後なら
 * "カフェ→食事"）で書かれているため、その並び順の先頭から `MAX_CATEGORIES_PER_SLOT` 件を採用
 * する（`categoryPriority` で上書きしない — food のようなグローバル優先カテゴリが全スロットを
 * 奪ってしまうのを避ける）。forbiddenCategories は除外。同じ slot×category の組み合わせは1回
 * しか作らない（= 日をまたいで候補プールを共有する前提）。
 */
export function buildPlaceSearchIntents(
  dna: TripDnaProfile,
  destination: SearchIntentDestination,
): PlaceSearchIntent[] {
  const forbidden = new Set(dna.forbiddenCategories);
  const seenKeys = new Set<string>();
  const intents: PlaceSearchIntent[] = [];

  for (const slot of TIME_OF_DAY_SLOTS) {
    const rule = dna.timeOfDayRules.find((entry) => entry.slot === slot);
    const preferred = (rule?.preferredCategories ?? []).filter((category) => !forbidden.has(category));

    for (const category of preferred.slice(0, MAX_CATEGORIES_PER_SLOT)) {
      const key = `${slot}:${category}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      intents.push({
        intentId: key,
        dayIndex: null,
        timeSlot: slot,
        category,
        query: buildQueryKeyword(category, slot),
        city: destination.city,
        country: destination.country,
        baseArea: destination.baseArea,
        destinationLabel: destination.destinationLabel,
        desiredCount: DEFAULT_DESIRED_COUNT_PER_INTENT,
        requiredSpecificPlace: true,
      });

      if (intents.length >= MAX_SEARCH_INTENTS) return intents;
    }
  }

  return intents;
}
