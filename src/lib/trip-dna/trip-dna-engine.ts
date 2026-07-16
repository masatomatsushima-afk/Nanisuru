/**
 * Trip DNA Engine — パイプライン本体（純粋関数のみ・外部通信なし）。
 *
 *   Trip DNA（resolveTripDna）
 *     ↓
 *   Google Places検索カテゴリ（getPlacesSearchCategories）
 *     ↓
 *   候補ランキング（rankCandidatesByDna）
 *     ↓
 *   OpenAI生成（buildDnaPromptGuidance — プロンプト文言の下準備のみ。実際のOpenAI呼び出しは行わない）
 *     ↓
 *   Validation（validateItineraryAgainstDna）
 *     ↓（不足時）
 *   fallbackルール（resolveFallbackCategories）
 *
 * このファイルは `trip-dna-profiles.ts` の設定データだけを読んで動く。新しいDNAを追加しても
 * ここのコードは変更不要— 「if文を増やす」のではなく「設定を追加する」ことで対応する。
 *
 * 注意: このファイルは Google Places API / OpenAI API / Supabase のいずれも呼び出さない。
 * 実際の検索・生成呼び出しへの接続は今回のスコープ外（設計のみ）。
 */

import type { PlaceCategory } from '@/lib/destination-safety';
import { TRIP_DNA_PROFILES } from './trip-dna-profiles';
import type {
  TimeOfDaySlot,
  TripDnaFallbackRule,
  TripDnaMatchInput,
  TripDnaProfile,
} from './trip-dna-types';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { PlaceCandidate } from '@/types/place-candidate';

