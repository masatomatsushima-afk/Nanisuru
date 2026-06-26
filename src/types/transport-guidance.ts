export const TRANSPORT_MODE_OPTIONS = [
  'walking',
  'transit',
  'driving',
  'taxi',
] as const;

export type TransportMode = (typeof TRANSPORT_MODE_OPTIONS)[number];

export type TransportModeLabel =
  | '徒歩'
  | '電車・バス'
  | '車'
  | 'タクシー'
  | 'AIおすすめ';

export const TRANSPORT_MODE_LABELS: Record<TransportMode, TransportModeLabel> = {
  walking: '徒歩',
  transit: '電車・バス',
  driving: '車',
  taxi: 'タクシー',
};

export type TransportGuidanceContext = {
  location?: string;
  weather?: import('@/types/plan').WeatherForecast;
  travelTiming?: import('@/types/travel-timing').TravelTimingSettings;
  companion?: import('@/types/plan').CompanionOption;
  budget?: string;
};

export type TransportRecommendation = {
  recommendedMode: TransportMode;
  recommendationText: string;
  estimatedMinutes: number | null;
  distanceLabel: string | null;
};

export type DayRouteNote = {
  label: string;
  detail?: string;
};

export type TransportLinkOption = {
  mode: TransportMode;
  label: string;
  openLabel: string;
  url: string;
};
