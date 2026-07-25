/**
 * Detects vague / genre-only itinerary items and enforces isSpecificPlace rules.
 * Designed so Google Places API can later supply spotCandidates before AI scheduling.
 */

import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { SpotCandidate, SpotCandidateSource } from '@/types/spot-candidate';
import {
  buildSeoulSeedMapsQuery,
  isSeoulDestination,
  pickSeoulSeedForKind,
  seoulSeedToCandidate,
  type SeoulSpotSeed,
} from './seoul-spot-seeds';
import {
  categoryForGenericKind,
  enforceDestinationScopedQuery,
  genericAreaPhrase,
  genericMapsQuery,
  normalizeDestination,
  resolveAreaPhraseHub,
  type GenericAreaPhraseKind,
  type NormalizedDestination,
} from './destination-safety';

const ABSTRACT_TITLE_PATTERNS: RegExp[] = [
  /で(韓国料理|グルメ|ランチ|ディナー|デザート|ショッピング|名物料理|伝統料理|BBQ|お土産)/i,
  /（[^）]*拠点）/,
  /\([^)]*拠点\)/,
  /^日本・/,
  /^韓国・/,
  /で(?:お土産|ショッピング|グルメ|観光|カフェ)?を?楽しむ/,
  /周辺で楽しむ/,
  /美しい公園/,
  /人気カフェ/,
  /買い物スポット/,
  /韓国料理ディナー/,
  /市場を散策/,
  /UI確認/,
  /テスト用/,
  /^カフェで/,
  /^コリアンBBQ/i,
  /^(韓国)?伝統市場で/,
  /夜景スポット/,
  /地元探索/,
  /市場エリア/,
  /伝統的な(?:料理|韓国)/,
  /ローカルグルメ体験/,
  /local restaurant/i,
  /traditional food/i,
  /shopping area/i,
  /cafe time/i,
  /market area/i,
  /hidden spot/i,
  /で食事$/,
  /周辺で(?:ランチ|ディナー|グルメ|カフェ|デザート)/,
  /エリアで(?:ショッピング|グルメ|ランチ)/,
  /(?:周辺|エリア)を?(?:散策|探索)$/,
];

const GENRE_ONLY_PLACE_NAMES = new Set([
  '明洞',
  'myeongdong',
  '弘大',
  'hongdae',
  '江南',
  'gangnam',
  'カフェ',
  'cafe',
  '市場',
  'market',
  'レストラン',
  'restaurant',
]);

/** True when the item reads as area/genre only — not a concrete venue the user can navigate to. */
export function isAbstractItineraryItem(item: Pick<ItineraryItem, 'activity' | 'placeName' | 'placeAddress'>): boolean {
  const title = (item.activity ?? '').trim();
  const placeName = (item.placeName ?? '').trim();
  const area = (item.placeAddress ?? '').trim();

  if (!title) return true;
  if (!placeName) return true;

  if (ABSTRACT_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return true;
  }

  const placeLower = placeName.toLowerCase();
  if (GENRE_ONLY_PLACE_NAMES.has(placeName) || GENRE_ONLY_PLACE_NAMES.has(placeLower)) {
    return true;
  }

  if (area && placeName === area && /で(料理|グルメ|ランチ|ディナー|デザート|ショッピング)/.test(title)) {
    return true;
  }

  if (/^(?:.{1,8})で(?:韓国料理|グルメ|ランチ|ディナー|デザート|ショッピング|名物料理)$/.test(title)) {
    const prefix = title.split('で')[0]?.trim();
    if (prefix && (prefix === placeName || prefix === area)) {
      return true;
    }
  }

  return false;
}

export function getCandidateAreaLabel(item: ItineraryItem): string {
  const area = item.placeAddress?.trim() || item.placeName?.trim();
  if (area) {
    if (/カフェ|cafe/i.test(item.activity)) return `${area}周辺のカフェ`;
    if (/ショッピング|shopping/i.test(item.activity)) return `${area}周辺のショッピング`;
    if (/グルメ|料理|ランチ|ディナー|BBQ/i.test(item.activity)) return `${area}周辺のグルメ`;
    if (/散策|探索|stroll/i.test(item.activity)) return `${area}周辺`;
    return `${area}周辺`;
  }
  return item.activity.trim();
}

export function inferKindFromItem(item: ItineraryItem): GenericAreaPhraseKind {
  const haystack = `${item.activity} ${item.category ?? ''} ${item.activityCategory ?? ''}`;
  if (/カフェ|cafe|デザート/i.test(haystack)) return 'cafe';
  if (/ショッピング|shopping|お土産/i.test(haystack)) return 'shopping';
  if (/夜景|night/i.test(haystack)) return 'night';
  if (/市場|market|グルメ|ランチ|ディナー|食事|BBQ|料理/i.test(haystack)) return 'market';
  if (/観光|culture|散策|宮|タワー|村/i.test(haystack)) return 'culture';
  return 'stroll';
}

