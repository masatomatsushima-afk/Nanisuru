/**
 * 目的別プランニングの共通設計。
 *
 *   目的（personality/mood/travelIntent/companion等）
 *     ↓ resolvePurposeProfile()
 *   配分ルール（allocation = カテゴリ別の目安比率）
 *     ↓ plan-places-candidates.ts（Google Places検索カテゴリに反映）
 *     ↓ purpose-composition-enforcement.ts（生成後の比率補正に反映）
 *   生成
 *
 * 「グルメ」等の目的ごとにロジックを個別実装するのは禁止 — 新しい目的を追加したいときは、
 * このファイルの `PURPOSE_PROFILES` 配列に設定オブジェクトを1つ追加するだけでよい構造にする。
 * どの目的にも当たらない場合（`resolvePurposeProfile` が null を返す）は、既存の
 * 汎用（無指定）挙動を一切変えない。
 */

import type { PlaceCategory } from '@/lib/destination-safety';
import type { CompanionOption, PersonalityOption } from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import {
  PURPOSE_TO_PURPOSE_PROFILE_ID,
  type SelectedPurpose,
} from '@/lib/selected-purposes';

/** カテゴリ→目安比率（0〜1）。合計が1でなくても実行時に正規化される。 */
export type PurposeAllocation = Partial<Record<PlaceCategory, number>>;

export type PurposeProfile = {
  /** 内部識別子・devログ用。 */
  id: string;
  /** ユーザー向け表示名（プロンプト文言にそのまま使う）。 */
  label: string;
  /** この値と personality が一致したら即マッチ。 */
  personalityMatch?: readonly PersonalityOption[];
  /** この値と companion が一致したら即マッチ（他条件とOR）。 */
  companionMatch?: readonly CompanionOption[];
  /** mood / travelIntent / customPreferences のテキストに対する正規表現マッチ。 */
  keywordPattern?: RegExp;
  /** カテゴリ別の目安配分。Google Places検索カテゴリの絞り込み・生成後の比率補正の両方に使う。 */
  allocation: PurposeAllocation;
  /** 配分の中で最も重視するカテゴリ（比率補正の基準・候補置換の優先カテゴリ）。 */
  dominantCategory: PlaceCategory;
  /**
   * 比率カウント対象のカテゴリ群。未指定時は [dominantCategory] のみ。
   * 例: グルメは food+cafe をまとめて 45〜60% のバンドで管理する。
   */
  dominantGroup?: readonly PlaceCategory[];
  /** dominantGroup が全アイテムに占める最低比率。下回った場合に候補で補正する。 */
  minDominantRatio: number;
  /**
   * dominantGroup の上限比率（任意）。超過時は未使用の非dominant候補で差し替え、
   * 候補が無ければ超過分をそのまま残す（架空店名は作らない）。
   */
  maxDominantRatio?: number;
  /** 店名を伴わない抽象的な散策・移動系の独立アイテムを、旅行全体で何件まで許容するか。 */
  maxAbstractWalkItems: number;
};

/** dominantGroup が未設定なら [dominantCategory] にフォールバック。 */
export function resolveDominantGroup(profile: PurposeProfile): readonly PlaceCategory[] {
  return profile.dominantGroup?.length ? profile.dominantGroup : [profile.dominantCategory];
}

