import type { PlanInput } from './prompts';
import { flattenItineraryDays, resolveDurationConfig } from './trip-duration';
import { getCurrency } from '@/constants/currency';
import { generateOutfitPackingAdvice } from './outfit-packing-advice';
import { normalizeAccommodationFields } from './accommodation-input';
import {
  destinationDetailsToPayload,
  normalizeDestinationFromDetails,
  resolveDestinationDetailsFromPlanInput,
} from './destination-detail-input';
import { DEV_FALLBACK_PLAN_NOTICE } from './openai-dev-fallback';
import { formatBudgetAmount, formatBudgetDisplay } from './format-budget';
import {
  buildDestinationMapsSuffix,
  buildSafeAreaMapsQuery,
  categoryForGenericKind,
  genericAreaPhrase,
  genericMapsQuery,
  getSafeAreasForDestinationByCategory,
  type GenericAreaPhraseKind,
  type NormalizedDestination,
  type PlaceCategory,
  type PopularityType,
  type SafeArea,
} from './destination-safety';
import {
  formatMinutesAsTime,
  getEarliestActivityStartMinutes,
  getLatestActivityEndMinutes,
} from './itinerary-quality';
import {
  DEFAULT_DAY_WINDOW_END_MINUTES,
  DEFAULT_DAY_WINDOW_START_MINUTES,
  resolveTargetItemCountForDay,
} from './day-availability';
import { resolvePurposeProfileWithSelection, type PurposeProfile } from './purpose-profiles';
import type { TravelTimingSettings } from '@/types/travel-timing';
import {
  buildSeoulSeedMapsQuery,
  isSeoulDestination,
  pickSeoulSeedForKind,
  seoulSeedToCandidate,
} from './seoul-spot-seeds';
import { enforceSpecificityOnDays } from './spot-specificity';
import { validateAndFixItinerarySchedule } from './itinerary-schedule-validation';
import { enforcePurposeComposition } from './purpose-composition-enforcement';
import {
  resolveTripAudience,
  sanitizeItineraryTripCopy,
  sanitizePlanDetailsTripCopy,
} from './trip-type-copy';
import type { BudgetBreakdown, ItineraryDay, ItineraryItem } from '@/types/plan';
import type { SpotCandidate } from '@/types/spot-candidate';
import type { PlaceCandidate } from '@/types/place-candidate';

export { DEV_FALLBACK_PLAN_NOTICE };

/** Small notice shown directly on the Plan Detail screen when isFallback is true. */
export const PLAN_DETAIL_FALLBACK_NOTICE =
  'AI接続が不安定だったため、開発用プランを表示しています';

/** Shown when the AI response mixed in out-of-destination spots and was replaced with a safe plan. */
export const DESTINATION_SAFETY_FALLBACK_NOTICE =
  '目的地外のスポットが検出されたため、安全なテスト用プランを表示しています';

/**
 * Shown when OpenAI timed out/failed but Google Places candidates were already fetched
 * successfully — the resulting plan uses real, Google-confirmed places (not the seed/generic
 * dev fallback), so the notice must not say "テスト用" / "サンプル".
 */
export const GOOGLE_PLACES_FALLBACK_NOTICE =
  'AIの応答に時間がかかったため、Google Places候補から自動でプランを作成しました';

type SpotTemplate = {
  activity: string;
  category: ItineraryItem['activityCategory'];
  note: string;
  costShare: number;
  mapsQuery: string;
  isSpecificPlace: boolean;
  placeName?: string;
  placeType: PlaceCategory;
  popularityType: PopularityType;
  confidence: 'high' | 'medium' | 'low';
  source?: ItineraryItem['source'];
  /** Google Places candidate only — null/undefined for seed or generic-area spots. */
  placeId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  /** Per-spot reason override. Falls back to the shared "テスト用" wording when absent, so the
   * existing seed-based fallback (`buildDevFallbackTravelPlan`) is unaffected. */
  reason?: string;
};

type DayTemplate = {
  theme: string;
  spots: SpotTemplate[];
};

const DAY_SPACING_MINUTES = 150;
const DEFAULT_DAY_START_MINUTES = 10 * 60; // 10:00
const DEFAULT_LAST_ITEM_END_BUFFER_MINUTES = 60;

function buildFallbackItem(params: {
  timeMinutes: number;
  activity: string;
  category: ItineraryItem['activityCategory'];
  reason: string;
  estimatedCost: string;
  note: string;
  mapsQuery: string;
  isSpecificPlace: boolean;
  placeName?: string;
  placeType: PlaceCategory;
  popularityType: PopularityType;
  confidence: 'high' | 'medium' | 'low';
  source?: ItineraryItem['source'];
  spotCandidates?: SpotCandidate[];
  /** Google Places candidate only — always null for seed/generic-area spots. */
  placeId?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}): ItineraryItem {
  return {
    time: formatMinutesAsTime(params.timeMinutes),
    activity: params.activity,
    activityCategory: params.category,
    placeCategory: params.category,
    reason: params.reason,
    estimatedCost: params.estimatedCost,
    note: params.note,
    transportation: '—',
    travelTimeToNext: '—',
    weatherBackup: '天候に関わらず楽しめます',
    mapsQuery: params.mapsQuery,
    socialQuery: params.mapsQuery,
    isSpecificPlace: params.isSpecificPlace,
    placeName: params.placeName,
    category: params.placeType,
    popularityType: params.popularityType,
    confidence: params.confidence,
    source: params.source,
    spotCandidates: params.spotCandidates,
    placeId: params.placeId ?? null,
    rating: params.rating ?? null,
    reviewCount: params.reviewCount ?? null,
    priceLevel: null,
  };
}

