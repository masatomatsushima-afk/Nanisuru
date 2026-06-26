import type { CurrencyCode } from '@/constants/currency';
import type { PlacesDataSource } from '@/types/nearby-places';
import type { BudgetScopeSettings } from '@/types/budget-scope';
import type { PreTripPlanningData } from '@/types/pre-trip';
import type { CustomTripDuration } from '@/types/trip-schedule';
import type { TourSuggestion, TravelTimingSettings } from '@/types/travel-timing';
import type { OutfitPackingAdvice, OutfitStyleMode } from '@/types/outfit-advice';

export type { TourSuggestion, TravelTimingSettings } from '@/types/travel-timing';
export type { OutfitPackingAdvice, OutfitStyleMode } from '@/types/outfit-advice';

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

export type WeatherDayForecast = {
  date: string;
  label: string;
  condition: string;
  category: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'snow';
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  preferIndoor: boolean;
  preferOutdoor: boolean;
  summary: string;
};

export type WeatherForecast = {
  locationName: string;
  days: WeatherDayForecast[];
  summary: string;
  hasRainExpected: boolean;
  isMostlySunny: boolean;
};

export type PlanDetails = {
  totalBudget: string;
  budgetBreakdown?: BudgetBreakdown;
  duration: string;
  tripDuration?: TripDurationOption;
  tripDate?: string;
  tripEndDate?: string;
  customDuration?: CustomTripDuration;
  weather?: WeatherForecast;
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
