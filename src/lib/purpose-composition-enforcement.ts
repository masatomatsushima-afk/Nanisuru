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
import { resolveDominantGroup, type PurposeProfile } from './purpose-profiles';
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
/** Prefer real placeName as the visible title — never destinationLabel + 「で〇〇を楽しむ」. */
const CATEGORY_ACTIVITY_TEMPLATE: Record<PlaceCategory, (name: string) => string> = {
  food: (name) => name,
  cafe: (name) => name,
  sightseeing: (name) => name,
  shopping: (name) => name,
  nightlife: (name) => name,
  activity: (name) => name,
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
  /** food+cafe etc. when counted via dominantGroup — same as dominantCategoryRatio for single-category profiles. */
  foodRatio: number;
  abstractWalkItemsRemoved: number;
  googlePlaceCount: number;
  fixesApplied: string[];
  /** Per selected purpose: how many matching items ended up in the plan. */
  finalItemCountByPurpose?: Record<string, number>;
  missingPurposeCoverageFixed?: boolean;
};

/** Canonical purpose id → categories that count as coverage for that purpose. */
export const PURPOSE_COVERAGE_CATEGORIES: Readonly<Record<string, readonly PlaceCategory[]>> = {
  gourmet: ['food', 'cafe'],
  shopping: ['shopping'],
  sightseeing: ['sightseeing'],
  nightlife: ['nightlife'],
  nature: ['activity', 'sightseeing'],
  ai: ['sightseeing', 'food', 'cafe', 'shopping'],
};

function countByCategories(
  days: readonly ItineraryDay[],
  categories: readonly PlaceCategory[] | null,
): { matched: number; total: number } {
  const categorySet = categories ? new Set(categories) : null;
  let matched = 0;
  let total = 0;
  for (const day of days) {
    for (const item of day.items) {
      if (item.activityCategory === '移動') continue;
      total += 1;
      if (categorySet && item.category && categorySet.has(item.category)) matched += 1;
    }
  }
  return { matched, total };
}

