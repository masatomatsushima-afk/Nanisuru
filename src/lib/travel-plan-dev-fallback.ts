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
import type { BudgetBreakdown, ItineraryDay, ItineraryItem } from '@/types/plan';
import type { SpotCandidate } from '@/types/spot-candidate';

export { DEV_FALLBACK_PLAN_NOTICE };

/** Small notice shown directly on the Plan Detail screen when isFallback is true. */
export const PLAN_DETAIL_FALLBACK_NOTICE =
  'AI接続が不安定だったため、開発用プランを表示しています';

/** Shown when the AI response mixed in out-of-destination spots and was replaced with a safe plan. */
export const DESTINATION_SAFETY_FALLBACK_NOTICE =
  '目的地外のスポットが検出されたため、安全なテスト用プランを表示しています';

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
    placeId: null,
    rating: null,
    reviewCount: null,
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
        reason: `${companion}との${purpose}に合うテスト用スポット（${location}）。UI確認用のサンプルです。`,
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

export function parseDevFallbackTravelPlanFromApiResponse(
  data: unknown,
  input: PlanInput,
): ReturnType<typeof buildDevFallbackTravelPlan> | null {
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

  return {
    ...buildDevFallbackTravelPlan(input),
    devFallbackNotice: notice,
  };
}
