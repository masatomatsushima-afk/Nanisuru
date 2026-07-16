/**
 * 目的（PurposeProfile）が解決されたとき、行程の中心が dominantCategory の具体的な
 * スポットになるよう強制する post-generation validation。
 *
 * `purpose-profiles.ts` の設定（allocation / dominantCategory / minDominantRatio /
 * maxAbstractWalkItems）だけを見て動く汎用エンジン — 目的ごとの分岐・専用ロジックは書かない。
 * 新しい目的を `purpose-profiles.ts` に追加しても、このファイルは変更不要。
 *
 * - profile が null（どの目的にも当たらない）のときは完全に no-op（既存の無指定挙動そのまま）。
 * - 店名を伴わない抽象的な散策・移動系の独立アイテムは旅行全体で最大 profile.maxAbstractWalkItems
 *   件まで（dominantCategory が 'activity' のときは、activityそのものが目的の中心なので
 *   この上限は適用しない）。2件目以降は前後アイテムの note（移動説明）に折り込んで削除する。
 * - dominantCategory の比率が minDominantRatio 未満の場合、未使用の Google Places 候補
 *   （dominantCategory に一致するもの）で他のアイテムを具体的な店舗に置き換える。候補が無ければ
 *   架空の店名は作らず、そのまま（比率不足）にする（= 明示的な「候補不足」。dev ログで可視化）。
 * - 置き換え後の activity 文言は、`spot-specificity.ts` の isAbstractItineraryItem が誤って
 *   抽象判定してplaceId/placeNameを剥奪しないよう、カテゴリ別の安全な言い回しのみを使う。
 */

import {
  enforceDestinationScopedQuery,
  normalizeDestination,
} from './destination-safety';
import type { PurposeProfile } from './purpose-profiles';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { PlaceCategory } from '@/lib/destination-safety';
import type { PlaceCandidate } from '@/types/place-candidate';

/** チェックイン・チェックアウト・移動などのロジスティクス項目は置換・折り込み対象から除外する。 */
const LOGISTICS_PATTERN = /到着|チェックイン|チェックアウト|出発|空港|駅|フライト/;

function isLogisticsItem(item: ItineraryItem): boolean {
  return LOGISTICS_PATTERN.test(item.activity ?? '');
}

/** 「category=X だが具体的な実在店舗ではない」= 構造化フィールドだけで判定する汎用チェック。 */
function isGenericCategoryItem(item: ItineraryItem, category: PlaceCategory): boolean {
  if (item.category !== category) return false;
  return item.isSpecificPlace === false || item.confidence === 'low' || !item.placeName?.trim();
}

// カテゴリ別の安全な言い回し。「で」+ジャンル名だけの言い回しは isAbstractItineraryItem
// (spot-specificity.ts) に抽象判定されてplaceId/placeNameを剥奪されるため、それを避ける表現のみ使う。
// travel-plan-dev-fallback.ts の Google Places フォールバックでも同じ制約を適用している。
const CATEGORY_ACTIVITY_TEMPLATE: Record<PlaceCategory, (name: string) => string> = {
  food: (name) => `${name}で人気のグルメを味わう`,
  cafe: (name) => `${name}でカフェ休憩を楽しむ`,
  sightseeing: (name) => `${name}を訪れる`,
  shopping: (name) => `${name}でお土産を探す`,
  nightlife: (name) => `${name}で夜を楽しむ`,
  activity: (name) => `${name}で体験を楽しむ`,
};

function buildCandidateActivity(candidate: PlaceCandidate): string {
  const template = CATEGORY_ACTIVITY_TEMPLATE[candidate.category ?? 'activity'];
  return template(candidate.placeName);
}

export type PurposeCompositionReport = {
  days: ItineraryDay[];
  purposeId: string | null;
  selectedMood: string;
  dominantCategory: PlaceCategory | null;
  dominantCategoryItemCount: number;
  totalItemCount: number;
  dominantCategoryRatio: number;
  abstractWalkItemsRemoved: number;
  googlePlaceCount: number;
  fixesApplied: string[];
};