function buildNoopReport(
  days: readonly ItineraryDay[],
  profile: PurposeProfile | null,
  selectedMood: string,
): PurposeCompositionReport {
  const dominantGroup = profile ? resolveDominantGroup(profile) : null;
  const { matched, total } = countByCategories(days, dominantGroup);
  const ratio = total > 0 ? matched / total : 0;
  return {
    days: days as ItineraryDay[],
    purposeId: profile?.id ?? null,
    selectedMood,
    dominantCategory: profile?.dominantCategory ?? null,
    dominantCategoryItemCount: matched,
    totalItemCount: total,
    dominantCategoryRatio: ratio,
    foodRatio: ratio,
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
    selectedPurposes?: readonly { purpose: string; weight?: number }[] | null;
  },
): PurposeCompositionReport {
  const { profile } = options;
  if (!profile) return buildNoopReport(days, null, options.selectedMood);

  const fixesApplied: string[] = [];
  let abstractWalkItemsRemoved = 0;
  let googlePlaceCount = 0;
  let missingPurposeCoverageFixed = false;

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

    const dominantGroup = resolveDominantGroup(profile);
    const dominantGroupSet = new Set(dominantGroup);
    const isInDominantGroup = (item: ItineraryItem): boolean =>
      Boolean(item.category && dominantGroupSet.has(item.category));

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

    // Step 2: upgrade vague dominant-group items with a real candidate when one is available.
    nextDays = nextDays.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        if (!item.category || !dominantGroupSet.has(item.category)) return item;
        if (!isGenericCategoryItem(item, item.category) || isLogisticsItem(item)) return item;
        const candidate =
          takeNextCandidate(item.category) ?? takeNextCandidate(profile.dominantCategory);
        if (!candidate) return item;
        fixesApplied.push(`vague_dominant_item_upgraded: "${item.activity}" -> "${candidate.placeName}"`);
        return applyCandidateToItem(item, candidate);
      }),
    }));

    // Step 3: if the dominant-group ratio is still below target, upgrade remaining
    // non-dominant items with unused dominant-group candidates until the ratio is met.
    let { matched: dominantCount, total: totalCount } = countByCategories(nextDays, dominantGroup);
    if (totalCount > 0 && dominantCount / totalCount < profile.minDominantRatio) {
      outer: for (const day of nextDays) {
        for (let i = 0; i < day.items.length; i += 1) {
          if (dominantCount / totalCount >= profile.minDominantRatio) break outer;
          const item = day.items[i];
          if (isInDominantGroup(item) || isLogisticsItem(item)) continue;
          if (profile.dominantCategory !== 'activity' && isGenericCategoryItem(item, 'activity')) continue;
          const candidate = takeNextCandidate(profile.dominantCategory);
          if (!candidate) break outer;
          day.items[i] = applyCandidateToItem(item, candidate);
          dominantCount += 1;
          fixesApplied.push(`non_dominant_item_upgraded_for_ratio: "${item.activity}" -> "${candidate.placeName}"`);
        }
      }
    }

    // Step 4: if above maxDominantRatio, replace excess dominant-group items with unused
    // non-dominant candidates from the allocation (sightseeing/shopping/etc). Never invents names.
    if (profile.maxDominantRatio != null && totalCount > 0) {
      let { matched: currentDominant, total: currentTotal } = countByCategories(nextDays, dominantGroup);
      if (currentTotal > 0 && currentDominant / currentTotal > profile.maxDominantRatio) {
        const nonDominantCategories = (Object.keys(profile.allocation) as PlaceCategory[]).filter(
          (category) => !dominantGroupSet.has(category),
        );
        excess: for (const day of nextDays) {
          for (let i = day.items.length - 1; i >= 0; i -= 1) {
            if (currentDominant / currentTotal <= profile.maxDominantRatio) break excess;
            const item = day.items[i];
            if (!isInDominantGroup(item) || isLogisticsItem(item)) continue;
            let replacement: PlaceCandidate | null = null;
            for (const category of nonDominantCategories) {
              replacement = takeNextCandidate(category);
              if (replacement) break;
            }
            if (!replacement) break excess;
            day.items[i] = applyCandidateToItem(item, replacement);
            currentDominant -= 1;
            fixesApplied.push(
              `dominant_item_downgraded_for_max_ratio: "${item.activity}" -> "${replacement.placeName}"`,
            );
          }
        }
      }
    }

    const finalCounts = countByCategories(nextDays, dominantGroup);
    const finalRatio = finalCounts.total > 0 ? finalCounts.matched / finalCounts.total : 0;
    if (finalRatio < profile.minDominantRatio) {
      fixesApplied.push(
        `dominant_ratio_below_target_insufficient_candidates: ratio=${Math.round(finalRatio * 100)}%`,
      );
    }
    if (profile.maxDominantRatio != null && finalRatio > profile.maxDominantRatio) {
      fixesApplied.push(
        `dominant_ratio_above_max_insufficient_replacements: ratio=${Math.round(finalRatio * 100)}%`,
      );
    }

    // Step 5: purpose coverage — each selected purpose must have ≥1 matching item when candidates exist.
    const selected = options.selectedPurposes ?? [];
    if (selected.length >= 1) {
      for (const purpose of selected) {
        const categories = PURPOSE_COVERAGE_CATEGORIES[purpose.purpose];
        if (!categories?.length) continue;
        const { matched } = countByCategories(nextDays, categories);
        if (matched > 0) continue;

        let placed = false;
        outerPurpose: for (const category of categories) {
          const candidate = takeNextCandidate(category);
          if (!candidate) continue;
          for (const day of nextDays) {
            for (let i = 0; i < day.items.length; i += 1) {
              const item = day.items[i];
              if (isLogisticsItem(item) || item.activityCategory === '移動') continue;
              if (item.category && categories.includes(item.category)) continue;
              day.items[i] = applyCandidateToItem(item, candidate);
              fixesApplied.push(
                `missing_purpose_coverage_fixed: ${purpose.purpose} <- "${candidate.placeName}"`,
              );
              missingPurposeCoverageFixed = true;
              placed = true;
              break outerPurpose;
            }
          }
        }
        if (!placed) {
          fixesApplied.push(`missing_purpose_coverage_no_candidates: ${purpose.purpose}`);
        }
      }
    }

    const finalItemCountByPurpose: Record<string, number> = {};
    for (const purpose of selected) {
      const categories = PURPOSE_COVERAGE_CATEGORIES[purpose.purpose];
      finalItemCountByPurpose[purpose.purpose] = categories
        ? countByCategories(nextDays, categories).matched
        : 0;
    }

    if (process.env.NODE_ENV !== 'production' && selected.length > 0) {
      console.info('[Purpose]', {
        selectedPurposeWeights: selected.map((p) => ({
          purpose: p.purpose,
          weight: p.weight ?? null,
        })),
        finalItemCountByPurpose,
        missingPurposeCoverageFixed,
      });
    }

    const refreshedCounts = countByCategories(nextDays, dominantGroup);
    const refreshedRatio =
      refreshedCounts.total > 0 ? refreshedCounts.matched / refreshedCounts.total : 0;

    return {
      days: nextDays,
      purposeId: profile.id,
      selectedMood: options.selectedMood,
      dominantCategory: profile.dominantCategory,
      dominantCategoryItemCount: refreshedCounts.matched,
      totalItemCount: refreshedCounts.total,
      dominantCategoryRatio: refreshedRatio,
      foodRatio: refreshedRatio,
      abstractWalkItemsRemoved,
      googlePlaceCount,
      fixesApplied,
      finalItemCountByPurpose,
      missingPurposeCoverageFixed,
    };
  } catch (error) {
    console.warn('[enforcePurposeComposition] failed, keeping original days:', error);
    return buildNoopReport(days, profile, options.selectedMood);
  }
}
