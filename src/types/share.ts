import type { CurrencyCode } from '@/constants/currency';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';

import type { CustomTripDuration } from '@/types/trip-schedule';

export type SharedTripPayload = {
  location: string;
  budget?: string;
  currency?: CurrencyCode;
  people?: string;
  mood?: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  customDuration?: CustomTripDuration;
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
  customDuration?: CustomTripDuration;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
};
