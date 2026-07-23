/**
 * 「ここだけ変更」向け Google Places 検索意図・候補取得（純粋＋検索）。
 * OpenAI 非依存。架空店名・seed は作らない。
 */

import type { PlaceCategory } from '@/lib/destination-safety';
import { getTimeOfDaySlot } from '@/lib/trip-dna/trip-dna-engine';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { PlaceCandidate } from '@/types/place-candidate';
import type {
  ItineraryEditTarget,
  ItinerarySingleEditPresetId,
} from '@/types/itinerary-edit';
import type { SavedTripPayload } from '@/types/trip';
import {
  type PlaceSearchIntent,
  type SearchIntentDestination,
} from '@/lib/places/place-search-intent';
import { runPlaceSearchOrchestration } from '@/lib/places/place-search-orchestrator';

export const REPLACEMENT_CANDIDATE_LIMIT = 3;

export const REPLACEMENT_NO_CANDIDATES_MESSAGE =
  '条件に合う実在候補が見つかりませんでした。別の変更内容をお試しください';

/** Future PreferenceSignal hooks — not persisted in this change. */
export type ReplacementPreferenceSignalDraft = {
  source: 'replaced_place' | 'selected_replacement' | 'rejected_candidate';
  placeIdPresent: boolean;
  beforePlaceIdPresent?: boolean;
  afterPlaceIdPresent?: boolean;
  dimensionHint?: string;
};

export type ItineraryReplacementCandidateView = {
  placeName: string;
  placeId: string;
  category?: PlaceCategory;
  address?: string;
  rating?: number | null;
  reviewCount?: number | null;
  mapsUrl?: string | null;
  source: 'google';
  shortReason?: string;
};

export type ReplacementSearchDiagnostics = {
  replacementRequestType: string;
  originalPlaceIdPresent: boolean;
  replacementSearchIntent: string;
  candidateCount: number;
  uniqueCandidateCount: number;
  openAiUsed: boolean;
  fallbackType: 'places' | 'places_ranked' | 'none';
  selectedReplacementPlaceIdPresent: boolean;
  replacementApplied: boolean;
};

const PRESET_CATEGORY: Record<Exclude<ItinerarySingleEditPresetId, 'custom'>, PlaceCategory | 'keep'> = {
  similar_vibe: 'keep',
  gourmet: 'food',
  cafe: 'cafe',
  indoor: 'sightseeing',
  photo_spot: 'sightseeing',
  shopping: 'shopping',
  budget_friendly: 'keep',
  easy_move: 'keep',
};

const PRESET_QUERY: Partial<Record<ItinerarySingleEditPresetId, string>> = {
  gourmet: 'restaurants local food',
  cafe: 'cafe coffee',
  indoor: 'indoor attractions museum gallery',
  photo_spot: 'scenic photo spots landmarks',
  shopping: 'shopping mall market boutique',
  budget_friendly: 'affordable local spots',
  easy_move: 'nearby attractions',
  similar_vibe: '',
};

const ACTIVITY_CATEGORY_JA: Record<PlaceCategory, string> = {
  food: '食事',
  cafe: 'カフェ',
  sightseeing: '景色',
  shopping: '買い物',
  nightlife: '夜景',
  activity: '体験',
};

function inferCategoryFromItem(item: ItineraryItem): PlaceCategory {
  if (item.category) return item.category;
  const haystack = `${item.activityCategory ?? ''} ${item.activity ?? ''} ${item.placeCategory ?? ''}`;
  if (/カフェ|cafe|コーヒー/i.test(haystack)) return 'cafe';
  if (/買い物|ショッピング|shopping|お土産/i.test(haystack)) return 'shopping';
  if (/食事|グルメ|ランチ|ディナー|レストラン|food/i.test(haystack)) return 'food';
  if (/夜|バー|nightlife/i.test(haystack)) return 'nightlife';
  if (/体験|アクティビティ|activity/i.test(haystack)) return 'activity';
  return 'sightseeing';
}

function inferCategoryFromFreeText(text: string): PlaceCategory | null {
  if (/カフェ|coffee|喫茶/i.test(text)) return 'cafe';
  if (/グルメ|食事|レストラン|ランチ|ディナー|food/i.test(text)) return 'food';
  if (/買い物|ショッピング|shopping|お土産|モール/i.test(text)) return 'shopping';
  if (/映え|写真|フォト|景色|観光|sightseeing/i.test(text)) return 'sightseeing';
  if (/屋内|室内|ミュージアム|美術館|博物館/i.test(text)) return 'sightseeing';
  if (/体験|アクティビティ/i.test(text)) return 'activity';
  if (/バー|夜遊び|nightlife/i.test(text)) return 'nightlife';
  return null;
}

