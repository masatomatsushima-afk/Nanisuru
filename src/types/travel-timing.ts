export const TRAVEL_TIMING_PLACE_OPTIONS = [
  '空港',
  '駅',
  'ホテル',
  '市内中心部',
  'その他',
] as const;

export type TravelTimingPlaceType = (typeof TRAVEL_TIMING_PLACE_OPTIONS)[number];

export type TravelTimingSettings = {
  arrivalTime?: string;
  arrivalPlace?: TravelTimingPlaceType;
  arrivalPlaceDetail?: string;
  departureTime?: string;
  departurePlace?: TravelTimingPlaceType;
  departurePlaceDetail?: string;
  hotelCheckInTime?: string;
  dailyStartTime?: string;
  dailyEndTime?: string;
};

export type TourSuggestion = {
  dayNumber?: number;
  title: string;
  description: string;
  needsBooking?: boolean;
};

export function createDefaultTravelTiming(): TravelTimingSettings {
  return {
    hotelCheckInTime: '15:00',
    dailyStartTime: '09:00',
    dailyEndTime: '21:00',
  };
}

export function hasTravelTimingConstraints(timing?: TravelTimingSettings | null): boolean {
  if (!timing) return false;
  return Boolean(
    timing.arrivalTime?.trim() ||
      timing.departureTime?.trim() ||
      timing.hotelCheckInTime?.trim() ||
      timing.dailyStartTime?.trim() ||
      timing.dailyEndTime?.trim(),
  );
}
