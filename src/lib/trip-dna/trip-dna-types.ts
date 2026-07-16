/**
 * Trip DNA Engine — 型定義（スキーマ）。
 *
 * 「旅行スタイル（Trip DNA）」を if 文の分岐ではなく設定オブジェクトとして表現するための型。
 * 新しい DNA を増やすときは、この型を満たす設定オブジェクトを `trip-dna-profiles.ts` の
 * `TRIP_DNA_PROFILES` 配列に1つ追加するだけでよい（このファイル・`trip-dna-engine.ts` は
 * 変更不要）。
 *
 * パイプライン: Trip DNA → Google Places検索カテゴリ → 候補ランキング → OpenAI生成 → Validation
 *   - Google Places検索カテゴリ: `placesCategories`
 *   - 候補ランキング: `activityWeights` + `categoryPriority`
 *   - OpenAI生成: `activityWeights` + `timeOfDayRules` + `forbiddenCategories`（プロンプト文言化）
 *   - Validation: `validationRules` + `forbiddenCategories`
 *   - 候補不足時のフォールバック: `fallbackRule`
 */

import type { PlaceCategory } from '@/lib/destination-safety';
import type { CompanionOption, PersonalityOption } from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';

/** カテゴリ別の重み（0〜1の目安・合計1でなくてよい）。 */
export type TripDnaActivityWeights = Partial<Record<PlaceCategory, number>>;

/** 1日の時間帯区分。境界は `trip-dna-engine.ts` の `getTimeOfDaySlot()` が共通ロジックで判定する。 */
export const TIME_OF_DAY_SLOTS = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const;
export type TimeOfDaySlot = (typeof TIME_OF_DAY_SLOTS)[number];

/** ある時間帯において推奨・禁止するカテゴリのルール。 */
export type TimeOfDayRule = {
  slot: TimeOfDaySlot;
  preferredCategories?: PlaceCategory[];
  forbiddenCategories?: PlaceCategory[];
};

/** 生成後 Validation の判定基準。 */
export type TripDnaValidationRules = {
  /** dominantCategory が全アイテムに占める最低比率。下回ったら違反として報告する。 */
  minDominantCategoryRatio: number;
  /** 店名を伴わない抽象的な独立アイテムを旅行全体で何件まで許容するか。 */
  maxAbstractItems: number;
};

/** Google Places候補が不足したとき／生成後になお不足しているときの縮退方針。 */
export type TripDnaFallbackRule = {
  /** 不足時に許容するカテゴリの優先順（先頭が最優先）。 */
  degradeCategoryOrder: PlaceCategory[];
  /** 候補が完全に無いときの汎用エリア表現のトーン（フォールバック文言生成に使う）。 */
  genericAreaPhraseStyle: 'scenic' | 'culinary' | 'shopping' | 'leisure' | 'nightlife' | 'neutral';
};

/** この DNA を選ぶ条件（personality/companion の完全一致 OR mood系テキストの正規表現）。 */
export type TripDnaMatcher = {
  personalityMatch?: readonly PersonalityOption[];
  companionMatch?: readonly CompanionOption[];
  keywordPattern?: RegExp;
};

/**
 * Trip DNA 1件分の設定。ユーザー指定の7項目
 * （activity weight / Google Places検索カテゴリ / 優先順位 / 禁止カテゴリ / 時間帯ルール /
 *   Validationルール / fallbackルール）をそれぞれ1フィールドに対応させている。
 */
export type TripDnaProfile = {
  id: string;
  label: string;
  matcher: TripDnaMatcher;

  /** 1. activity weight */
  activityWeights: TripDnaActivityWeights;
  /** 2. Google Places検索カテゴリ */
  placesCategories: PlaceCategory[];
  /** 3. 優先順位（候補ランキング時にこの順で優先する） */
  categoryPriority: PlaceCategory[];
  /** 4. 禁止カテゴリ（このDNAでは生成しない・Validationで違反扱いにする） */
  forbiddenCategories: PlaceCategory[];
  /** 5. 時間帯ルール */
  timeOfDayRules: TimeOfDayRule[];
  /** 6. Validationルール */
  validationRules: TripDnaValidationRules;
  /** 7. fallbackルール */
  fallbackRule: TripDnaFallbackRule;

  /** 配分の中で最も重視するカテゴリ（Validation・ランキングの基準）。 */
  dominantCategory: PlaceCategory;
};

/** `resolveTripDna()` への入力（PlanInput から必要な部分だけを渡す）。 */
export type TripDnaMatchInput = {
  personality?: PersonalityOption;
  companion?: CompanionOption;
  mood?: string;
  travelIntent?: string;
  customPreferences?: PlanCustomPreferences;
};