/**
 * Resolves a single spot from either a curated safe area (specific, real place) or a generic,
 * destination-scoped phrase (no curated data available). Every branch guarantees the resulting
 * mapsQuery is scoped to the destination, so map links can never resolve near the device's
 * current location instead of the actual travel destination.
 */
function resolveSeoulSeedSpot(
  normalized: NormalizedDestination,
  kind: GenericAreaPhraseKind,
  cursor: number,
): ReturnType<typeof resolveSpot> | null {
  const seed = pickSeoulSeedForKind(kind, cursor);
  if (!seed) return null;
  const mapsQuery = buildSeoulSeedMapsQuery(seed, normalized);
  return {
    activity: seed.activity,
    mapsQuery,
    isSpecificPlace: true,
    placeName: seed.placeName,
    placeType: seed.category,
    popularityType: seed.popularityType,
    confidence: 'high',
  };
}

function resolveSpot(
  area: SafeArea | null,
  normalized: NormalizedDestination,
  kind: GenericAreaPhraseKind,
  labelToActivity: (areaLabel: string) => string,
): {
  activity: string;
  mapsQuery: string;
  isSpecificPlace: boolean;
  placeName?: string;
  placeType: PlaceCategory;
  popularityType: PopularityType;
  confidence: 'high' | 'medium' | 'low';
  source?: ItineraryItem['source'];
} {
  if (area) {
    return {
      activity: labelToActivity(area.label),
      mapsQuery: buildSafeAreaMapsQuery(area, normalized),
      isSpecificPlace: true,
      placeName: area.label,
      placeType: area.category,
      popularityType: area.popularityType,
      confidence: 'high',
      source: 'seed',
    };
  }
  return {
    activity: genericAreaPhrase(normalized.destinationLabel, kind),
    mapsQuery: genericMapsQuery(normalized, kind),
    isSpecificPlace: false,
    placeType: categoryForGenericKind(kind),
    popularityType: 'fallback',
    confidence: 'low',
    source: 'fallback',
  };
}

/**
 * Builds day templates for ANY destination worldwide. When a curated safe area list exists for
 * the destination (see destination-safety.ts — a small, optional quality-boost registry), real
 * neighborhood names are used, matched to a category that fits the slot (e.g. only `food` areas
 * for a lunch/dinner spot) so a landmark never gets labeled "でローカルグルメ". Otherwise a safe,
 * destination-label-based generic phrasing is used (e.g. "{destinationLabel}中心部を散策") so the
 * plan never invents or borrows spots from an unrelated fixed city list.
 */
function buildDefaultDayTemplates(
  location: string,
  normalized: NormalizedDestination,
  purpose: string,
  dayCount: number,
  hub?: { baseArea?: string; arrivalPoint?: string; accommodation?: string },
): DayTemplate[] {
  const areaCursorByCategory = new Map<PlaceCategory, number>();
  let seoulSeedCursor = 0;
  const nextArea = (kind: GenericAreaPhraseKind): SafeArea | null => {
    const category = categoryForGenericKind(kind);
    const areasForKind = getSafeAreasForDestinationByCategory(normalized, category);
    if (areasForKind.length === 0) return null;
    const cursor = areaCursorByCategory.get(category) ?? 0;
    areaCursorByCategory.set(category, cursor + 1);
    return areasForKind[cursor % areasForKind.length];
  };
  const spot = (
    kind: GenericAreaPhraseKind,
    labelToActivity: (areaLabel: string) => string,
  ) => {
    if (isSeoulDestination(normalized)) {
      const seoulSpot = resolveSeoulSeedSpot(normalized, kind, seoulSeedCursor);
      seoulSeedCursor += 1;
      if (seoulSpot) return seoulSpot;
    }
    return resolveSpot(nextArea(kind), normalized, kind, labelToActivity);
  };

  const transitMapsQuery = buildDestinationMapsSuffix(normalized);
  const transitSpot = {
    mapsQuery: transitMapsQuery,
    isSpecificPlace: false,
    placeType: 'activity' as PlaceCategory,
    popularityType: 'fallback' as PopularityType,
    confidence: 'low' as const,
  };

  const hubLabel = hub?.baseArea || hub?.accommodation || normalized.destinationLabel || location;

  const buildArrival = (): DayTemplate => {
    const lunch = spot('lunch', (area) => `${area}で名物料理ランチ`);
    const stroll = spot('stroll', (area) =>
      hub?.baseArea ? `${hub.baseArea}周辺を散策` : `${area}周辺を散策`,
    );
    const dinner = spot('dinner', (area) =>
      hub?.baseArea ? `${hub.baseArea}でディナー` : `${area}でディナー`,
    );
    const arrivalActivity = hub?.arrivalPoint
      ? `${hub.arrivalPoint}到着・${hubLabel}へ移動`
      : `${location}到着・チェックイン`;
    return {
      theme: hub?.baseArea ? `到着・${hub.baseArea}周辺` : `到着・${purpose}`,
      spots: [
        { category: '移動', note: '到着後の移動・荷物整理', costShare: 0, activity: arrivalActivity, ...transitSpot },
        { category: '食事', note: '', costShare: 0.15, ...lunch },
        { category: '散歩', note: '', costShare: 0.05, ...stroll },
        { category: '食事', note: '', costShare: 0.15, ...dinner },
      ],
    };
  };
  const buildMiddle = (): DayTemplate => {
    const cafe = spot('cafe', (area) => `${area}のカフェで休憩`);
    const food = spot('market', (area) => `${area}でローカルグルメ`);
    const culture = spot('culture', (area) => `${area}を観光`);
    const night = spot('night', (area) => `${area}で夜景を楽しむ`);
    return {
      theme: 'カフェ・ローカルグルメ・夜景',
      spots: [
        { category: 'カフェ', note: '', costShare: 0.05, ...cafe },
        { category: '食事', note: '', costShare: 0.15, ...food },
        { category: '文化', note: '', costShare: 0.1, ...culture },
        { category: '夜景', note: '', costShare: 0.05, ...night },
      ],
    };
  };
  const buildLast = (): DayTemplate => {
    const shopping = spot('shopping', (area) => `${area}でお土産・ショッピング`);
    const lunch = spot('lunch', (area) => `${area}で軽めランチ`);
    return {
      theme: 'お土産・軽めランチ・帰宅',
      spots: [
        { category: '買い物', note: '', costShare: 0.1, ...shopping },
        { category: '食事', note: '', costShare: 0.1, ...lunch },
        { category: '移動', note: '出発時刻に合わせて移動', costShare: 0, activity: 'ホテルチェックアウト・移動', ...transitSpot },
      ],
    };
  };

  if (dayCount <= 1) {
    const arrival = buildArrival();
    return [{ ...arrival, spots: arrival.spots.slice(0, 3) }];
  }
  if (dayCount === 2) return [buildArrival(), buildLast()];

  const middles = Array.from({ length: dayCount - 2 }, () => buildMiddle());
  return [buildArrival(), ...middles, buildLast()];
}

