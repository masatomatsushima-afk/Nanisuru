/**
 * Pure, dependency-free day-sizing helpers shared by the OpenAI prompt/schema, the
 * post-generation schedule validator, and the Google Places fallback plan builder.
 *
 * Intentionally has ZERO imports from itinerary-quality.ts / plan-generation-log.ts / etc. —
 * those transitively pull in react-native (via plan-creation -> custom-preferences ->
 * @react-native-async-storage), which breaks Node-based verify scripts. Keeping this module
 * standalone lets the day-sizing logic (the fix for the "day 3 = 1 item at 17:00" bug) be
 * unit-tested directly with tsx/Node.
 */

import type { TravelTimingPlaceType, TravelTimingSettings } from '@/types/travel-timing';

export function parseTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatMinutesAsTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function departureBufferMinutes(place?: TravelTimingPlaceType): number {
  switch (place) {
    case '空港':
      return 180;
    case '駅':
      return 60;
    case 'ホテル':
      return 30;
    default:
      return 90;
  }
}

export function getEarliestActivityStartMinutes(timing?: TravelTimingSettings | null): number | null {
  if (!timing?.arrivalTime?.trim()) return null;

  const arrival = parseTimeToMinutes(timing.arrivalTime);
  if (arrival == null) return null;

  const checkIn = timing.hotelCheckInTime?.trim()
    ? parseTimeToMinutes(timing.hotelCheckInTime)
    : parseTimeToMinutes('15:00');

  const readyAfterArrival = arrival + 90;
  const readyAfterCheckIn =
    checkIn != null && arrival <= checkIn ? checkIn + 60 : readyAfterArrival;

  return Math.max(readyAfterArrival, readyAfterCheckIn);
}

export function getLatestActivityEndMinutes(timing?: TravelTimingSettings | null): number | null {
  if (!timing?.departureTime?.trim()) return null;

  const departure = parseTimeToMinutes(timing.departureTime);
  if (departure == null) return null;

  return departure - departureBufferMinutes(timing.departurePlace);
}

/** Safe default day window used whenever no arrival/departure/daily start-end constraint is set. */
export const DEFAULT_DAY_WINDOW_START_MINUTES = 9 * 60; // 09:00
export const DEFAULT_DAY_WINDOW_END_MINUTES = 21 * 60; // 21:00

/**
 * How many usable minutes a given day actually has, derived from arrivalTime/departureTime/
 * dailyStartTime/dailyEndTime — never a fixed per-day constant. Day 1 is clamped to start no
 * earlier than `getEarliestActivityStartMinutes`; the last day is clamped to end no later than
 * `getLatestActivityEndMinutes`. Falls back to the safe default day window (09:00–21:00) for any
 * bound that isn't set, so behavior is unchanged when the user never touched travel-timing.
 */
export function resolveDayAvailableMinutes(params: {
  dayIndex: number;
  totalDays: number;
  travelTiming?: TravelTimingSettings | null;
}): number {
  const { dayIndex, totalDays, travelTiming } = params;
  const isFirstDay = dayIndex === 0;
  const isLastDay = dayIndex === totalDays - 1;

  const dailyStart = travelTiming?.dailyStartTime?.trim()
    ? parseTimeToMinutes(travelTiming.dailyStartTime)
    : null;
  const dailyEnd = travelTiming?.dailyEndTime?.trim() ? parseTimeToMinutes(travelTiming.dailyEndTime) : null;

  let start = dailyStart ?? DEFAULT_DAY_WINDOW_START_MINUTES;
  let end = dailyEnd ?? DEFAULT_DAY_WINDOW_END_MINUTES;

  if (isFirstDay) {
    const earliest = getEarliestActivityStartMinutes(travelTiming);
    if (earliest != null) start = Math.max(start, earliest);
  }
  if (isLastDay) {
    const latest = getLatestActivityEndMinutes(travelTiming);
    if (latest != null) end = Math.min(end, latest);
  }

  return Math.max(0, end - start);
}

/**
 * Maps available minutes to a realistic item-count target — never a fixed count regardless of
 * time. Buckets roughly follow: short day → 1-2, half day → 2-3, near-full day → 3-5.
 */
export function resolveTargetItemCountForAvailableMinutes(availableMinutes: number): number {
  if (availableMinutes <= 0) return 0;
  if (availableMinutes <= 150) return 1;
  if (availableMinutes <= 300) return 2;
  if (availableMinutes <= 480) return 3;
  if (availableMinutes <= 660) return 4;
  return 5;
}

/** Convenience: available minutes → target item count for a specific day, in one call. */
export function resolveTargetItemCountForDay(params: {
  dayIndex: number;
  totalDays: number;
  travelTiming?: TravelTimingSettings | null;
}): { availableMinutes: number; targetItemCount: number } {
  const availableMinutes = resolveDayAvailableMinutes(params);
  return { availableMinutes, targetItemCount: resolveTargetItemCountForAvailableMinutes(availableMinutes) };
}