function buildCandidateAreaItem(
  item: ItineraryItem,
  normalized: NormalizedDestination,
  kind: GenericAreaPhraseKind,
): ItineraryItem {
  const areaLabel = getCandidateAreaLabel(item);
  const mapsQuery = genericMapsQuery(normalized, kind);
  const candidate: SpotCandidate = {
    placeName: areaLabel,
    area: item.placeAddress?.trim() || normalized.destinationLabel,
    mapsQuery,
    socialQuery: mapsQuery,
    category: item.category ?? categoryForGenericKind(kind),
    popularityType: 'fallback',
    placeId: null,
    rating: null,
    reviewCount: null,
    priceLevel: null,
    source: 'fallback',
    confidence: 'low',
  };

  return {
    ...item,
    activity: genericAreaPhrase(resolveAreaPhraseHub(normalized), kind),
    placeName: undefined,
    placeAddress: areaLabel || resolveAreaPhraseHub(normalized),
    isSpecificPlace: false,
    confidence: 'low',
    popularityType: 'fallback',
    source: 'fallback',
    mapsQuery,
    socialQuery: mapsQuery,
    spotCandidates: [candidate],
    placeId: null,
    rating: null,
    reviewCount: null,
    priceLevel: null,
  };
}

function applySeoulSeed(item: ItineraryItem, seed: SeoulSpotSeed, normalized: NormalizedDestination): ItineraryItem {
  const mapsQuery = buildSeoulSeedMapsQuery(seed, normalized);
  const candidate = seoulSeedToCandidate(seed, mapsQuery);

  return {
    ...item,
    activity: seed.activity,
    placeName: seed.placeName,
    placeAddress: seed.area,
    category: seed.category,
    popularityType: seed.popularityType,
    isSpecificPlace: true,
    confidence: 'high',
    source: 'seed',
    mapsQuery,
    socialQuery: mapsQuery,
    spotCandidates: [candidate],
    placeId: null,
    rating: null,
    reviewCount: null,
    priceLevel: null,
  };
}

/** Normalize maps/social queries and compute isSpecificPlace from content — never default to true blindly. */
export function enforceItemSpecificity(
  item: ItineraryItem,
  normalized: NormalizedDestination,
  options?: { seoulSeedCursor?: number; allowSeoulSeeds?: boolean },
): ItineraryItem {
  const scopedMaps = enforceDestinationScopedQuery(
    item.mapsQuery ?? item.activity,
    normalized,
  );
  const scopedSocial = item.socialQuery?.trim()
    ? enforceDestinationScopedQuery(item.socialQuery, normalized)
    : scopedMaps;

  let next: ItineraryItem = {
    ...item,
    mapsQuery: scopedMaps,
    socialQuery: scopedSocial,
    source: (item.source ?? 'openai') as SpotCandidateSource,
    placeId: item.placeId ?? null,
    rating: item.rating ?? null,
    reviewCount: item.reviewCount ?? null,
    priceLevel: item.priceLevel ?? null,
  };

  const abstract = isAbstractItineraryItem(next);
  const allowSeoulSeeds = options?.allowSeoulSeeds !== false;

  if (abstract && allowSeoulSeeds && isSeoulDestination(normalized)) {
    const kind = inferKindFromItem(next);
    const seed = pickSeoulSeedForKind(kind, options?.seoulSeedCursor ?? 0);
    if (seed) {
      return applySeoulSeed(next, seed, normalized);
    }
  }

  if (abstract || !next.placeName?.trim() || next.confidence === 'low') {
    if (process.env.NODE_ENV !== 'production' && abstract) {
      console.info('[spot-specificity]', { abstractTitleBlocked: true });
    }
    return buildCandidateAreaItem(next, normalized, inferKindFromItem(next));
  }

  const specific =
    next.isSpecificPlace !== false && Boolean(next.placeName?.trim());

  const candidate: SpotCandidate = {
    placeName: next.placeName!,
    area: next.placeAddress,
    mapsQuery: scopedMaps,
    socialQuery: scopedSocial,
    category: next.category,
    popularityType: next.popularityType,
    placeId: next.placeId ?? null,
    rating: next.rating ?? null,
    reviewCount: next.reviewCount ?? null,
    priceLevel: next.priceLevel ?? null,
    source: next.source ?? 'openai',
    confidence: next.confidence ?? 'medium',
  };

  return {
    ...next,
    isSpecificPlace: specific,
    spotCandidates: next.spotCandidates?.length ? next.spotCandidates : [candidate],
  };
}

export function enforceSpecificityOnDays(
  days: ItineraryDay[],
  rawLocation: string | undefined | null,
  options?: { allowSeoulSeeds?: boolean },
): ItineraryDay[] {
  const normalized = normalizeDestination(rawLocation);
  let seoulSeedCursor = 0;
  const allowSeoulSeeds = options?.allowSeoulSeeds !== false;

  return days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      const enforced = enforceItemSpecificity(item, normalized, {
        seoulSeedCursor,
        allowSeoulSeeds,
      });
      if (allowSeoulSeeds && isSeoulDestination(normalized) && enforced.source === 'seed') {
        seoulSeedCursor += 1;
      } else if (enforced.isSpecificPlace === false) {
        seoulSeedCursor += 1;
      }
      return enforced;
    }),
  }));
}