/**
 * Same day/slot shape as `buildDefaultDayTemplates`, but spots are filled from real Google
 * Places candidates (already ranked, already deduplicated) instead of the curated safe-area /
 * Seoul-seed lists. Each candidate is used at most once across the whole trip (removed from the
 * pool once assigned). If the pool runs out before all slots are filled, remaining slots fall
 * back to the same generic, destination-scoped phrasing used elsewhere (never an invented name).
 *
 * Day sizing is driven by `resolveTargetItemCountForDay` (arrival/departure available minutes) —
 * never the old hard-coded buildLast of 2 spots that collapsed evening-departure day 3 to one
 * 17:00 item. Category mix follows PurposeProfile.allocation when available (config-driven —
 * no gourmet-specific ifs). Independent stroll/walk cards are never emitted.
 */
function buildGooglePlacesDayTemplates(
  candidatesInput: readonly PlaceCandidate[],
  normalized: NormalizedDestination,
  purpose: string,
  companion: string,
  dayCount: number,
  hub?: { baseArea?: string; arrivalPoint?: string; accommodation?: string },
  travelTiming?: TravelTimingSettings | null,
  purposeProfile?: PurposeProfile | null,
): DayTemplate[] {
  const pool: PlaceCandidate[] = [...candidatesInput];

  const takeCandidateForCategory = (category: PlaceCategory): PlaceCandidate | null => {
    const idx = pool.findIndex((candidate) => candidate.category === category);
    if (idx >= 0) return pool.splice(idx, 1)[0];
    return pool.length > 0 ? pool.splice(0, 1)[0] : null;
  };

  const googleReason = (placeName: string) =>
    `${companion}との${purpose}に合うGoogle Places実在候補「${placeName}」です。`;
  const fallbackReason = '該当するGoogle Places候補が無かったため、エリア案内に切り替えています。';

  const PLACE_CATEGORY_TO_KIND: Record<PlaceCategory, GenericAreaPhraseKind> = {
    food: 'market',
    cafe: 'cafe',
    sightseeing: 'culture',
    shopping: 'shopping',
    nightlife: 'night',
    activity: 'culture',
  };
  const PLACE_CATEGORY_TO_ACTIVITY_CATEGORY: Record<PlaceCategory, string> = {
    food: '食事',
    cafe: 'カフェ',
    sightseeing: '文化',
    shopping: '買い物',
    nightlife: '夜景',
    activity: '体験',
  };
  const CATEGORY_ACTIVITY: Record<PlaceCategory, (name: string) => string> = {
    food: (name) => `${name}で人気のグルメを味わう`,
    cafe: (name) => `${name}でカフェ休憩を楽しむ`,
    sightseeing: (name) => `${name}を訪れる`,
    shopping: (name) => `${name}でお土産を探す`,
    nightlife: (name) => `${name}で夜を楽しむ`,
    activity: (name) => `${name}で体験を楽しむ`,
  };

  const allocationEntries = purposeProfile
    ? (Object.entries(purposeProfile.allocation) as Array<[PlaceCategory, number]>)
        .filter(([, weight]) => (weight ?? 0) > 0)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    : ([
        ['food', 0.35],
        ['sightseeing', 0.3],
        ['cafe', 0.2],
        ['shopping', 0.15],
      ] as Array<[PlaceCategory, number]>);

  /** Round-robin categories by allocation weight — no independent stroll/walk cards. */
  const pickCategoriesForCount = (count: number): PlaceCategory[] => {
    if (count <= 0) return [];
    const picked: PlaceCategory[] = [];
    const counters = new Map<PlaceCategory, number>();
    for (let i = 0; i < count; i += 1) {
      let best: PlaceCategory | null = null;
      let bestScore = -Infinity;
      for (const [category, weight] of allocationEntries) {
        const used = counters.get(category) ?? 0;
        const score = (weight ?? 0) / (used + 1);
        if (score > bestScore) {
          bestScore = score;
          best = category;
        }
      }
      if (!best) break;
      // Soft daily food/cafe caps so fallback stays edible even when allocation favors food.
      const foodSoFar = picked.filter((c) => c === 'food').length;
      const cafeSoFar = picked.filter((c) => c === 'cafe').length;
      if (best === 'food' && foodSoFar >= 2) {
        best = allocationEntries.find(([c]) => c !== 'food' && c !== 'cafe')?.[0] ?? 'sightseeing';
      } else if (best === 'cafe' && cafeSoFar >= 2) {
        best = allocationEntries.find(([c]) => c !== 'cafe')?.[0] ?? 'sightseeing';
      }
      counters.set(best, (counters.get(best) ?? 0) + 1);
      picked.push(best);
    }
    return picked;
  };

  const spotFromCategory = (category: PlaceCategory): SpotTemplate => {
    const kind = PLACE_CATEGORY_TO_KIND[category];
    const candidate = takeCandidateForCategory(category);
    if (candidate) {
      const mapsQuery = `${candidate.placeName} ${normalized.destinationLabel}`.trim();
      const resolvedCategory = candidate.category ?? category;
      return {
        activity: CATEGORY_ACTIVITY[resolvedCategory](candidate.placeName),
        category: PLACE_CATEGORY_TO_ACTIVITY_CATEGORY[resolvedCategory],
        note: '',
        costShare: resolvedCategory === 'food' ? 0.15 : 0.08,
        mapsQuery,
        isSpecificPlace: true,
        placeName: candidate.placeName,
        placeType: resolvedCategory,
        popularityType: candidate.rating != null && candidate.rating >= 4.3 ? 'popular' : 'classic',
        confidence: 'high',
        source: 'google_places',
        placeId: candidate.placeId,
        rating: candidate.rating ?? null,
        reviewCount: candidate.reviewCount ?? null,
        reason: googleReason(candidate.placeName),
      };
    }

    return {
      activity: genericAreaPhrase(normalized.destinationLabel, kind),
      category: PLACE_CATEGORY_TO_ACTIVITY_CATEGORY[category],
      note: '',
      costShare: 0.05,
      mapsQuery: genericMapsQuery(normalized, kind),
      isSpecificPlace: false,
      placeType: category,
      popularityType: 'fallback',
      confidence: 'low',
      source: 'fallback',
      placeId: null,
      rating: null,
      reviewCount: null,
      reason: fallbackReason,
    };
  };

  const transitMapsQuery = buildDestinationMapsSuffix(normalized);
  const transitSpot: SpotTemplate = {
    activity: 'ホテルチェックアウト・移動',
    category: '移動',
    note: '出発時刻に合わせて移動',
    costShare: 0,
    mapsQuery: transitMapsQuery,
    isSpecificPlace: false,
    placeType: 'activity',
    popularityType: 'fallback',
    confidence: 'low',
    reason: '移動・ロジスティクスのため候補選定の対象外です。',
  };

  const hubLabel = hub?.baseArea || hub?.accommodation || normalized.destinationLabel;
  const location = normalized.destinationLabel;

  const templates: DayTemplate[] = [];
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const isFirstDay = dayIndex === 0;
    const isLastDay = dayIndex === dayCount - 1;
    const { targetItemCount } = resolveTargetItemCountForDay({
      dayIndex,
      totalDays: dayCount,
      travelTiming,
    });

    const spots: SpotTemplate[] = [];

    if (isFirstDay) {
      const arrivalActivity = hub?.arrivalPoint
        ? `${hub.arrivalPoint}到着・${hubLabel}へ移動`
        : `${location}到着・チェックイン`;
      spots.push({
        ...transitSpot,
        activity: arrivalActivity,
        note: '到着後の移動・荷物整理',
      });
    }

    // target 0 (e.g. midday airport departure) → transit/checkout only, no cram.
    const activityCount = Math.max(0, targetItemCount);
    const categories = pickCategoriesForCount(activityCount);
    for (const category of categories) {
      spots.push(spotFromCategory(category));
    }

    if (isLastDay) {
      spots.push({ ...transitSpot });
    }

    const theme = isFirstDay
      ? hub?.baseArea
        ? `到着・${hub.baseArea}周辺`
        : `到着・${purpose}`
      : isLastDay
        ? activityCount <= 1
          ? '出発・移動'
          : 'お土産・軽めの予定・帰宅'
        : purposeProfile?.label
          ? `${purposeProfile.label}・観光`
          : 'カフェ・グルメ・観光';

    templates.push({ theme, spots });
  }

  return templates;
}