export const PURPOSE_PROFILES: readonly PurposeProfile[] = [
  {
    id: 'gourmet',
    label: 'グルメ',
    personalityMatch: ['グルメ'],
    keywordPattern: /グルメ|食べ歩き|フード|food|gourmet|レストラン巡/i,
    // food+cafe ≈ 55% / sightseeing 30% / shopping 15% — 全件飲食にしない現実的な配分。
    allocation: { food: 0.35, cafe: 0.2, sightseeing: 0.3, shopping: 0.15 },
    dominantCategory: 'food',
    dominantGroup: ['food', 'cafe'],
    minDominantRatio: 0.45,
    maxDominantRatio: 0.6,
    maxAbstractWalkItems: 0,
  },
  {
    id: 'sightseeing',
    label: '観光',
    keywordPattern: /観光|名所巡り|ランドマーク|世界遺産|sightseeing|tourist spot/i,
    allocation: { sightseeing: 0.7, food: 0.15, shopping: 0.1, activity: 0.05 },
    dominantCategory: 'sightseeing',
    minDominantRatio: 0.55,
    maxAbstractWalkItems: 1,
  },
  {
    id: 'shopping',
    label: 'ショッピング',
    keywordPattern: /ショッピング|お土産巡り|買い物三昧|shopping spree/i,
    allocation: { shopping: 0.6, food: 0.2, cafe: 0.15, activity: 0.05 },
    dominantCategory: 'shopping',
    minDominantRatio: 0.5,
    maxAbstractWalkItems: 1,
  },
  {
    id: 'nature',
    label: '自然',
    keywordPattern: /自然満喫|絶景|ハイキング|トレッキング|国立公園|nature trip|hiking/i,
    allocation: { sightseeing: 0.5, activity: 0.3, food: 0.15, cafe: 0.05 },
    dominantCategory: 'sightseeing',
    minDominantRatio: 0.45,
    maxAbstractWalkItems: 2,
  },
  {
    id: 'instagenic',
    label: 'インスタ映え',
    personalityMatch: ['映え重視'],
    keywordPattern: /インスタ映え|フォトジェニック|映えスポット|instagenic|photogenic/i,
    allocation: { sightseeing: 0.45, cafe: 0.3, shopping: 0.15, activity: 0.1 },
    dominantCategory: 'sightseeing',
    minDominantRatio: 0.4,
    maxAbstractWalkItems: 1,
  },
  {
    id: 'kids',
    label: '子連れ',
    companionMatch: ['家族'],
    keywordPattern: /子連れ|子供と一緒|キッズ向け|ファミリー向け|kids friendly/i,
    allocation: { activity: 0.4, sightseeing: 0.3, food: 0.2, cafe: 0.1 },
    dominantCategory: 'activity',
    minDominantRatio: 0.35,
    maxAbstractWalkItems: 2,
  },
  {
    id: 'couple',
    label: 'カップル',
    companionMatch: ['カップル', '初デート'],
    keywordPattern: /カップル旅行|デートスポット|恋人と|romantic getaway/i,
    allocation: { food: 0.3, sightseeing: 0.3, cafe: 0.2, nightlife: 0.2 },
    dominantCategory: 'food',
    minDominantRatio: 0.25,
    maxAbstractWalkItems: 1,
  },
  {
    id: 'solo',
    label: '一人旅',
    companionMatch: ['一人'],
    keywordPattern: /一人旅|ソロ旅行|solo trip/i,
    allocation: { sightseeing: 0.35, food: 0.3, cafe: 0.2, activity: 0.15 },
    dominantCategory: 'sightseeing',
    minDominantRatio: 0.3,
    maxAbstractWalkItems: 1,
  },
  {
    id: 'nightlife',
    label: 'ナイトライフ',
    keywordPattern: /ナイトライフ|夜遊び|バー巡り|クラブ巡り|nightlife|bar hopping/i,
    allocation: { nightlife: 0.55, food: 0.25, cafe: 0.1, activity: 0.1 },
    dominantCategory: 'nightlife',
    minDominantRatio: 0.45,
    maxAbstractWalkItems: 1,
  },
  {
    id: 'relax',
    label: 'リラックス',
    personalityMatch: ['のんびり'],
    keywordPattern: /のんびり過ごし|リラックス旅行|癒し旅|スパ巡り|温泉巡り|relaxing trip|spa retreat/i,
    allocation: { cafe: 0.35, activity: 0.3, food: 0.25, sightseeing: 0.1 },
    dominantCategory: 'cafe',
    minDominantRatio: 0.3,
    maxAbstractWalkItems: 2,
  },
] as const;

