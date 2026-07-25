import type { CurrencyCode } from '@/constants/currency';
import type { PlacesDataSource } from '@/types/nearby-places';
import type { BudgetScopeSettings } from '@/types/budget-scope';
import type { PreTripPlanningData } from '@/types/pre-trip';
import type { CustomTripDuration } from '@/types/trip-schedule';
import type { TourSuggestion, TravelTimingSettings } from '@/types/travel-timing';
import type { OutfitPackingAdvice, OutfitStyleMode } from '@/types/outfit-advice';
import type { SpotCandidate, SpotCandidateSource } from '@/types/spot-candidate';

export type { SpotCandidate, SpotCandidateSource } from '@/types/spot-candidate';

export type ConciergeAnalysis = {
  userPreferences: string;
  weather: string;
  budget: string;
  tripDuration: string;
  travelStyle: string;
  overallStrategy: string;
};

export type ItineraryItem = {
  time: string;
  activity: string;
  activityCategory?: string;
  placeAddress?: string;
  placeCategory?: string;
  reason?: string;
  estimatedCost?: string;
  transportation?: string;
  reservationUrl?: string;
  websiteUrl?: string;
  travelTimeToNext?: string;
  weatherBackup?: string;
  /** Short supplementary note (e.g. transport/caution) — used by the lightweight MVP plan flow. */
  note?: string;
  /**
   * Destination-scoped Google Maps search query (e.g. "Gwangjang Market Seoul Korea"). Always
   * includes the trip destination so map/direction links never resolve near the device's current
   * location instead of the actual travel destination.
   */
  mapsQuery?: string;
  /** Destination-scoped query for Instagram/TikTok/Google image search. Falls back to mapsQuery when absent. */
  socialQuery?: string;
  /**
   * True when this item names a real, specific place (safe to open in Maps / get directions to).
   * False for abstract items (e.g. "地元の市場散策") where a map pin would be misleading.
   */
  isSpecificPlace?: boolean;
  /** The specific real venue/area name alone (e.g. "広蔵市場"), distinct from `activity` which is the full phrase (e.g. "広蔵市場でローカルグルメ"). */
  placeName?: string;
  /** Broad place type — used to keep generated spots and their activity phrasing consistent (e.g. never "夜景スポットでカフェ"). */
  category?: 'food' | 'cafe' | 'sightseeing' | 'shopping' | 'nightlife' | 'activity';
  /** Rough popularity framing so a plan mixes well-known spots with local/hidden-gem picks instead of only tourist staples. */
  popularityType?: 'popular' | 'hidden_gem' | 'local' | 'classic' | 'fallback';
  /** How confident the source (AI or fallback) is that this is a real, correctly-named place. Low confidence should read as an area, not an invented venue name. */
  confidence?: 'high' | 'medium' | 'low';
  /** Where this spot name came from — future Google Places API will set `google_places_later`. */
  source?: SpotCandidateSource;
  /** Concrete place candidates (today usually one; later populated from Google Places API). */
  spotCandidates?: SpotCandidate[];
  /** Reserved for Google Places API — null in MVP. */
  placeId?: string | null;
  /**
   * Lat/lng from a confirmed Google Places candidate (or trusted geocode).
   * Never invent — leave unset when unknown. Prefer `coordinates` object.
   */
  coordinates?: { latitude: number; longitude: number } | null;
  /** @deprecated Prefer `coordinates` — kept for older payloads / partial merges. */
  latitude?: number | null;
  /** @deprecated Prefer `coordinates` — kept for older payloads / partial merges. */
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
};

export const COMPANION_OPTIONS = ['一人', '友達', 'カップル', '初デート', '家族'] as const;
export type CompanionOption = (typeof COMPANION_OPTIONS)[number];

export const DATE_RELATED_COMPANIONS = ['カップル', '初デート'] as const;

export function isDateRelatedCompanion(
  companion: CompanionOption,
): companion is (typeof DATE_RELATED_COMPANIONS)[number] {
  return companion === 'カップル' || companion === '初デート';
}