/** Evenly spaced start times for a day, honoring an optional earliest/latest bound. */
function buildDaySlotMinutes(params: {
  spotCount: number;
  isFirstDay: boolean;
  isLastDay: boolean;
  earliestStartMinutes: number | null;
  latestEndMinutes: number | null;
}): number[] {
  const { spotCount, isFirstDay, isLastDay, earliestStartMinutes, latestEndMinutes } = params;
  if (spotCount <= 0) return [];

  const windowStart =
    isFirstDay && earliestStartMinutes != null
      ? Math.max(DEFAULT_DAY_WINDOW_START_MINUTES, earliestStartMinutes)
      : DEFAULT_DAY_START_MINUTES;
  const windowEnd =
    isLastDay && latestEndMinutes != null
      ? Math.min(DEFAULT_DAY_WINDOW_END_MINUTES, latestEndMinutes - DEFAULT_LAST_ITEM_END_BUFFER_MINUTES)
      : DEFAULT_DAY_WINDOW_END_MINUTES;

  const available = Math.max(0, windowEnd - windowStart);

  // Short last-day window: pack toward the end so the final activity finishes before departure.
  // Long window (typical evening departure): schedule forward from morning so the day is filled
  // — the old end-packing path always landed the last slot at ~17:00 and caused the "1 item at
  // 17:00" collapse when combined with the hard max-2 final-day validator.
  if (isLastDay && latestEndMinutes != null && available < 5 * 60 && spotCount <= 2) {
    const lastItemStart = Math.max(windowStart, windowEnd);
    const firstItemStart = Math.max(windowStart, lastItemStart - (spotCount - 1) * DAY_SPACING_MINUTES);
    return Array.from({ length: spotCount }, (_, i) =>
      Math.min(lastItemStart, firstItemStart + i * DAY_SPACING_MINUTES),
    );
  }

  const spacing =
    spotCount <= 1
      ? 0
      : Math.max(
          DAY_SPACING_MINUTES,
          Math.floor(Math.max(available, DAY_SPACING_MINUTES) / Math.max(1, spotCount - 1)),
        );
  return Array.from({ length: spotCount }, (_, i) => {
    const raw = windowStart + i * spacing;
    return Math.min(raw, Math.max(windowStart, windowEnd));
  });
}