function buildKeywordHaystack(input: TripDnaMatchInput): string {
  return [
    input.mood,
    input.travelIntent,
    input.customPreferences?.customMood,
    input.customPreferences?.customTravelIntent,
    input.customPreferences?.desiredPlaces,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * 目的（personality/companion/mood/travelIntent/customPreferences）から Trip DNA を1つ解決する。
 * どれにも当たらない場合は null（= DNA無指定の既存挙動）。配列の並び順が優先度。
 */
export function resolveTripDna(input: TripDnaMatchInput): TripDnaProfile | null {
  const haystack = buildKeywordHaystack(input);

  for (const profile of TRIP_DNA_PROFILES) {
    const { matcher } = profile;
    if (input.personality && matcher.personalityMatch?.includes(input.personality)) return profile;
    if (input.companion && matcher.companionMatch?.includes(input.companion)) return profile;
    if (matcher.keywordPattern && haystack && matcher.keywordPattern.test(haystack)) return profile;
  }

  return null;
}

/** Trip DNA → Google Places検索カテゴリ。 */
export function getPlacesSearchCategories(dna: TripDnaProfile): PlaceCategory[] {
  if (dna.placesCategories.length > 0) return dna.placesCategories;
  return Object.keys(dna.activityWeights) as PlaceCategory[];
}

/**
 * 候補ランキング: 禁止カテゴリの候補を除外し、優先順位（categoryPriority）→ activityWeights →
 * rating → reviewCount の順でスコア付けする。既存の `place-candidate-ranking.ts` の
 * destination/openingHours等のロジックは変更せず、DNA観点の並び替えだけをこのモジュール内で行う
 * （Google Places側の実装には触れない）。
 */
export function rankCandidatesByDna(
  candidates: readonly PlaceCandidate[],
  dna: TripDnaProfile,
): PlaceCandidate[] {
  const forbidden = new Set(dna.forbiddenCategories);
  const priorityIndex = new Map(dna.categoryPriority.map((category, index) => [category, index]));

  const scored = candidates
    .filter((candidate) => !candidate.category || !forbidden.has(candidate.category))
    .map((candidate) => {
      const category = candidate.category;
      const priorityScore = category && priorityIndex.has(category)
        ? dna.categoryPriority.length - (priorityIndex.get(category) ?? 0)
        : 0;
      const weightScore = category ? (dna.activityWeights[category] ?? 0) * 20 : 0;
      const ratingScore = candidate.rating != null && Number.isFinite(candidate.rating)
        ? Math.max(0, Math.min(15, (candidate.rating / 5) * 15))
        : 0;
      const reviewScore = candidate.reviewCount != null && candidate.reviewCount > 0
        ? Math.min(12, Math.log10(candidate.reviewCount + 1) * 4)
        : 0;
      return { candidate, score: priorityScore * 10 + weightScore + ratingScore + reviewScore };
    });

  return scored
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.candidate);
}

const CATEGORY_LABEL_JA: Record<PlaceCategory, string> = {
  food: '食事',
  cafe: 'カフェ',
  sightseeing: '観光',
  shopping: 'ショッピング',
  nightlife: 'ナイトライフ',
  activity: 'アクティビティ',
};

/**
 * OpenAI生成ステップ向けのプロンプト文言を、DNAの設定データだけから組み立てる
 * （DNAごとの手書き文言は書かない）。今回は文字列を返すだけで、実際のOpenAI呼び出しには
 * 接続しない（次のステップで generate-plan.ts 側に組み込む想定）。
 */
export function buildDnaPromptGuidance(dna: TripDnaProfile): string {
  const allocationLine = Object.entries(dna.activityWeights)
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
    .map(([category, ratio]) => `${CATEGORY_LABEL_JA[category as PlaceCategory]}${Math.round((ratio ?? 0) * 100)}%`)
    .join(' / ');
  const forbiddenLine = dna.forbiddenCategories.length > 0
    ? dna.forbiddenCategories.map((category) => CATEGORY_LABEL_JA[category]).join('・')
    : null;

  return [
    `【Trip DNA: ${dna.label}】行程配分の目安は ${allocationLine} です。`,
    `- category=${dna.dominantCategory}（${CATEGORY_LABEL_JA[dna.dominantCategory]}）を全アイテムの${Math.round(dna.validationRules.minDominantCategoryRatio * 100)}%以上にすること。`,
    forbiddenLine ? `- category=${dna.forbiddenCategories.join('/')}（${forbiddenLine}）のアイテムは生成しないこと。` : null,
    `- 店名を伴わない抽象的な独立アイテムは旅行全体で最大${dna.validationRules.maxAbstractItems}件までにすること。`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

/** 「HH:MM」形式の時刻を Trip DNA の時間帯スロットに変換する共通ロジック（DNA非依存）。 */
export function getTimeOfDaySlot(time: string | undefined): TimeOfDaySlot | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isFinite(hour)) return null;

  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export type TripDnaValidationViolation = {
  type: 'dominant_ratio_below_target' | 'forbidden_category_item' | 'too_many_abstract_items' | 'time_of_day_conflict';
  message: string;
};

export type TripDnaValidationReport = {
  isValid: boolean;
  dominantCategoryRatio: number;
  violations: TripDnaValidationViolation[];
};

/**
 * Validationステップ: DNAの `validationRules` / `forbiddenCategories` / `timeOfDayRules` を
 * 満たしているかを判定するだけの純粋関数（生成結果を書き換えない — 修正の実行は今回のスコープ外）。
 */
export function validateItineraryAgainstDna(
  days: readonly ItineraryDay[],
  dna: TripDnaProfile,
): TripDnaValidationReport {
  const violations: TripDnaValidationViolation[] = [];
  const forbidden = new Set(dna.forbiddenCategories);
  const timeOfDayRuleBySlot = new Map(dna.timeOfDayRules.map((rule) => [rule.slot, rule]));

  let total = 0;
  let dominantCount = 0;
  let abstractItemCount = 0;

  const allItems: ItineraryItem[] = [];
  for (const day of days) {
    for (const item of day.items) allItems.push(item);
  }

  for (const item of allItems) {
    total += 1;
    if (item.category === dna.dominantCategory) dominantCount += 1;
    if (item.category === 'activity' && item.isSpecificPlace === false) abstractItemCount += 1;

    if (item.category && forbidden.has(item.category)) {
      violations.push({
        type: 'forbidden_category_item',
        message: `forbidden category "${item.category}" used: "${item.activity}"`,
      });
    }

    const slot = getTimeOfDaySlot(item.time);
    const rule = slot ? timeOfDayRuleBySlot.get(slot) : undefined;
    if (rule?.forbiddenCategories?.length && item.category && rule.forbiddenCategories.includes(item.category)) {
      violations.push({
        type: 'time_of_day_conflict',
        message: `category "${item.category}" not allowed at ${slot} (${item.time}): "${item.activity}"`,
      });
    }
  }

  const dominantCategoryRatio = total > 0 ? dominantCount / total : 0;
  if (total > 0 && dominantCategoryRatio < dna.validationRules.minDominantCategoryRatio) {
    violations.push({
      type: 'dominant_ratio_below_target',
      message: `dominant category ratio ${Math.round(dominantCategoryRatio * 100)}% below target ${Math.round(dna.validationRules.minDominantCategoryRatio * 100)}%`,
    });
  }
  if (abstractItemCount > dna.validationRules.maxAbstractItems) {
    violations.push({
      type: 'too_many_abstract_items',
      message: `${abstractItemCount} abstract items exceed max ${dna.validationRules.maxAbstractItems}`,
    });
  }

  return { isValid: violations.length === 0, dominantCategoryRatio, violations };
}

/**
 * fallbackルール: 利用可能なカテゴリの中から、DNAの縮退順（degradeCategoryOrder）に沿って
 * 使えるカテゴリだけを返す。全滅した場合は空配列（= 呼び出し側は genericAreaPhraseStyle を
 * 使った汎用エリア表現にフォールバックする、という設計上の想定）。
 */
export function resolveFallbackCategories(
  dna: TripDnaProfile,
  availableCategories: readonly PlaceCategory[],
): { categories: PlaceCategory[]; style: TripDnaFallbackRule['genericAreaPhraseStyle'] } {
  const available = new Set(availableCategories);
  const categories = dna.fallbackRule.degradeCategoryOrder.filter((category) => available.has(category));
  return { categories, style: dna.fallbackRule.genericAreaPhraseStyle };
}