export type PurposeProfileMatchInput = {
  personality?: PersonalityOption;
  companion?: CompanionOption;
  mood?: string;
  travelIntent?: string;
  customPreferences?: PlanCustomPreferences;
};

function buildKeywordHaystack(input: PurposeProfileMatchInput): string {
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
 * 目的（personality/companion/mood/travelIntent/customPreferences）から該当する
 * PurposeProfile を1つ解決する。どれにも当たらない場合は null（= 既存の無指定挙動のまま）。
 * 配列の並び順が優先度（先に定義したプロファイルが優先）。
 */
export function resolvePurposeProfile(input: PurposeProfileMatchInput): PurposeProfile | null {
  const haystack = buildKeywordHaystack(input);

  for (const profile of PURPOSE_PROFILES) {
    if (input.personality && profile.personalityMatch?.includes(input.personality)) return profile;
    if (input.companion && profile.companionMatch?.includes(input.companion)) return profile;
    if (profile.keywordPattern && haystack && profile.keywordPattern.test(haystack)) return profile;
  }

  return null;
}

function normalizeAllocation(allocation: PurposeAllocation): PurposeAllocation {
  const entries = Object.entries(allocation).filter(
    (entry): entry is [PlaceCategory, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
  );
  const sum = entries.reduce((acc, [, value]) => acc + value, 0);
  if (sum <= 0) return {};
  const normalized: PurposeAllocation = {};
  for (const [category, value] of entries) {
    normalized[category] = value / sum;
  }
  return normalized;
}

function lookupPurposeProfile(purposeId: string): PurposeProfile | null {
  const mapped = PURPOSE_TO_PURPOSE_PROFILE_ID[purposeId] ?? purposeId;
  return PURPOSE_PROFILES.find((profile) => profile.id === mapped) ?? null;
}

/**
 * Blend Purpose Profiles by selected purpose weights.
 * Primary dominates label/dominantCategory/safety-ish caps; allocations are weighted.
 * Safety rules (meal pacing etc.) still read from the blended allocation food weight.
 */
export function blendPurposeProfiles(
  selected: readonly SelectedPurpose[],
): PurposeProfile | null {
  const usable = selected.filter((item) => item.purpose && item.purpose !== 'ai');
  if (usable.length === 0) return null;

  const resolved = usable
    .map((item) => {
      const profile = lookupPurposeProfile(item.purpose);
      return profile ? { item, profile } : null;
    })
    .filter((entry): entry is { item: SelectedPurpose; profile: PurposeProfile } => Boolean(entry));

  if (resolved.length === 0) return null;
  if (resolved.length === 1) return resolved[0].profile;

  const weightSum = resolved.reduce((acc, entry) => acc + Math.max(0, entry.item.weight), 0) || 1;
  const allocation: PurposeAllocation = {};
  let minDominantRatio = 0;
  let maxDominantRatioSum = 0;
  let maxDominantRatioWeight = 0;
  let maxAbstractWalkItems = resolved[0].profile.maxAbstractWalkItems;

  for (const { item, profile } of resolved) {
    const w = Math.max(0, item.weight) / weightSum;
    for (const [category, ratio] of Object.entries(profile.allocation)) {
      if (typeof ratio !== 'number' || !Number.isFinite(ratio)) continue;
      allocation[category as PlaceCategory] =
        (allocation[category as PlaceCategory] ?? 0) + ratio * w;
    }
    minDominantRatio += profile.minDominantRatio * w;
    if (profile.maxDominantRatio != null) {
      maxDominantRatioSum += profile.maxDominantRatio * w;
      maxDominantRatioWeight += w;
    }
    // Keep abstract-walk cap on the stricter (lower) side — safety over taste weight.
    maxAbstractWalkItems = Math.min(maxAbstractWalkItems, profile.maxAbstractWalkItems);
  }

  const primary = resolved[0].profile;
  const dominantGroup = [
    ...new Set(resolved.flatMap(({ profile }) => [...resolveDominantGroup(profile)])),
  ];

  return {
    id: `blend:${resolved.map((entry) => entry.profile.id).join('+')}`,
    label: resolved.map((entry) => entry.profile.label).join('×'),
    allocation: normalizeAllocation(allocation),
    dominantCategory: primary.dominantCategory,
    dominantGroup,
    minDominantRatio: Math.max(0.15, Math.min(0.7, minDominantRatio)),
    maxDominantRatio:
      maxDominantRatioWeight > 0
        ? Math.max(0.2, Math.min(0.85, maxDominantRatioSum / maxDominantRatioWeight))
        : primary.maxDominantRatio,
    maxAbstractWalkItems,
  };
}

/**
 * Resolve a single profile (legacy) or a weight-blended profile when selectedPurposes is provided.
 */
export function resolvePurposeProfileWithSelection(
  input: PurposeProfileMatchInput & { selectedPurposes?: readonly SelectedPurpose[] | null },
): PurposeProfile | null {
  if (input.selectedPurposes && input.selectedPurposes.length > 0) {
    const blended = blendPurposeProfiles(input.selectedPurposes);
    if (blended) return blended;
  }
  return resolvePurposeProfile(input);
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
 * PurposeProfile の設定データだけからプロンプト文言を組み立てる（目的ごとの手書き文言は禁止）。
 * 新しい目的を追加してもこの関数は変更不要。
 */
export function buildPurposeCompositionPromptSection(profile: PurposeProfile): string {
  const allocationLine = Object.entries(profile.allocation)
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
    .map(([category, ratio]) => `${CATEGORY_LABEL_JA[category as PlaceCategory]}${Math.round((ratio ?? 0) * 100)}%`)
    .join(' / ');
  const dominantGroup = resolveDominantGroup(profile);
  const dominantGroupLabel = dominantGroup.map((c) => CATEGORY_LABEL_JA[c]).join('・');
  const minDominantPercent = Math.round(profile.minDominantRatio * 100);
  const maxDominantPercent =
    profile.maxDominantRatio != null ? Math.round(profile.maxDominantRatio * 100) : null;
  const foodWeight = (profile.allocation.food ?? 0) + (profile.allocation.cafe ?? 0);

  const lines = [
    `【${profile.label}モード・最重要】ユーザーは「${profile.label}」を選んでいます。行程配分の目安は ${allocationLine} です。`,
    maxDominantPercent != null
      ? `- 全アイテムのうち${dominantGroupLabel}は${minDominantPercent}〜${maxDominantPercent}%に収めること（下限${minDominantPercent}%・上限${maxDominantPercent}%）。上限を超えて飲食ばかりにしないこと。`
      : `- 全アイテムのうち${minDominantPercent}%以上は具体的な店名・施設名を伴う ${dominantGroupLabel}（category=${dominantGroup.join('|')}）のアイテムにすること。`,
    `- 店名・施設名を伴わない抽象的な散策・移動だけの独立アイテム（例:「○○エリアを散策」「街歩き」）は旅行全体で最大${profile.maxAbstractWalkItems}件までにすること。可能な限り独立アイテムにせず、次の場所へ向かう移動としてnoteに一言含める程度にすること。`,
    '- 具体的な店名・施設名を伴わない曖昧な表現（ジャンル名だけの言い回し等）は禁止。必ず具体的なplaceNameを伴うアイテムにすること。',
  ];

  if (foodWeight >= 0.35) {
    lines.push(
      '- 食事ペース: 朝食・ランチ・ディナーは1日それぞれ最大1回。カフェ・スイーツは1日最大1〜2回。重い食事を短時間に連続させず、食事間隔は原則2.5〜3.5時間以上空けること。',
    );
  }

  lines.push(
    'Google Places候補リストが提供されている場合は、上記配分に合うカテゴリの候補を優先して選ぶこと。',
  );

  return lines.join('\n');
}
