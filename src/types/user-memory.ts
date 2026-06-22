import type { CurrencyCode } from '@/constants/currency';
import type { PersonalityOption, TripDurationOption } from '@/types/plan';

export type UserPreferences = {
  favoriteTravelStyle: PersonalityOption | null;
  budgetPreference: string | null;
  favoriteActivities: string[];
  preferredTripDuration: TripDurationOption | null;
  hasData: boolean;
};

export type StoredUserMemory = {
  travelStyleCounts: Partial<Record<PersonalityOption, number>>;
  tripDurationCounts: Partial<Record<TripDurationOption, number>>;
  budgetSamples: Array<{ amount: number; currency: CurrencyCode }>;
  activityCounts: Record<string, number>;
  updatedAt: string;
};
