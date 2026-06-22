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

export const PERSONALITY_OPTIONS = ['冒険家', 'グルメ', 'のんびり', '映え重視', '穴場好き'] as const;
export type PersonalityOption = (typeof PERSONALITY_OPTIONS)[number];

export type { CurrencyCode };

export type PlanDetails = {
  totalBudget: string;
  duration: string;
  plannerMessage?: string;
  highlights: string[];
  rainyDayAlternatives: string[];
};

export type PlanParams = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  companion: CompanionOption;
  personality?: PersonalityOption;
  items: ItineraryItem[];
  details?: PlanDetails;
};
