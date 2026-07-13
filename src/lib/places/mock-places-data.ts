/**
 * Mock PlaceCandidate データ。
 * 外部通信なし — 既存 seed の実在スポット名を再利用（データは seoul-spot-seeds / static-places と一致）。
 */

import { buildGoogleMapsPlaceUrl } from '@/lib/geo';
import type { PlaceCategory } from '@/lib/destination-safety';
import type { PlaceCandidate, PlaceOpeningHours } from '@/types/place-candidate';
import type { PlaceSearchQueryLike } from './mock-places-query';

type MockSeedRow = {
  cityKey: 'seoul' | 'tokyo' | 'osaka';
  city: string;
  country: string;
  placeName: string;
  area: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  priceLevel: number;
  openingHours?: PlaceOpeningHours | null;
};

/** @see src/lib/seoul-spot-seeds.ts SEOUL_MVP_SPOT_SEEDS */
/** @see src/lib/static-places.ts STATIC_CITY_PACKS */
const MOCK_SEED_ROWS: readonly MockSeedRow[] = [
  {
    cityKey: 'seoul',
    city: 'Seoul',
    country: 'Korea',
    placeName: '明洞餃子',
    area: '明洞',
    category: 'food',
    lat: 37.5634,
    lng: 126.9865,
    rating: 4.3,
    reviewCount: 8420,
    priceLevel: 2,
  },
  {
    cityKey: 'seoul',
    city: 'Seoul',
    country: 'Korea',
    placeName: '広蔵市場',
    area: '鍾路',
    category: 'food',
    lat: 37.57,
    lng: 126.9996,
    rating: 4.3,
    reviewCount: 12500,
    priceLevel: 2,
  },
  {
    cityKey: 'seoul',
    city: 'Seoul',
    country: 'Korea',
    placeName: '土俗村',
    area: '景福宮周辺',
    category: 'food',
    lat: 37.5794,
    lng: 126.971,
    rating: 4.2,
    reviewCount: 6200,
    priceLevel: 2,
  },
  {
    cityKey: 'seoul',
    city: 'Seoul',
    country: 'Korea',
    placeName: '景福宮',
    area: '鍾路',
    category: 'sightseeing',
    lat: 37.5796,
    lng: 126.977,
    rating: 4.6,
    reviewCount: 28400,
    priceLevel: 1,
  },
  {
    cityKey: 'seoul',
    city: 'Seoul',
    country: 'Korea',
    placeName: 'Cafe Onion',
    area: '聖水洞',
    category: 'cafe',
    lat: 37.5447,
    lng: 127.0557,
    rating: 4.4,
    reviewCount: 3100,
    priceLevel: 2,
  },
  {
    cityKey: 'seoul',
    city: 'Seoul',
    country: 'Korea',
    placeName: '清水堂',
    area: '益善洞',
    category: 'cafe',
    lat: 37.574,
    lng: 126.989,
    rating: 4.3,
    reviewCount: 1800,
    priceLevel: 2,
  },
  {
    cityKey: 'tokyo',
    city: 'Tokyo',
    country: 'Japan',
    placeName: '浅草寺',
    area: '浅草',
    category: 'sightseeing',
    lat: 35.7148,
    lng: 139.7967,
    rating: 4.5,
    reviewCount: 42000,
    priceLevel: 1,
  },
  {
    cityKey: 'tokyo',
    city: 'Tokyo',
    country: 'Japan',
    placeName: '東京スカイツリー',
    area: '押上',
    category: 'sightseeing',
    lat: 35.7101,
    lng: 139.8107,
    rating: 4.4,
    reviewCount: 38000,
    priceLevel: 2,
  },
  {
    cityKey: 'tokyo',
    city: 'Tokyo',
    country: 'Japan',
    placeName: '築地場外市場',
    area: '築地',
    category: 'food',
    lat: 35.6654,
    lng: 139.7707,
    rating: 4.3,
    reviewCount: 21000,
    priceLevel: 2,
  },
  {
    cityKey: 'tokyo',
    city: 'Tokyo',
    country: 'Japan',
    placeName: 'ブルーボトルコーヒー 清澄白河',
    area: '清澄白河',
    category: 'cafe',
    lat: 35.6825,
    lng: 139.7986,
    rating: 4.3,
    reviewCount: 4500,
    priceLevel: 2,
  },
  {
    cityKey: 'osaka',
    city: 'Osaka',
    country: 'Japan',
    placeName: '大阪城',
    area: '大阪城',
    category: 'sightseeing',
    lat: 34.6873,
    lng: 135.5262,
    rating: 4.4,
    reviewCount: 33000,
    priceLevel: 1,
  },
  {
    cityKey: 'osaka',
    city: 'Osaka',
    country: 'Japan',
    placeName: '道頓堀',
    area: '道頓堀',
    category: 'food',
    lat: 34.6687,
    lng: 135.5013,
    rating: 4.5,
    reviewCount: 29000,
    priceLevel: 2,
  },
  {
    cityKey: 'osaka',
    city: 'Osaka',
    country: 'Japan',
    placeName: '黒門市場',
    area: '日本橋',
    category: 'food',
    lat: 34.6654,
    lng: 135.5068,
    rating: 4.3,
    reviewCount: 9800,
    priceLevel: 2,
  },
  {
    cityKey: 'osaka',
    city: 'Osaka',
    country: 'Japan',
    placeName: 'カフェ・ド・ランブル 梅田',
    area: '梅田',
    category: 'cafe',
    lat: 34.7024,
    lng: 135.4959,
    rating: 4.1,
    reviewCount: 2200,
    priceLevel: 2,
  },
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rowToCandidate(row: MockSeedRow): PlaceCandidate {
  return {
    placeId: `mock:${row.cityKey}:${slugify(row.placeName)}`,
    placeName: row.placeName,
    coordinates: { lat: row.lat, lng: row.lng },
    rating: row.rating,
    reviewCount: row.reviewCount,
    priceLevel: row.priceLevel,
    openingHours: row.openingHours ?? { isOpenNow: true },
    mapsUrl: buildGoogleMapsPlaceUrl(row.lat, row.lng, row.placeName),
    bookingUrl: null,
    category: row.category,
    area: row.area,
    city: row.city,
    country: row.country,
    source: 'seed',
    confidence: 'high',
  };
}

/** 固定 mock 候補プール（ソウル・大阪・東京）。 */
export const MOCK_PLACE_CANDIDATES: readonly PlaceCandidate[] = MOCK_SEED_ROWS.map(rowToCandidate);

export function getMockCandidatesForQuery(query: PlaceSearchQueryLike): PlaceCandidate[] {
  const label = `${query.destinationLabel} ${query.city ?? ''} ${query.country ?? ''}`.toLowerCase();

  if (label.includes('seoul') || label.includes('ソウル') || label.includes('korea') || label.includes('韓国')) {
    return MOCK_PLACE_CANDIDATES.filter((candidate) => candidate.city === 'Seoul');
  }
  if (label.includes('tokyo') || label.includes('東京')) {
    return MOCK_PLACE_CANDIDATES.filter((candidate) => candidate.city === 'Tokyo');
  }
  if (label.includes('osaka') || label.includes('大阪')) {
    return MOCK_PLACE_CANDIDATES.filter((candidate) => candidate.city === 'Osaka');
  }

  return [...MOCK_PLACE_CANDIDATES];
}

export type { PlaceSearchQueryLike } from './mock-places-query';
