import type { CurrencyCode } from '@/constants/currency';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';
import type { PlanCopyMetadata } from '@/types/plan-copy';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { TravelBudgetIncludeOption } from '@/lib/travel-budget-includes';
import type { CustomTripDuration } from '@/types/trip-schedule';

export type SavedTripPayload = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  customDuration?: CustomTripDuration;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
  copyMetadata?: PlanCopyMetadata;
  customPreferences?: PlanCustomPreferences;
  notes?: string;
  budgetIncludes?: TravelBudgetIncludeOption[];
  travelPurpose?: string;
  /** ISO timestamp — set on first save */
  savedAt?: string;
  /** ISO timestamp — updated on each save */
  updatedAt?: string;
};

export type SavedTrip = {
  id: string;
  userId: string;
  title: string;
  payload: SavedTripPayload;
  createdAt: string;
};

export type CreateSavedTripInput = SavedTripPayload;