function buildBudgetBreakdown(
  budgetAmount: number,
  symbol: string,
  dayCount: number,
): BudgetBreakdown {
  const base = budgetAmount > 0 ? budgetAmount : 100000;
  const accommodationShare = dayCount > 1 ? Math.round(base * 0.35) : 0;
  const foodShare = Math.round(base * 0.3);
  const transportShare = Math.round(base * 0.15);
  const activityShare = Math.round(base * 0.2);
  const total = accommodationShare + foodShare + transportShare + activityShare;

  return {
    total: `${symbol}${total.toLocaleString()}（目安）`,
    accommodation: dayCount > 1 ? `${symbol}${accommodationShare.toLocaleString()}` : `${symbol}0（不要）`,
    food: `${symbol}${foodShare.toLocaleString()}`,
    transportation: `${symbol}${transportShare.toLocaleString()}`,
    activity: `${symbol}${activityShare.toLocaleString()}`,
  };
}

/** Safe sample plan for dev when OpenAI times out after retries. */
export function buildDevFallbackTravelPlan(input: PlanInput) {
  const destinationDetails = resolveDestinationDetailsFromPlanInput(input);
  const location = destinationDetails.effectiveLocation.trim() || input.location.trim() || '目的地';
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const { symbol } = getCurrency(input.currency);
  const people = input.people.trim() || '2';
  const companion = input.companion;
  const purpose =
    input.travelPurpose?.trim() ||
    input.customPreferences?.customTravelIntent?.trim() ||
    input.mood?.trim() ||
    'グルメ';
  const durationLabel = input.durationLabel ?? durationConfig.label;

  const normalizedDestination = normalizeDestinationFromDetails(destinationDetails);
  const destinationLabel = normalizedDestination.destinationLabel || location;
  const title = `${destinationLabel}${durationLabel}${purpose}旅行`;

  const dayCount = Math.max(1, durationConfig.dayCount);
  const accommodationFields = normalizeAccommodationFields(
    input.accommodation ?? input.accommodationArea ?? input.accommodationName,
  );
  const templates = buildDefaultDayTemplates(location, normalizedDestination, purpose, dayCount, {
    baseArea: destinationDetails.baseArea,
    arrivalPoint: destinationDetails.arrivalPoint,
    accommodation: accommodationFields.accommodation,
  });
  const timing = input.travelTiming;
  const earliestStartMinutes = getEarliestActivityStartMinutes(timing);
  const latestEndMinutes = getLatestActivityEndMinutes(timing);

  const budgetAmount = formatBudgetAmount(input.budget);
  const budgetDisplay = formatBudgetDisplay(budgetAmount, input.currency);

  const scheduled = validateAndFixItinerarySchedule({
    days: enforceSpecificityOnDays(
      templates.map((template, index) => {
    const dayNumber = index + 1;
    const isFirstDay = index === 0;
    const isLastDay = index === templates.length - 1;
    const slots = buildDaySlotMinutes({
      spotCount: template.spots.length,
      isFirstDay,
      isLastDay,
      earliestStartMinutes,
      latestEndMinutes,
    });

    const items = template.spots.map((spot, spotIndex) => {
      let timeMinutes = slots[spotIndex];
      if (
        spot.placeType === 'nightlife' ||
        spot.category === '夜景' ||
        /夜景|night/i.test(spot.activity)
      ) {
        timeMinutes = Math.max(timeMinutes, 19 * 60 + 30);
      }
      // Only clamp last-day overruns — do not pull every slot to cutoff-90.
      if (isLastDay && latestEndMinutes != null && timeMinutes > latestEndMinutes - 30) {
        timeMinutes = Math.max(
          slots[0] ?? DEFAULT_DAY_START_MINUTES,
          latestEndMinutes - DEFAULT_LAST_ITEM_END_BUFFER_MINUTES,
        );
      }

      return buildFallbackItem({
        timeMinutes,
        activity: spot.activity,
        category: spot.category,
        reason:
          spot.reason ??
          `${companion}との${purpose}に合うテスト用スポット（${location}）。UI確認用のサンプルです。`,
        estimatedCost:
          spot.costShare > 0
            ? `${symbol}${Math.round(budgetAmount * spot.costShare || 10000).toLocaleString()}`
            : `${symbol}0`,
        note: spot.note,
        mapsQuery: spot.mapsQuery,
        isSpecificPlace: spot.isSpecificPlace,
        placeName: spot.placeName,
        placeType: spot.placeType,
        popularityType: spot.popularityType,
        confidence: spot.confidence,
        placeId: spot.placeId,
        rating: spot.rating,
        reviewCount: spot.reviewCount,
      });
    });

    const timeWindow = `${formatMinutesAsTime(slots[0])}〜${formatMinutesAsTime(
      slots[slots.length - 1] + 60,
    )}`;

    return {
      dayNumber,
      label: `${dayNumber}日目`,
      theme: template.theme,
      timeWindow,
      items,
    };
  }),
      location,
    ),
    rawLocation: location,
    travelTiming: timing,
    destinationDetails,
  });
  const tripAudience = resolveTripAudience({
    companion: input.companion,
    planCreationType: input.planCreationType ?? input.planType,
  });
  const tripCopy = sanitizeItineraryTripCopy(scheduled.days, tripAudience);
  const days: ItineraryDay[] = tripCopy.days;

  const budgetBreakdown = buildBudgetBreakdown(budgetAmount, symbol, dayCount);
  const weatherOrSeasonNote =
    input.weather?.summary?.trim() ||
    input.weather?.seasonalContext?.guidance ||
    `${destinationLabel}の季節に合わせ、屋内・屋外をバランスよく組んでいます（テスト用）。`;

  const outfitAdvice = generateOutfitPackingAdvice({
    days,
    weather: input.weather,
    location,
    planType: input.planCreationType ?? input.planType,
    companion: input.companion,
    outfitStyleMode: input.outfitStyleMode,
    dayCount,
    tripDate: input.tripDate,
  });

  const summary = `${destinationLabel}${durationLabel}の${purpose}旅行プランです（${companion}・${people}人・予算${budgetDisplay}目安）。`;

  const tips = [
    `${destinationLabel}では移動カードを事前準備すると便利です`,
    '人気店は事前予約または早めの時間帯がおすすめ',
    'テスト用プランのため、本番AI応答後は自動的に置き換わります',
  ];

  const destinationPayload = destinationDetailsToPayload(destinationDetails);

  const { details } = sanitizePlanDetailsTripCopy(
    {
      plannerMessage: summary,
      planTitle: title,
      summary,
      isFallback: true,
      totalBudget: budgetDisplay,
      budgetBreakdown,
      duration: durationLabel,
      tripDuration: input.tripDuration,
      tripDate: input.tripDate,
      tripEndDate: input.tripEndDate,
      customDuration: input.customDuration,
      weather: input.weather,
      outfitAdvice,
      highlights: [
        title,
        days.map((day) => `${day.label}: ${day.theme}`).join(' / '),
        ...tips.slice(0, 2),
      ],
      rainyDayAlternatives: [
        `${location}の屋内カフェ`,
        `${location}のショッピングモール`,
        `${location}の美術館・ギャラリー`,
      ],
      conciergeAnalysis: {
        userPreferences: `${companion}・${purpose}向けのテスト用プランです。`,
        weather: weatherOrSeasonNote,
        budget: `予算 ${budgetDisplay}（${people}人）を目安にしています。`,
        tripDuration: durationLabel,
        travelStyle: input.personality,
        overallStrategy: accommodationFields.accommodation
          ? `宿泊先（${accommodationFields.accommodation}）を起点に、日々の開始・終了が戻りやすいエリアになるよう組んでいます（テスト用）。`
          : destinationDetails.baseArea
            ? `拠点（${destinationDetails.baseArea}）を中心に、近いエリアをまとめたテスト用行程です。`
            : '開発環境向けのフォールバック行程です。UI確認用に日別の流れを用意しています。',
      },
      ...accommodationFields,
      ...destinationPayload,
    },
    tripAudience,
  );

  return {
    days,
    items: flattenItineraryDays(days),
    details,
    devFallbackNotice: DEV_FALLBACK_PLAN_NOTICE,
  };
}

