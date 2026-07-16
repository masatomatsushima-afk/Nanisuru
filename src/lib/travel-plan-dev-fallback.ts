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
  buildSeoulSeedMapsQuery,
  isSeoulDestination,
  pickSeoulSeedForKind,
  seoulSeedToCandidate,
} from './seoul-spot-seeds';
import { enforceSpecificityOnDays } from './spot-specificity';
import { validateAndFixItinerarySchedule } from './itinerary-schedule-validation';
import {
  resolveTripAudience,
  sanitizeItineraryTripCopy,
  sanitizePlanDetailsTripCopy,
} from './trip-type-copy';
import { resolveTripDnaOrDefault } from './trip-dna/trip-dna-engine';
import type { TimeOfDaySlot, TripDnaProfile } from './trip-dna/trip-dna-types';
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

/** slot × category → 安全なフレーズ（isAbstractItineraryItem の「で」+ジャンル語パターンを踏まない表現）。 */
const GOOGLE_PLACES_ACTIVITY_PHRASE: Record<PlaceCategory, (placeName: string) => string> = {
  food: (name) => `${name}で人気のグルメを味わう`,
  cafe: (name) => `${name}で休憩`,
  sightseeing: (name) => `${name}を観光`,
  shopping: (name) => `${name}でお土産・ショッピングを楽しむ`,
  nightlife: (name) => `${name}で夜を楽しむ`,
  activity: (name) => `${name}を体験`,
};

/** カテゴリ → 日本語の activityCategory ラベル（UIのカテゴリバッジ表示用・enum制約なし）。 */
const ACTIVITY_CATEGORY_LABEL_JA: Record<PlaceCategory, string> = {
  food: '食事',
  cafe: 'カフェ',
  sightseeing: '文化',
  shopping: '買い物',
  nightlife: '夜景',
  activity: '体験',
};

/**
 * Trip DNA の `timeOfDayRules` から、その時間帯スロットで最も優先すべきカテゴリを1つ返す
 * （`forbiddenCategories` は除外）。各ルールの `preferredCategories` は既にスロットにとって
 * 自然な順（例: 午後なら "カフェ→食事"）で書かれているため、その並び順の先頭をそのまま使う
 * （`categoryPriority` で上書きしない — そうすると food が常に全スロットを奪ってしまう）。
 * 該当カテゴリが無いスロット（例: family/relaxのnight）は null — 呼び出し側はそのスロット自体を省く。
 */
function pickCategoryForSlot(dna: TripDnaProfile, slot: TimeOfDaySlot): PlaceCategory | null {
  const forbidden = new Set(dna.forbiddenCategories);
  const rule = dna.timeOfDayRules.find((entry) => entry.slot === slot);
  const preferred = (rule?.preferredCategories ?? []).filter((category) => !forbidden.has(category));
  return preferred[0] ?? null;
}

/**
 * Same day/slot shape as `buildDefaultDayTemplates`, but spots are filled from real Google
 * Places candidates (already ranked, already deduplicated) instead of the curated safe-area /
 * Seoul-seed lists. Each candidate is used at most once across the whole trip (removed from the
 * shared pool once assigned).
 *
 * Which category each time-of-day slot wants is driven entirely by the resolved Trip DNA
 * (`dna.timeOfDayRules` / `dna.categoryPriority` / `dna.forbiddenCategories`) — this function has
 * no gourmet-specific (or any other DNA-specific) branching; a new DNA only needs a new config
 * entry in `trip-dna-profiles.ts`.
 *
 * If the candidate pool has nothing left for a slot's category, that slot is simply omitted
 * (shorter day) instead of falling back to an invented store, a mismatched-category candidate, or
 * an abstract "◯◯エリアを散策"-style filler — per product requirement, a shorter, all-real
 * itinerary is preferred over padding with fake/abstract content.
 */