export function resolveReplacementRequestType(
  presetId: ItinerarySingleEditPresetId | undefined,
  userRequest: string,
): ItinerarySingleEditPresetId {
  if (presetId && presetId !== 'custom') return presetId;
  const text = userRequest.trim();
  if (/カフェ/i.test(text)) return 'cafe';
  if (/グルメ|食事/i.test(text)) return 'gourmet';
  if (/買い物|ショッピング/i.test(text)) return 'shopping';
  if (/映え|写真/i.test(text)) return 'photo_spot';
  if (/屋内|室内/i.test(text)) return 'indoor';
  if (/移動|近い|楽に/i.test(text)) return 'easy_move';
  if (/予算|安く|節約/i.test(text)) return 'budget_friendly';
  if (/似た|雰囲気/i.test(text)) return 'similar_vibe';
  return 'custom';
}

export function resolveReplacementCategory(
  requestType: ItinerarySingleEditPresetId,
  item: ItineraryItem,
  userRequest: string,
): PlaceCategory {
  if (requestType === 'custom') {
    return inferCategoryFromFreeText(userRequest) ?? inferCategoryFromItem(item);
  }
  const mapped = PRESET_CATEGORY[requestType];
  if (mapped === 'keep') return inferCategoryFromItem(item);
  return mapped;
}

export function collectUsedPlaceIds(
  days: readonly ItineraryDay[],
  exclude?: { dayIndex: number; itemIndex: number },
): Set<string> {
  const used = new Set<string>();
  days.forEach((day, dayIndex) => {
    day.items.forEach((item, itemIndex) => {
      if (
        exclude &&
        exclude.dayIndex === dayIndex &&
        exclude.itemIndex === itemIndex
      ) {
        return;
      }
      const id = item.placeId?.trim();
      if (id) used.add(id);
    });
  });
  return used;
}

export function resolveReplacementDestination(
  payload: SavedTripPayload,
): SearchIntentDestination | null {
  const details = payload.details ?? ({} as SavedTripPayload['details']);
  const destinationLabel =
    details.destinationLabel?.trim() ||
    payload.location?.trim() ||
    [details.city, details.country].filter(Boolean).join(' ').trim();
  if (!destinationLabel) return null;

  const accommodation =
    details.accommodation?.trim() ||
    details.accommodationArea?.trim() ||
    details.accommodationName?.trim();

  return {
    destinationLabel,
    city: details.city?.trim() || undefined,
    country: details.country?.trim() || undefined,
    baseArea: details.baseArea?.trim() || accommodation || undefined,
  };
}

export function buildReplacementSearchIntent(input: {
  requestType: ItinerarySingleEditPresetId;
  category: PlaceCategory;
  item: ItineraryItem;
  destination: SearchIntentDestination;
  userRequest: string;
}): PlaceSearchIntent {
  const slot = getTimeOfDaySlot(input.item.time) ?? 'afternoon';
  const presetQuery = PRESET_QUERY[input.requestType]?.trim();
  const freeHint =
    input.requestType === 'custom'
      ? input.userRequest.trim().slice(0, 48)
      : '';
  const query =
    [presetQuery, freeHint].filter(Boolean).join(' ').trim() ||
    input.category;

  // Prefer hub area for easy_move without claiming exact walking minutes.
  const baseArea =
    input.requestType === 'easy_move'
      ? input.destination.baseArea || input.destination.city
      : input.destination.baseArea;

  return {
    intentId: `replacement:${input.requestType}:${input.category}`,
    dayIndex: null,
    timeSlot: slot,
    category: input.category,
    query,
    city: input.destination.city,
    country: input.destination.country,
    baseArea,
    destinationLabel: input.destination.destinationLabel,
    desiredCount: 8,
    requiredSpecificPlace: true,
  };
}