/**
 * Same safety-net purpose as `buildDevFallbackTravelPlan` (used when OpenAI times out/fails in
 * dev), but built from real, already-fetched Google Places candidates instead of the seed /
 * generic-area templates. Only call this when `candidates.length > 0` — with zero candidates the
 * caller should use `buildDevFallbackTravelPlan` instead (see `generatePlanWithAi`).
 *
 * Guarantees kept from the Google Places integration rules even in this fallback path:
 * - Only places from `candidates` are used — no invented store names.
 * - Each `placeId` is used at most once across the whole trip (candidates are consumed from a
 *   shared pool as they're assigned to slots).
 * - `source: 'google_places'` + `placeId` are set on every real-candidate item, so Maps deeplinks
 *   (`getPlaceMapsUrl`) resolve via `placeId`, not a text search.
 */
export function buildGooglePlacesFallbackTravelPlan(input: PlanInput, candidates: readonly PlaceCandidate[]) {
  const destinationDetails = resolveDestinationDetailsFromPlanInput(input);
  const location = destinationDetails.effectiveLocation.trim() || input.location.trim() || '目的地';
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const { symbol } = getCurrency(input.currency);
  const people = input.people.trim() || '2';
  const companion = input.companion;
  const purpose =
    input.travelPurpose?.trim() ||
    input.customPreferences?.customTravelIntent?.trim() ||
    input.mood?.trim() ||
    'グルメ';
  const durationLabel = input.durationLabel ?? durationConfig.label;

  const normalizedDestination = normalizeDestinationFromDetails(destinationDetails);
  const destinationLabel = normalizedDestination.destinationLabel || location;
  const title = `${destinationLabel}${durationLabel}${purpose}旅行`;

  const dayCount = Math.max(1, durationConfig.dayCount);
  const accommodationFields = normalizeAccommodationFields(
    input.accommodation ?? input.accommodationArea ?? input.accommodationName,
  );
  const purposeProfile = resolvePurposeProfileWithSelection({
    personality: input.personality,
    companion: input.companion,
    mood: input.mood,
    travelIntent: input.travelIntent,
    customPreferences: input.customPreferences,
    selectedPurposes: input.selectedPurposes,
  });
  const templates = buildGooglePlacesDayTemplates(
    candidates,
    normalizedDestination,
    purpose,
    companion,
    dayCount,
    {
      baseArea: destinationDetails.baseArea,
      arrivalPoint: destinationDetails.arrivalPoint,
      accommodation: accommodationFields.accommodation,
    },
    input.travelTiming,
    purposeProfile,
  );
  const timing = input.travelTiming;
  const earliestStartMinutes = getEarliestActivityStartMinutes(timing);
  const latestEndMinutes = getLatestActivityEndMinutes(timing);

  const budgetAmount = formatBudgetAmount(input.budget);
  const budgetDisplay = formatBudgetDisplay(budgetAmount, input.currency);

  const usedPlaceIds = new Set<string>();

  const scheduled = validateAndFixItinerarySchedule({
    days: enforceSpecificityOnDays(
      templates.map((template, index) => {
        const dayNumber = index + 1;
        const isFirstDay = index === 0;
        const isLastDay = index === templates.length - 1;
        const slots = buildDaySlotMinutes({
          spotCount: template.spots.length,
          isFirstDay,
          isLastDay,
          earliestStartMinutes,
          latestEndMinutes,
        });

        const items = template.spots.map((spot, spotIndex) => {
          let timeMinutes = slots[spotIndex];
          if (
            spot.placeType === 'nightlife' ||
            spot.category === '夜景' ||
            /夜景|night/i.test(spot.activity)
          ) {
            timeMinutes = Math.max(timeMinutes, 19 * 60 + 30);
          }
          // Only clamp last-day times that actually overrun the cutoff — do NOT pull every
          // slot back to cutoff-90 (that was the "everything lands at 17:00" bug).
          if (isLastDay && latestEndMinutes != null && timeMinutes > latestEndMinutes - 30) {
            timeMinutes = Math.max(
              slots[0] ?? DEFAULT_DAY_START_MINUTES,
              latestEndMinutes - DEFAULT_LAST_ITEM_END_BUFFER_MINUTES,
            );
          }

          // Defense in depth: even though buildGooglePlacesDayTemplates already consumes each
          // candidate from a shared pool, guard here too in case a future caller reuses templates.
          if (spot.placeId && usedPlaceIds.has(spot.placeId)) {
            return buildFallbackItem({
              timeMinutes,
              activity: genericAreaPhrase(normalizedDestination.destinationLabel, 'culture'),
              category: spot.category,
              reason: '同じ候補が旅行中に重複したため、エリア案内に切り替えています。',
              estimatedCost:
                spot.costShare > 0
                  ? `${symbol}${Math.round(budgetAmount * spot.costShare || 10000).toLocaleString()}`
                  : `${symbol}0`,
              note: spot.note,
              mapsQuery: genericMapsQuery(normalizedDestination, 'culture'),
              isSpecificPlace: false,
              placeType: spot.placeType,
              popularityType: 'fallback',
              confidence: 'low',
              source: 'fallback',
              placeId: null,
              rating: null,
              reviewCount: null,
            });
          }
          if (spot.placeId) usedPlaceIds.add(spot.placeId);

          return buildFallbackItem({
            timeMinutes,
            activity: spot.activity,
            category: spot.category,
            reason: spot.reason ?? `${companion}との${purpose}に合うおすすめスポットです。`,
            estimatedCost:
              spot.costShare > 0
                ? `${symbol}${Math.round(budgetAmount * spot.costShare || 10000).toLocaleString()}`
                : `${symbol}0`,
            note: spot.note,
            mapsQuery: spot.mapsQuery,
            isSpecificPlace: spot.isSpecificPlace,
            placeName: spot.placeName,
            placeType: spot.placeType,
            popularityType: spot.popularityType,
            confidence: spot.confidence,
            source: spot.source,
            placeId: spot.placeId,
            rating: spot.rating,
            reviewCount: spot.reviewCount,
          });
        });

        const timeWindow =
          slots.length > 0
            ? `${formatMinutesAsTime(slots[0])}〜${formatMinutesAsTime(slots[slots.length - 1] + 60)}`
            : undefined;

        return {
          dayNumber,
          label: `${dayNumber}日目`,
          theme: template.theme,
          timeWindow,
          items,
        };
      }),
      location,
    ),
    rawLocation: location,
    travelTiming: timing,
    destinationDetails,
  });

  const purposeComposition = enforcePurposeComposition(scheduled.days, {
    profile: purposeProfile,
    selectedMood: input.mood,
    candidates,
    rawLocation: location,
  });

  if (__DEV__) {
    const foodItems = purposeComposition.days
      .flatMap((day) => day.items)
      .filter((item) => item.category === 'food' || item.category === 'cafe');
    const totalNonTransit = purposeComposition.days
      .flatMap((day) => day.items)
      .filter((item) => item.activityCategory !== '移動');
    console.log('[Places] google fallback day allocation', {
      fallbackType: 'google_places',
      foodRatio: purposeComposition.foodRatio,
      itemsRemovedByFinalDayValidation: scheduled.itemsRemovedByFinalDayValidation,
      dayAvailableMinutes: scheduled.dayDiagnostics.map((d) => d.dayAvailableMinutes),
      targetItemCountPerDay: scheduled.dayDiagnostics.map((d) => d.targetItemCountPerDay),
      actualItemCountPerDay: scheduled.dayDiagnostics.map((d) => d.actualItemCountPerDay),
      foodItemCountPerDay: scheduled.dayDiagnostics.map((d) => d.foodItemCountPerDay),
      finalDayCutoffTime: scheduled.dayDiagnostics[scheduled.dayDiagnostics.length - 1]?.finalDayCutoffTime ?? null,
      selectedPlaceIdsByDay: purposeComposition.days.map((day) =>
        day.items.map((item) => item.placeId).filter(Boolean),
      ),
      foodItemCount: foodItems.length,
      totalItemCount: totalNonTransit.length,
    });
  }

  const tripAudience = resolveTripAudience({
    companion: input.companion,
    planCreationType: input.planCreationType ?? input.planType,
  });
  const tripCopy = sanitizeItineraryTripCopy(purposeComposition.days, tripAudience);
  const days: ItineraryDay[] = tripCopy.days;

  const budgetBreakdown = buildBudgetBreakdown(budgetAmount, symbol, dayCount);
  const weatherOrSeasonNote =
    input.weather?.summary?.trim() ||
    input.weather?.seasonalContext?.guidance ||
    `${destinationLabel}の季節に合わせ、屋内・屋外をバランスよく組んでいます。`;

  const outfitAdvice = generateOutfitPackingAdvice({
    days,
    weather: input.weather,
    location,
    planType: input.planCreationType ?? input.planType,
    companion: input.companion,
    outfitStyleMode: input.outfitStyleMode,
    dayCount,
    tripDate: input.tripDate,
  });

  const summary = `${destinationLabel}${durationLabel}の${purpose}旅行プランです（${companion}・${people}人・予算${budgetDisplay}目安）。Google Places実在候補から作成しています。`;

  const tips = [
    `${destinationLabel}では移動カードを事前準備すると便利です`,
    '人気店は事前予約または早めの時間帯がおすすめ',
    'AIの応答待ちの間、Google Places候補から自動でプランを作成しています',
  ];

  const destinationPayload = destinationDetailsToPayload(destinationDetails);

  const { details } = sanitizePlanDetailsTripCopy(
    {
      plannerMessage: summary,
      planTitle: title,
      summary,
      isFallback: true,
      totalBudget: budgetDisplay,
      budgetBreakdown,
      duration: durationLabel,
      tripDuration: input.tripDuration,
      tripDate: input.tripDate,
      tripEndDate: input.tripEndDate,
      customDuration: input.customDuration,
      weather: input.weather,
      outfitAdvice,
      highlights: [
        title,
        days.map((day) => `${day.label}: ${day.theme}`).join(' / '),
        ...tips.slice(0, 2),
      ],
      rainyDayAlternatives: [
        `${location}の屋内カフェ`,
        `${location}のショッピングモール`,
        `${location}の美術館・ギャラリー`,
      ],
      conciergeAnalysis: {
        userPreferences: `${companion}・${purpose}向けのプランです（Google Places実在候補ベース）。`,
        weather: weatherOrSeasonNote,
        budget: `予算 ${budgetDisplay}（${people}人）を目安にしています。`,
        tripDuration: durationLabel,
        travelStyle: input.personality,
        overallStrategy: accommodationFields.accommodation
          ? `宿泊先（${accommodationFields.accommodation}）を起点に、日々の開始・終了が戻りやすいエリアになるよう組んでいます。`
          : destinationDetails.baseArea
            ? `拠点（${destinationDetails.baseArea}）を中心に、近いエリアをまとめた行程です。`
            : 'Google Places候補から、日別の流れを自動的に組んでいます。',
      },
      ...accommodationFields,
      ...destinationPayload,
    },
    tripAudience,
  );

  return {
    days,
    items: flattenItineraryDays(days),
    details,
    devFallbackNotice: GOOGLE_PLACES_FALLBACK_NOTICE,
  };
}