export const PERSONALITY_OPTIONS = ['冒険家', 'グルメ', 'のんびり', '映え重視', '穴場好き'] as const;
export type PersonalityOption = (typeof PERSONALITY_OPTIONS)[number];

export const TRIP_DURATION_OPTIONS = [
  '半日',
  '1日',
  '1泊2日',
  '2泊3日',
  '3泊4日',
  '1週間',
  'その他',
] as const;
export type TripDurationOption = (typeof TRIP_DURATION_OPTIONS)[number];

export type ItineraryDay = {
  dayNumber: number;
  label: string;
  theme: string;
  items: ItineraryItem[];
  /** Active time range for the day, e.g. "15:00〜22:00" — used by the lightweight MVP plan flow. */
  timeWindow?: string;
  /** ISO-ish date string for the day, when known. */
  date?: string;
};

export type { CurrencyCode };

export type AiAdvice = {
  conversationTips: string[];
  recommendedTopics: string[];
  topicsToAvoid: string[];
};

export type BudgetCustomLineItem = {
  label: string;
  amount: string;
};

export type BudgetBreakdown = {
  total: string;
  food?: string;
  cafe?: string;
  activity?: string;
  transportation?: string;
  accommodation?: string;
  flight?: string;
  rail?: string;
  rentalCar?: string;
  shopping?: string;
  souvenirs?: string;
  contingency?: string;
  customItems?: BudgetCustomLineItem[];
};

export type WeatherDayForecast = import('@/lib/weather').WeatherDayForecast;
export type WeatherForecast = import('@/lib/weather').WeatherForecast;
export type SeasonalWeatherContext = import('@/lib/weather').SeasonalWeatherContext;
export type WeatherPlanningMode = import('@/lib/weather').WeatherPlanningMode;

export type PlanDetails = {
  totalBudget: string;
  budgetBreakdown?: BudgetBreakdown;
  duration: string;
  tripDuration?: TripDurationOption;
  tripDate?: string;
  tripEndDate?: string;
  customDuration?: CustomTripDuration;
  weather?: WeatherForecast;
  /**
   * Full WeatherContext used during plan generation (Open-Meteo / Google).
   * Kept so weather replan can reuse the same forecast shown on Plan Detail.
   */
  weatherContext?: import('@/types/weather-context').WeatherContext;
  plannerMessage?: string;
  conciergeAnalysis?: ConciergeAnalysis;
  highlights: string[];
  rainyDayAlternatives: string[];
  aiAdvice?: AiAdvice;
  placesNotice?: string;
  placesSource?: PlacesDataSource;
  budgetScope?: BudgetScopeSettings;
  preTripPlanning?: PreTripPlanningData;
  travelTiming?: TravelTimingSettings;
  tourSuggestions?: TourSuggestion[];
  outfitAdvice?: OutfitPackingAdvice;
  /** Points changed during weather-based replanning. */
  weatherReplanChanges?: string[];
  /** Specific AI-generated title, e.g. "韓国2泊3日グルメ旅行" — used by the lightweight MVP plan flow. */
  planTitle?: string;
  /** 1-2 sentence trip summary — used by the lightweight MVP plan flow. */
  summary?: string;
  /** True when this plan was generated by a dev/timeout fallback instead of a real AI response. */
  isFallback?: boolean;
  /** User-entered accommodation hub (hotel name or area) — optional MVP text input. */
  accommodation?: string;
  accommodationName?: string;
  accommodationArea?: string;
  accommodationNote?: string;
  /** Structured destination detail fields shown on Plan Detail. */
  country?: string;
  city?: string;
  baseArea?: string;
  arrivalPoint?: string;
  destinationLabel?: string;
};

export type PlanParams = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  companion: CompanionOption;
  personality?: PersonalityOption;
  tripDuration?: TripDurationOption;
  days?: ItineraryDay[];
  items: ItineraryItem[];
  details?: PlanDetails;
};

export type SavedFavorite = {
  id: string;
  title: string;
  location: string;
  createdAt: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
};