function categoryMatchesRequest(
  candidate: PlaceCandidate,
  requested: PlaceCategory,
  requestType: ItinerarySingleEditPresetId,
): boolean {
  if (!candidate.category) return true;
  if (candidate.category === requested) return true;
  // Indoor / photo can accept activity + sightseeing.
  if (
    (requestType === 'indoor' || requestType === 'photo_spot') &&
    (candidate.category === 'sightseeing' || candidate.category === 'activity')
  ) {
    return true;
  }
  // similar / budget / easy_move: allow close neighbors for food/cafe.
  if (
    (requestType === 'similar_vibe' ||
      requestType === 'budget_friendly' ||
      requestType === 'easy_move') &&
    ((requested === 'food' && candidate.category === 'cafe') ||
      (requested === 'cafe' && candidate.category === 'food'))
  ) {
    return true;
  }
  return false;
}

function scoreCandidate(
  candidate: PlaceCandidate,
  requestType: ItinerarySingleEditPresetId,
): number {
  const rating = candidate.rating != null && Number.isFinite(candidate.rating) ? candidate.rating : 3.5;
  const reviews =
    candidate.reviewCount != null && candidate.reviewCount > 0
      ? Math.min(12, Math.log10(candidate.reviewCount + 1) * 4)
      : 0;
  let score = rating * 10 + reviews;

  if (requestType === 'budget_friendly' && candidate.priceLevel != null) {
    score += (4 - Math.min(4, Math.max(0, candidate.priceLevel))) * 3;
  }
  if (requestType === 'easy_move' && candidate.area) {
    score += 2;
  }
  return score;
}

export function filterAndRankReplacementCandidates(input: {
  candidates: readonly PlaceCandidate[];
  requestType: ItinerarySingleEditPresetId;
  requestedCategory: PlaceCategory;
  originalPlaceId?: string | null;
  usedPlaceIds: ReadonlySet<string>;
  limit?: number;
}): PlaceCandidate[] {
  const original = input.originalPlaceId?.trim() || '';
  const limit = input.limit ?? REPLACEMENT_CANDIDATE_LIMIT;

  const filtered = input.candidates.filter((candidate) => {
    const id = candidate.placeId?.trim();
    if (!id || !candidate.placeName?.trim()) return false;
    if (original && id === original) return false;
    if (input.usedPlaceIds.has(id)) return false;
    if (candidate.source === 'seed' || candidate.source === 'fallback') return false;
    if (!categoryMatchesRequest(candidate, input.requestedCategory, input.requestType)) {
      return false;
    }
    return true;
  });

  return [...filtered]
    .sort(
      (left, right) =>
        scoreCandidate(right, input.requestType) - scoreCandidate(left, input.requestType),
    )
    .slice(0, limit);
}

export function toReplacementCandidateView(
  candidate: PlaceCandidate,
  requestType: ItinerarySingleEditPresetId,
): ItineraryReplacementCandidateView {
  const categoryLabel = candidate.category
    ? ACTIVITY_CATEGORY_JA[candidate.category]
    : 'スポット';
  const shortReason =
    requestType === 'easy_move'
      ? '同じエリアで回りやすい候補です'
      : requestType === 'budget_friendly'
        ? '予算を抑えめにしやすい候補です'
        : `${categoryLabel}向けの実在スポットです`;

  return {
    placeName: candidate.placeName,
    placeId: candidate.placeId,
    category: candidate.category,
    address: candidate.address,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    mapsUrl: candidate.mapsUrl,
    source: 'google',
    shortReason,
  };
}

export function applyReplacementCandidateToItem(
  item: ItineraryItem,
  candidate: PlaceCandidate | ItineraryReplacementCandidateView,
  shortReason?: string,
): ItineraryItem {
  const category = candidate.category ?? item.category;
  const activityCategory = category ? ACTIVITY_CATEGORY_JA[category] : item.activityCategory;
  const placeName = candidate.placeName.trim();
  const mapsUrl =
    'mapsUrl' in candidate && candidate.mapsUrl
      ? candidate.mapsUrl
      : undefined;

  return {
    ...item,
    // Keep schedule slot.
    time: item.time,
    activity: placeName,
    placeName,
    placeId: candidate.placeId,
    placeAddress: candidate.address ?? item.placeAddress,
    category,
    activityCategory,
    placeCategory: activityCategory,
    rating: candidate.rating ?? null,
    reviewCount: candidate.reviewCount ?? null,
    websiteUrl: mapsUrl || item.websiteUrl,
    mapsQuery: placeName,
    socialQuery: placeName,
    isSpecificPlace: true,
    source: 'google_places',
    confidence: 'high',
    reason: shortReason ?? ('shortReason' in candidate ? candidate.shortReason : undefined),
  };
}

