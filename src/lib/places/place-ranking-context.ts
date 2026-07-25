import type { PlaceCategory } from '@/lib/destination-safety';

/** Trip-level weather bias for Places ranking (from DailyWeatherModifier aggregate). */
export type PlaceWeatherFitContext = {
  preferIndoor: boolean;
  preferOutdoor: boolean;
  rainRisk: boolean;
  heatRisk: boolean;
  coldRisk: boolean;
};

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
  /** Weather fit — optional; omit when weatherAvailable=false. */
  weatherFit?: PlaceWeatherFitContext;
};
