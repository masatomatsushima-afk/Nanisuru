import type { CurrencyCode } from '@/constants/currency';
import type {
  CompanionOption,
  ItineraryDay,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';

export type ActiveTripContext = {
  title: string;
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  days: ItineraryDay[];
  details: PlanDetails;
  updatedAt: string;
};

import type { ItineraryEditProposal } from '@/types/itinerary-edit';

export type SecretaryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  editProposal?: ItineraryEditProposal;
};

export const SECRETARY_QUICK_PROMPTS = [
  '雨が降ってきた',
  '予算を減らしたい',
  '近くのおすすめは？',
  'プランを変更したい',
  '子供向けにしたい',
] as const;
