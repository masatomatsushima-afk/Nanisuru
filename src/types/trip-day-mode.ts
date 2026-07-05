import type { ItineraryItem } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';

export type TripDayScheduleStatus = 'before_first' | 'in_progress' | 'after_last';

export type TripDayDelayOption = {
  id: string;
  label: string;
  minutes: number;
};

export const TRIP_DAY_DELAY_OPTIONS: TripDayDelayOption[] = [
  { id: '15', label: '15分遅れ', minutes: 15 },
  { id: '30', label: '30分遅れ', minutes: 30 },
  { id: '60', label: '1時間遅れ', minutes: 60 },
  { id: 'more', label: 'それ以上', minutes: 120 },
];

export type TripDayScheduleSnapshot = {
  status: TripDayScheduleStatus;
  dayIndex: number;
  currentItem: ItineraryItem | null;
  nextItem: ItineraryItem | null;
  currentIndex: number | null;
  nextIndex: number | null;
  effectiveNowMinutes: number;
};

export type TripDayModeAssistantContext = {
  currentItem: { time: string; activity: string; category?: string } | null;
  nextItem: { time: string; activity: string; movementNote?: string } | null;
  currentTime: string;
  delayMinutes: number;
  scheduleStatus: TripDayScheduleStatus;
  dayLabel: string;
};

export type TripDayDelayPreviewSuccess = {
  success: true;
  beforePayload: SavedTripPayload;
  afterPayload: SavedTripPayload;
  dayIndex: number;
  changeSummary: string;
  changePoints: string[];
};

export type TripDayDelayPreviewFailure = {
  success: false;
  errorMessage: string;
};

export type TripDayDelayPreview = TripDayDelayPreviewSuccess | TripDayDelayPreviewFailure;
