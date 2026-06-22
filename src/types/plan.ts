import type { CurrencyCode } from '@/constants/currency';

export type ItineraryItem = {
  time: string;
  activity: string;
  reason?: string;
  estimatedCost?: string;
  transportation?: string;
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

export const TRIP_DURATION_OPTIONS = ['半日', '1日', '2泊3日', '3泊4日', '1週間'] as const;
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

export type PlanDetails = {
  totalBudget: string;
  duration: string;
  tripDuration?: TripDurationOption;
  plannerMessage?: string;
  highlights: string[];
  rainyDayAlternatives: string[];
  aiAdvice?: AiAdvice;
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
