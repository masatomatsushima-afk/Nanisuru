/**
 * Google Places API (New) 連携の将来設計用の型です。
 * 設計のみ — この型を返す実通信はまだ実装しません。
 * 詳細: docs/GOOGLE_PLACES_INTEGRATION_PLAN.md
 */

import type { PlaceCategory, PopularityType } from '@/lib/destination-safety';

/** どこから来た候補か。Places 実装後も `SpotCandidateSource`（既存）とは別軸で管理する。 */
export type PlaceCandidateSource = 'google_places' | 'seed' | 'fallback';

/** Soft venue setting for weather-fit ranking. Prefer explicit; never invent from place names. */
export type PlaceVenueSetting = 'indoor' | 'outdoor' | 'mixed';

export type PlaceCoordinates = {
  lat: number;
  lng: number;
};

export type PlacePhotoRef = {
  /** Place Photos API から生成される参照URL（将来、media取得後）。未取得時は空文字。 */
  url: string;
  /** Google Places の photo resource name（例: "places/ChIJ.../photos/AeJ..."）。まだ media は取得しない。 */
  name?: string;
  attribution?: string;
};

export type PlaceOpeningHours = {
  isOpenNow?: boolean | null;
  /** 人間が読める形式（例: ["月曜: 09:00–18:00", ...]）。 */
  weekdayText?: string[];
};

/**
 * 1店舗（実在スポット）分の候補データ。
 * 将来 `PlacesProvider` がこの型の配列を返し、AI が「明洞で韓国料理」ではなく
 * 「明洞餃子」のように1店舗まで絞って提案できるようにするための入れ物。
 */
export type PlaceCandidate = {
  /** Google Place ID（不変キー）。将来 API 実装で必須になる。 */
  placeId: string;
  /** 店舗名。 */
  placeName: string;
  /** 緯度経度。 */
  coordinates?: PlaceCoordinates | null;
  /** 評価（Google レビュー平均）。 */
  rating?: number | null;
  /** レビュー数。 */
  reviewCount?: number | null;
  /** 価格帯（Google Places の priceLevel: 0–4 相当）。 */
  priceLevel?: number | null;
  /** 営業時間。 */
  openingHours?: PlaceOpeningHours | null;
  /** 写真（将来 Place Photos API 由来）。 */
  photos?: PlacePhotoRef[];
  /** Google Maps のディープリンク URL。 */
  mapsUrl?: string | null;
  /** 予約URL（あれば。無ければ null/undefined のまま扱う）。 */
  bookingUrl?: string | null;
  /** ジャンル（食事・カフェ・観光など）。既存 destination-safety の分類を再利用。 */
  category?: PlaceCategory;
  /** 人気度の種別（人気・隠れた名所・地元向け等）。既存 destination-safety の分類を再利用。 */
  popularityType?: PopularityType;
  /**
   * Optional indoor/outdoor setting when known from Places metadata.
   * Do not invent from place names — leave unset and let category heuristics stay conservative.
   */
  venueSetting?: PlaceVenueSetting;
  address?: string;
  area?: string;
  city?: string;
  country?: string;
  source: PlaceCandidateSource;
  confidence?: 'high' | 'medium' | 'low';
};