function buildGooglePlacesDayTemplates(
  candidatesInput: readonly PlaceCandidate[],
  normalized: NormalizedDestination,
  purpose: string,
  companion: string,
  dayCount: number,
  dna: TripDnaProfile,
  hub?: { baseArea?: string; arrivalPoint?: string; accommodation?: string },
): DayTemplate[] {
  const pool: PlaceCandidate[] = [...candidatesInput];

  const takeCandidateForCategory = (category: PlaceCategory): PlaceCandidate | null => {
    const idx = pool.findIndex((candidate) => candidate.category === category);
    if (idx < 0) return null;
    return pool.splice(idx, 1)[0];
  };

  const googleReason = (placeName: string) =>
    `${companion}との${purpose}に合うGoogle Places実在候補「${placeName}」です。`;

  /**
   * その時間帯スロットにDNAが望むカテゴリの候補を1件だけ割り当てる。候補が無ければ null を返し、
   * 呼び出し側でスロットそのものを省く（架空店舗・カテゴリ不一致・技術的な「切り替え」文言は出さない）。
   */
  const spotForSlot = (
    slot: TimeOfDaySlot,
  ): (Pick<SpotTemplate, 'activity' | 'mapsQuery' | 'isSpecificPlace' | 'placeName' | 'placeType' | 'popularityType' | 'confidence' | 'source' | 'placeId' | 'rating' | 'reviewCount' | 'reason'>) | null => {
    const category = pickCategoryForSlot(dna, slot);
    if (!category) return null;
    const candidate = takeCandidateForCategory(category);
    if (!candidate) return null;

    const mapsQuery = `${candidate.placeName} ${normalized.destinationLabel}`.trim();
    return {
      activity: GOOGLE_PLACES_ACTIVITY_PHRASE[category](candidate.placeName),
      mapsQuery,
      isSpecificPlace: true,
      placeName: candidate.placeName,
      placeType: candidate.category ?? category,
      popularityType: candidate.rating != null && candidate.rating >= 4.3 ? 'popular' : 'classic',
      confidence: 'high',
      source: 'google_places',
      placeId: candidate.placeId,
      rating: candidate.rating ?? null,
      reviewCount: candidate.reviewCount ?? null,
      reason: googleReason(candidate.placeName),
    };
  };

  const transitMapsQuery = buildDestinationMapsSuffix(normalized);
  const transitSpot = {
    mapsQuery: transitMapsQuery,
    isSpecificPlace: false,
    placeType: 'activity' as PlaceCategory,
    popularityType: 'fallback' as PopularityType,
    confidence: 'low' as const,
    reason: '移動・ロジスティクスのため候補選定の対象外です。',
  };

  const hubLabel = hub?.baseArea || hub?.accommodation || normalized.destinationLabel;
  const location = normalized.destinationLabel;

  const buildDaySpots = (slots: readonly TimeOfDaySlot[]): SpotTemplate[] => {
    const spots: SpotTemplate[] = [];
    for (const slot of slots) {
      const resolved = spotForSlot(slot);
      if (!resolved) continue;
      spots.push({
        category: ACTIVITY_CATEGORY_LABEL_JA[resolved.placeType] ?? '体験',
        note: '',
        costShare: 0.15,
        ...resolved,
      });
    }
    return spots;
  };

  const buildArrival = (): DayTemplate => {
    const arrivalActivity = hub?.arrivalPoint
      ? `${hub.arrivalPoint}到着・${hubLabel}へ移動`
      : `${location}到着・チェックイン`;
    const transit: SpotTemplate = {
      category: '移動',
      note: '到着後の移動・荷物整理',
      costShare: 0,
      activity: arrivalActivity,
      ...transitSpot,
    };
    return {
      theme: hub?.baseArea ? `到着・${hub.baseArea}周辺` : `到着・${purpose}`,
      spots: [transit, ...buildDaySpots(['midday', 'afternoon', 'evening'])],
    };
  };
  const buildMiddle = (): DayTemplate => ({
    theme: `${dna.label}を楽しむ1日`,
    spots: buildDaySpots(['morning', 'midday', 'afternoon', 'evening']),
  });
  const buildLast = (): DayTemplate => {
    const transit: SpotTemplate = {
      category: '移動',
      note: '出発時刻に合わせて移動',
      costShare: 0,
      activity: 'ホテルチェックアウト・移動',
      ...transitSpot,
    };
    return {
      theme: 'お土産・軽めランチ・帰宅',
      spots: [...buildDaySpots(['morning', 'midday']), transit],
    };
  };

  const templates = (() => {
    if (dayCount <= 1) {
      const arrival = buildArrival();
      return [{ ...arrival, spots: arrival.spots.slice(0, 4) }];
    }
    if (dayCount === 2) return [buildArrival(), buildLast()];
    return [buildArrival(), ...Array.from({ length: dayCount - 2 }, () => buildMiddle()), buildLast()];
  })();

  // 候補が本当に不足していて、ある日が丸ごと空（移動アイテムのみ）になったときだけ、
  // 空白のカードを避けるための自然な1文を最後の保険として入れる（技術的な文言・散策の穴埋めはしない）。
  return templates.map((template) => {
    const hasRealSpot = template.spots.some((spot) => spot.isSpecificPlace);
    if (hasRealSpot) return template;
    return {
      ...template,
      spots: [
        ...template.spots,
        {
          category: '体験',
          note: '',
          costShare: 0.05,
          activity: `${location}を自由に楽しむ`,
          mapsQuery: genericMapsQuery(normalized, 'stroll'),
          isSpecificPlace: false,
          placeType: 'activity' as PlaceCategory,
          popularityType: 'fallback' as PopularityType,
          confidence: 'low' as const,
          source: 'fallback' as ItineraryItem['source'],
          placeId: null,
          rating: null,
          reviewCount: null,
          reason: `${location}を思い思いに過ごす時間です。`,
        },
      ],
    };
  });
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

  if (isLastDay && latestEndMinutes != null) {
    const lastItemStart = Math.max(
      8 * 60,
      latestEndMinutes - DEFAULT_LAST_ITEM_END_BUFFER_MINUTES,
    );
    const firstItemStart = Math.max(8 * 60, lastItemStart - (spotCount - 1) * DAY_SPACING_MINUTES);
    return Array.from({ length: spotCount }, (_, i) =>
      Math.min(lastItemStart, firstItemStart + i * DAY_SPACING_MINUTES),
    );
  }

  const startMinutes =
    isFirstDay && earliestStartMinutes != null ? earliestStartMinutes : DEFAULT_DAY_START_MINUTES;
  return Array.from({ length: spotCount }, (_, i) => startMinutes + i * DAY_SPACING_MINUTES);
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
      if (isLastDay && latestEndMinutes != null) {
        timeMinutes = Math.min(timeMinutes, Math.max(7 * 60 + 30, latestEndMinutes - 90));
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
  const dna = resolveTripDnaOrDefault({
    personality: input.personality,
    companion: input.companion,
    mood: input.mood,
    travelIntent: input.travelIntent,
    customPreferences: input.customPreferences,
  });
  const templates = buildGooglePlacesDayTemplates(candidates, normalizedDestination, purpose, companion, dayCount, dna, {
    baseArea: destinationDetails.baseArea,
    arrivalPoint: destinationDetails.arrivalPoint,
    accommodation: accommodationFields.accommodation,
  });
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

        // Defense in depth: even though buildGooglePlacesDayTemplates already consumes each
        // candidate from a shared pool, drop any spot here too in case a future caller reuses
        // templates. A duplicate is dropped entirely (shorter day) — never replaced with an
        // abstract "散策" filler or a technical "切り替えました" reason.
        const dedupedSpots = template.spots.filter((spot) => !(spot.placeId && usedPlaceIds.has(spot.placeId)));
        for (const spot of dedupedSpots) {
          if (spot.placeId) usedPlaceIds.add(spot.placeId);
        }

        const slots = buildDaySlotMinutes({
          spotCount: dedupedSpots.length,
          isFirstDay,
          isLastDay,
          earliestStartMinutes,
          latestEndMinutes,
        });

        const items = dedupedSpots.map((spot, spotIndex) => {
          let timeMinutes = slots[spotIndex];
          if (
            spot.placeType === 'nightlife' ||
            spot.category === '夜景' ||
            /夜景|night/i.test(spot.activity)
          ) {
            timeMinutes = Math.max(timeMinutes, 19 * 60 + 30);
          }
          if (isLastDay && latestEndMinutes != null) {
            timeMinutes = Math.min(timeMinutes, Math.max(7 * 60 + 30, latestEndMinutes - 90));
          }

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