/**
 * Fetch Google Places candidates for a single-item replacement.
 * Never invents venues. Returns [] when Places is disabled / empty / failed.
 */
export async function fetchReplacementPlaceCandidates(input: {
  payload: SavedTripPayload;
  target: ItineraryEditTarget;
  userRequest: string;
  presetId?: ItinerarySingleEditPresetId;
}): Promise<{
  requestType: ItinerarySingleEditPresetId;
  category: PlaceCategory;
  intent: PlaceSearchIntent | null;
  candidates: PlaceCandidate[];
  views: ItineraryReplacementCandidateView[];
  diagnosticsBase: Omit<
    ReplacementSearchDiagnostics,
    'openAiUsed' | 'fallbackType' | 'selectedReplacementPlaceIdPresent' | 'replacementApplied'
  >;
}> {
  const requestType = resolveReplacementRequestType(input.presetId, input.userRequest);
  const category = resolveReplacementCategory(requestType, input.target.item, input.userRequest);
  const destination = resolveReplacementDestination(input.payload);
  const originalPlaceId = input.target.item.placeId?.trim() || null;
  const usedPlaceIds = collectUsedPlaceIds(input.payload.days, {
    dayIndex: input.target.dayIndex,
    itemIndex: input.target.itemIndex,
  });

  const diagnosticsBase = {
    replacementRequestType: requestType,
    originalPlaceIdPresent: Boolean(originalPlaceId),
    replacementSearchIntent: `${category}`,
    candidateCount: 0,
    uniqueCandidateCount: 0,
  };

  if (!destination) {
    return {
      requestType,
      category,
      intent: null,
      candidates: [],
      views: [],
      diagnosticsBase: { ...diagnosticsBase, replacementSearchIntent: 'missing_destination' },
    };
  }

  const intent = buildReplacementSearchIntent({
    requestType,
    category,
    item: input.target.item,
    destination,
    userRequest: input.userRequest,
  });

  // Soft secondary intent for easy_move / indoor to widen without leaving destination.
  const intents: PlaceSearchIntent[] = [intent];
  if (requestType === 'easy_move' && destination.baseArea) {
    intents.push({
      ...intent,
      intentId: `${intent.intentId}:area`,
      query: `${intent.query} ${destination.baseArea}`.trim(),
    });
  }
  if (requestType === 'indoor') {
    intents.push({
      ...intent,
      intentId: `${intent.intentId}:museum`,
      category: 'activity',
      query: 'indoor museum gallery',
    });
  }

  let orchestration;
  try {
    orchestration = await runPlaceSearchOrchestration(intents);
  } catch {
    return {
      requestType,
      category,
      intent,
      candidates: [],
      views: [],
      diagnosticsBase: {
        ...diagnosticsBase,
        replacementSearchIntent: intent.query,
      },
    };
  }

  const ranked = filterAndRankReplacementCandidates({
    candidates: orchestration.candidates,
    requestType,
    requestedCategory: category,
    originalPlaceId,
    usedPlaceIds,
    limit: REPLACEMENT_CANDIDATE_LIMIT,
  });

  const views = ranked.map((candidate) => toReplacementCandidateView(candidate, requestType));

  return {
    requestType,
    category,
    intent,
    candidates: ranked,
    views,
    diagnosticsBase: {
      replacementRequestType: requestType,
      originalPlaceIdPresent: Boolean(originalPlaceId),
      replacementSearchIntent: intent.query.slice(0, 80),
      candidateCount: orchestration.totalCandidatesBeforeDedup,
      uniqueCandidateCount: orchestration.uniqueCandidateCount,
    },
  };
}

export function buildReplacementPreferenceSignalDrafts(input: {
  originalPlaceIdPresent: boolean;
  selectedPlaceIdPresent: boolean;
}): ReplacementPreferenceSignalDraft[] {
  // Structure only — not persisted in this MVP fix.
  return [
    {
      source: 'replaced_place',
      placeIdPresent: input.originalPlaceIdPresent,
      beforePlaceIdPresent: input.originalPlaceIdPresent,
    },
    {
      source: 'selected_replacement',
      placeIdPresent: input.selectedPlaceIdPresent,
      afterPlaceIdPresent: input.selectedPlaceIdPresent,
    },
  ];
}
