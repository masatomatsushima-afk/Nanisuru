import type { TripDurationOption } from '@/types/plan';

export type CustomTripDuration = {
  nights: number;
  days: number;
};

export type TripScheduleEditorValue = {
  departureDate: string;
  returnDate: string;
  durationPreset: TripDurationOption;
  customNights: string;
  customDays: string;
};

export type ResolvedTripSchedule = {
  departureDate: string;
  returnDate: string;
  durationPreset: TripDurationOption;
  customDuration?: CustomTripDuration;
  durationLabel: string;
  dayCount: number;
};
