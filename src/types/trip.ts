import type { CurrencyCode } from '@/constants/currency';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';

export type SavedTripPayload = {
  location: string;
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

export type SavedTrip = {
  id: string;
  userId: string;
  title: string;
  payload: SavedTripPayload;
  createdAt: string;
};

export type CreateSavedTripInput = SavedTripPayload;
