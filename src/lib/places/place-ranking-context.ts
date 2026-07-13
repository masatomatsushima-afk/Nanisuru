import type { PlaceCategory } from '@/lib/destination-safety';

/** 候補フィルタ・ランキング共通のコンテキスト。 */
export type PlaceRankingContext = {
  destinationLabel: string;
  city?: string;
  country?: string;
  baseArea?: string;
  accommodation?: string;
  categories?: PlaceCategory[];
  coordinates?: { lat: number; lng: number };
  /** true のとき営業時間外候補を下げる。 */
  preferOpenNow?: boolean;
};
