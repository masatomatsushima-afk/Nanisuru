import type { CurrencyCode } from '@/constants/currency';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';

export type SharedTripPayload = {
  location: string;
  budget?: string;
  currency?: CurrencyCode;
  people?: string;
  mood?: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
};

export type SharedTrip = {
  id: string;
  title: string;
  payload: SharedTripPayload;
  createdAt: string;
};

export type CreateSharedTripInput = SharedTripPayload;

export type ShareTripInput = {
  location: string;
  budget?: string;
  currency?: CurrencyCode;
  people?: string;
  mood?: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
};
