/**
 * Seoul-only MVP spot seeds — curated real venues for fallback plans and abstract-item replacement.
 * This is NOT a global registry; other cities must not invent names from this list.
 */

import type { GenericAreaPhraseKind, NormalizedDestination, PlaceCategory, PopularityType } from './destination-safety';
import { buildSafeAreaMapsQuery } from './destination-safety';
import { normalizePlaceName } from './itinerary-quality';
import type { SpotCandidate } from '@/types/spot-candidate';

export type SeoulSpotSeed = {
  placeName: string;
  label: string;
  mapsName: string;
  area: string;
  category: PlaceCategory;
  popularityType: PopularityType;
  /** Default activity phrasing for this seed. */
  activity: string;
  kinds: GenericAreaPhraseKind[];
};

/** MVP seed list for Seoul/Korea trips — real, well-known venues only. */
export const SEOUL_MVP_SPOT_SEEDS: readonly SeoulSpotSeed[] = [
  {
    placeName: '明洞餃子',
    label: '明洞餃子',
    mapsName: 'Myeongdong Kyoja',
    area: '明洞',
    category: 'food',
    popularityType: 'popular',
    activity: '明洞餃子でカルグクス',
    kinds: ['lunch', 'dinner'],
  },
  {
    placeName: '広蔵市場',
    label: '広蔵市場',
    mapsName: 'Gwangjang Market',
    area: '鍾路',
    category: 'food',
    popularityType: 'classic',
    activity: '広蔵市場でローカルグルメ',
    kinds: ['market', 'lunch', 'dinner'],
  },
  {
    placeName: '土俗村',
    label: '土俗村',
    mapsName: 'Tosokchon Samgyetang',
    area: '景福宮周辺',
    category: 'food',
    popularityType: 'classic',
    activity: '土俗村で参鶏湯',
    kinds: ['dinner', 'lunch'],
  },
  {
    placeName: '景福宮',
    label: '景福宮',
    mapsName: 'Gyeongbokgung Palace',
    area: '鍾路',
    category: 'sightseeing',
    popularityType: 'classic',
    activity: '景福宮を散策',
    kinds: ['culture', 'stroll'],
  },
  {
    placeName: '北村韓屋村',
    label: '北村韓屋村',
    mapsName: 'Bukchon Hanok Village',
    area: '北村',
    category: 'sightseeing',
    popularityType: 'classic',
    activity: '北村韓屋村を散策',
    kinds: ['culture', 'stroll'],
  },
  {
    placeName: '南山ソウルタワー',
    label: '南山ソウルタワー',
    mapsName: 'N Seoul Tower',
    area: '南山',
    category: 'sightseeing',
    popularityType: 'popular',
    activity: '南山ソウルタワーで夜景',
    kinds: ['night', 'culture'],
  },
  {
    placeName: 'Cafe Onion',
    label: 'Cafe Onion',
    mapsName: 'Cafe Onion Seongsu',
    area: '聖水洞',
    category: 'cafe',
    popularityType: 'hidden_gem',
    activity: '聖水洞 Cafe Onion 周辺でカフェ休憩',
    kinds: ['cafe'],
  },
  {
    placeName: '清水堂',
    label: '清水堂',
    mapsName: 'Cheong Su Dang Ikseon',
    area: '益善洞',
    category: 'cafe',
    popularityType: 'local',
    activity: '益善洞 清水堂 周辺でデザート',
    kinds: ['cafe'],
  },
  {
    placeName: '弘大エリア',
    label: '弘大',
    mapsName: 'Hongdae',
    area: '弘大',
    category: 'nightlife',
    popularityType: 'popular',
    activity: '弘大エリアでショッピングとストリートグルメ',
    kinds: ['shopping', 'night'],
  },
  {
    placeName: '漢江公園',
    label: '漢江公園',
    mapsName: 'Hangang Park',
    area: '漢江',
    category: 'activity',
    popularityType: 'popular',
    activity: '漢江公園を散策',
    kinds: ['stroll', 'culture'],
  },
] as const;

export function isSeoulDestination(normalized: NormalizedDestination): boolean {
  return normalized.knownKey === 'seoul';
}

export function pickSeoulSeedForKind(
  kind: GenericAreaPhraseKind,
  cursor: number,
  usedKeys?: Set<string>,
): SeoulSpotSeed | null {
  const pool = SEOUL_MVP_SPOT_SEEDS.filter((seed) => seed.kinds.includes(kind));
  const candidates = pool.length > 0 ? pool : [...SEOUL_MVP_SPOT_SEEDS];
  if (candidates.length === 0) return null;

  for (let offset = 0; offset < candidates.length; offset += 1) {
    const seed = candidates[(cursor + offset) % candidates.length];
    const key = `place:${normalizePlaceName(seed.placeName)}`;
    if (usedKeys?.has(key)) continue;
    return seed;
  }

  return null;
}

export function seoulSeedToCandidate(seed: SeoulSpotSeed, mapsQuery: string): SpotCandidate {
  return {
    placeName: seed.placeName,
    area: seed.area,
    mapsQuery,
    socialQuery: mapsQuery,
    category: seed.category,
    popularityType: seed.popularityType,
    placeId: null,
    rating: null,
    reviewCount: null,
    priceLevel: null,
    source: 'seed',
    confidence: 'high',
  };
}

export function buildSeoulSeedMapsQuery(seed: SeoulSpotSeed, normalized: NormalizedDestination): string {
  return buildSafeAreaMapsQuery(
    { label: seed.label, mapsName: seed.mapsName, category: seed.category, popularityType: seed.popularityType },
    normalized,
  );
}