function countByCategory(
  days: readonly ItineraryDay[],
  category: PlaceCategory | null,
): { matched: number; total: number } {
  let matched = 0;
  let total = 0;
  for (const day of days) {
    for (const item of day.items) {
      total += 1;
      if (category && item.category === category) matched += 1;
    }
  }
  return { matched, total };
}

function buildNoopReport(
  days: readonly ItineraryDay[],
  profile: PurposeProfile | null,
  selectedMood: string,
): PurposeCompositionReport {
  const dominantCategory = profile?.dominantCategory ?? null;
  const { matched, total } = countByCategory(days, dominantCategory);
  return {
    days: days as ItineraryDay[],
    purposeId: profile?.id ?? null,
    selectedMood,
    dominantCategory,
    dominantCategoryItemCount: matched,
    totalItemCount: total,
    dominantCategoryRatio: total > 0 ? matched / total : 0,
    abstractWalkItemsRemoved: 0,
    googlePlaceCount: 0,
    fixesApplied: [],
  };
}

/**
 * @param candidates Google Places候補（未使用分のみ置換に使う）。placeIdが既に他のitemで
 * 使われているものは自動的にスキップされる（重複禁止）。
 */
export function enforcePurposeComposition(
  days: readonly ItineraryDay[],
  options: {
    profile: PurposeProfile | null;
    selectedMood: string;
    candidates: readonly PlaceCandidate[];
    rawLocation: string | undefined | null;
  },
): PurposeCompositionReport {
  const { profile } = options;
  if (!profile) return buildNoopReport(days, null, options.selectedMood);

  const fixesApplied: string[] = [];
  let abstractWalkItemsRemoved = 0;
  let googlePlaceCount = 0;

  try {
    const normalized = normalizeDestination(options.rawLocation);
    const usedPlaceIds = new Set<string>();
    for (const day of days) {
      for (const item of day.items) {
        if (item.placeId) usedPlaceIds.add(item.placeId);
      }
    }

    const allocationCategories = new Set(Object.keys(profile.allocation) as PlaceCategory[]);
    const unusedCandidatesByCategory = new Map<PlaceCategory, PlaceCandidate[]>();
    for (const candidate of options.candidates) {
      if (usedPlaceIds.has(candidate.placeId)) continue;
      const category = candidate.category;
      if (!category || !allocationCategories.has(category)) continue;
      const bucket = unusedCandidatesByCategory.get(category) ?? [];
      bucket.push(candidate);
      unusedCandidatesByCategory.set(category, bucket);
    }
    const cursorByCategory = new Map<PlaceCategory, number>();
    const takeNextCandidate = (category: PlaceCategory): PlaceCandidate | null => {
      const bucket = unusedCandidatesByCategory.get(category);
      if (!bucket) return null;
      let cursor = cursorByCategory.get(category) ?? 0;
      while (cursor < bucket.length) {
        const candidate = bucket[cursor];
        cursor += 1;
        if (!usedPlaceIds.has(candidate.placeId)) {
          cursorByCategory.set(category, cursor);
          return candidate;
        }
      }
      cursorByCategory.set(category, cursor);
      return null;
    };
    const applyCandidateToItem = (item: ItineraryItem, candidate: PlaceCandidate): ItineraryItem => {
      usedPlaceIds.add(candidate.placeId);
      googlePlaceCount += 1;
      const mapsQuery = enforceDestinationScopedQuery(candidate.placeName, normalized);
      return {
        ...item,
        activity: buildCandidateActivity(candidate),
        placeName: candidate.placeName,
        category: candidate.category ?? profile.dominantCategory,
        isSpecificPlace: true,
        confidence: 'high',
        source: 'google_places',
        placeId: candidate.placeId,
        rating: candidate.rating ?? null,
        reviewCount: candidate.reviewCount ?? null,
        priceLevel: candidate.priceLevel ?? null,
        mapsQuery,
        socialQuery: mapsQuery,
      };
    };

    // Step 1: independent, abstract "activity" filler items (店名を伴わない散策・移動)
    // are capped at maxAbstractWalkItems for the whole trip — extras are folded into an
    // adjacent item's note. Skipped entirely when 'activity' IS the dominant category
    // (e.g. 子連れ/自然), since in that case those items are the point of the trip, not filler.
    let nextDays: ItineraryDay[] = days.map((day) => ({ ...day, items: [...day.items] }));
    if (profile.dominantCategory !== 'activity') {
      let abstractItemsKept = 0;
      nextDays = nextDays.map((day) => {
        const items = [...day.items];
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          if (!isGenericCategoryItem(item, 'activity') || isLogisticsItem(item)) continue;

          abstractItemsKept += 1;
          if (abstractItemsKept <= profile.maxAbstractWalkItems) continue;

          const noteAddition = `${item.activity}してから次へ移動`;
          const targetIndex = i > 0 ? i - 1 : i + 1 < items.length ? i + 1 : -1;
          if (targetIndex >= 0) {
            const target = items[targetIndex];
            items[targetIndex] = {
              ...target,
              note: target.note?.trim() ? `${target.note} / ${noteAddition}` : noteAddition,
            };
          }
          items.splice(i, 1);
          i -= 1;
          abstractWalkItemsRemoved += 1;
          fixesApplied.push(`abstract_walk_folded_into_note: "${item.activity}"`);
        }
        return { ...day, items };
      });
    }

    // Step 2: upgrade vague dominant-category items (structurally generic — no real venue
    // attached) with a real candidate when one is available.
    nextDays = nextDays.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        if (!isGenericCategoryItem(item, profile.dominantCategory) || isLogisticsItem(item)) return item;
        const candidate = takeNextCandidate(profile.dominantCategory);
        if (!candidate) return item;
        fixesApplied.push(`vague_dominant_item_upgraded: "${item.activity}" -> "${candidate.placeName}"`);
        return applyCandidateToItem(item, candidate);
      }),
    }));

    // Step 3: if the dominant-category ratio is still below target, upgrade remaining
    // non-dominant, non-logistics, non-reserved-walk-budget items (in order) with unused
    // candidates until the ratio is met or candidates run out. Never invents a store — if
    // candidates are exhausted, the shortfall is left as-is and reported via
    // dominantCategoryRatio/fixesApplied (explicit "insufficient candidates", not a fake name).
    let { matched: dominantCount, total: totalCount } = countByCategory(nextDays, profile.dominantCategory);
    if (totalCount > 0 && dominantCount / totalCount < profile.minDominantRatio) {
      outer: for (const day of nextDays) {
        for (let i = 0; i < day.items.length; i += 1) {
          if (dominantCount / totalCount >= profile.minDominantRatio) break outer;
          const item = day.items[i];
          if (item.category === profile.dominantCategory || isLogisticsItem(item)) continue;
          // Leave the intentionally-kept "walk budget" item(s) alone (Step 1 already capped them).
          if (profile.dominantCategory !== 'activity' && isGenericCategoryItem(item, 'activity')) continue;
          const candidate = takeNextCandidate(profile.dominantCategory);
          if (!candidate) break outer;
          day.items[i] = applyCandidateToItem(item, candidate);
          dominantCount += 1;
          fixesApplied.push(`non_dominant_item_upgraded_for_ratio: "${item.activity}" -> "${candidate.placeName}"`);
        }
      }
    }

    const finalCounts = countByCategory(nextDays, profile.dominantCategory);
    const finalRatio = finalCounts.total > 0 ? finalCounts.matched / finalCounts.total : 0;
    if (finalRatio < profile.minDominantRatio) {
      fixesApplied.push(
        `dominant_ratio_below_target_insufficient_candidates: ratio=${Math.round(finalRatio * 100)}%`,
      );
    }

    return {
      days: nextDays,
      purposeId: profile.id,
      selectedMood: options.selectedMood,
      dominantCategory: profile.dominantCategory,
      dominantCategoryItemCount: finalCounts.matched,
      totalItemCount: finalCounts.total,
      dominantCategoryRatio: finalRatio,
      abstractWalkItemsRemoved,
      googlePlaceCount,
      fixesApplied,
    };
  } catch (error) {
    console.warn('[enforcePurposeComposition] failed, keeping original days:', error);
    return buildNoopReport(days, profile, options.selectedMood);
  }
}