export type DevFallbackSelection = {
  plan: ReturnType<typeof buildDevFallbackTravelPlan>;
  fallbackType: 'google_places' | 'seed';
};

/**
 * Single decision point for every "AI failed, build a safe plan instead" path in dev
 * (retry-exhausted timeout, server-proxy dev-fallback marker, destination-mismatch guard, etc.).
 * Always prefers the real, already-fetched Google Places candidates over the seed/mock template
 * — the seed template ("テスト用スポット" / placeId: null) must only ever be used when
 * `candidates` is genuinely empty (Places disabled, unconfigured, or the request itself found 0
 * results).
 */
export function selectDevFallbackPlan(
  input: PlanInput,
  candidates: readonly PlaceCandidate[],
  noticeOverride?: string,
): DevFallbackSelection {
  const fallbackType: 'google_places' | 'seed' = candidates.length > 0 ? 'google_places' : 'seed';
  const plan =
    fallbackType === 'google_places'
      ? buildGooglePlacesFallbackTravelPlan(input, candidates)
      : buildDevFallbackTravelPlan(input);

  return {
    plan: noticeOverride ? { ...plan, devFallbackNotice: noticeOverride } : plan,
    fallbackType,
  };
}

export function parseDevFallbackTravelPlanFromApiResponse(
  data: unknown,
  input: PlanInput,
  candidates: readonly PlaceCandidate[] = [],
): DevFallbackSelection | null {
  if (
    !data ||
    typeof data !== 'object' ||
    (data as { nanisuru_dev_fallback?: boolean }).nanisuru_dev_fallback !== true
  ) {
    return null;
  }

  const notice =
    typeof (data as { devFallbackNotice?: unknown }).devFallbackNotice === 'string'
      ? (data as { devFallbackNotice: string }).devFallbackNotice
      : DEV_FALLBACK_PLAN_NOTICE;

  return selectDevFallbackPlan(input, candidates, notice);
}
