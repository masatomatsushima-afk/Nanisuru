import { parseTimeToMinutes } from '@/lib/itinerary-quality';
import { addDaysToIsoDate, getTodayIsoDate } from '@/lib/weather';
import type { ItineraryItem, WeatherForecast } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type {
  TripDayModeAssistantContext,
  TripDayScheduleSnapshot,
  TripDayScheduleStatus,
} from '@/types/trip-day-mode';

export function formatTripDayModeDate(date: Date = new Date()): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function formatCurrentTimeJa(date: Date = new Date()): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export function resolveTodayDayIndex(
  payload: SavedTripPayload,
  folderDepartureDate?: string | null,
): number {
  if (payload.days.length <= 1) return 0;

  const tripStart = folderDepartureDate?.trim() || payload.details.tripDate?.trim() || getTodayIsoDate();
  const today = getTodayIsoDate();
  const startMs = new Date(`${tripStart}T12:00:00`).getTime();
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const diffDays = Math.round((todayMs - startMs) / (24 * 60 * 60 * 1000));

  return Math.max(0, Math.min(diffDays, payload.days.length - 1));
}

export function getTodayIsoForDayIndex(
  payload: SavedTripPayload,
  dayIndex: number,
  folderDepartureDate?: string | null,
): string {
  const tripStart = folderDepartureDate?.trim() || payload.details.tripDate?.trim() || getTodayIsoDate();
  return addDaysToIsoDate(tripStart, dayIndex);
}

function getEffectiveNowMinutes(now: Date, delayMinutes: number): number {
  const realMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, realMinutes - delayMinutes);
}

export function resolveCurrentAndNextItems(
  items: ItineraryItem[],
  options?: { now?: Date; delayMinutes?: number },
): TripDayScheduleSnapshot {
  const now = options?.now ?? new Date();
  const delayMinutes = options?.delayMinutes ?? 0;
  const effectiveNowMinutes = getEffectiveNowMinutes(now, delayMinutes);

  if (!items.length) {
    return {
      status: 'before_first',
      dayIndex: 0,
      currentItem: null,
      nextItem: null,
      currentIndex: null,
      nextIndex: null,
      effectiveNowMinutes,
    };
  }

  const timed = items.map((item, index) => ({
    item,
    index,
    minutes: parseTimeToMinutes(item.time),
  }));

  const firstMinutes = timed.find((entry) => entry.minutes !== null)?.minutes ?? null;
  const lastMinutes = [...timed].reverse().find((entry) => entry.minutes !== null)?.minutes ?? null;

  let status: TripDayScheduleStatus = 'in_progress';
  if (firstMinutes !== null && effectiveNowMinutes < firstMinutes) {
    status = 'before_first';
  } else if (lastMinutes !== null && effectiveNowMinutes >= lastMinutes) {
    status = 'after_last';
  }

  let currentIndex: number | null = null;
  for (const entry of timed) {
    if (entry.minutes !== null && entry.minutes <= effectiveNowMinutes) {
      currentIndex = entry.index;
    }
  }

  let nextIndex: number | null = null;
  if (status === 'before_first') {
    nextIndex = timed.find((entry) => entry.minutes !== null)?.index ?? 0;
  } else if (currentIndex !== null && currentIndex + 1 < items.length) {
    nextIndex = currentIndex + 1;
  } else if (currentIndex === null && items.length > 0) {
    nextIndex = 0;
  }

  const currentItem = currentIndex !== null ? items[currentIndex] : null;
  const nextItem = nextIndex !== null ? items[nextIndex] : null;

  return {
    status,
    dayIndex: 0,
    currentItem,
    nextItem,
    currentIndex,
    nextIndex,
    effectiveNowMinutes,
  };
}

export function getWeatherNoteForItem(
  item: ItineraryItem,
  weather?: WeatherForecast,
): string | null {
  if (item.weatherBackup?.trim()) {
    return item.weatherBackup.trim();
  }

  if (!weather) return null;

  const category = weather.days?.[0]?.preferIndoor ? 'indoor' : weather.days?.[0]?.preferOutdoor ? 'outdoor' : null;
  if (category === 'indoor' && item.activityCategory && !['食事', 'カフェ', '文化', '買い物', '休憩'].includes(item.activityCategory)) {
    return '天候次第では屋内の代替案も検討できます';
  }

  if (weather.summary?.trim()) {
    return weather.summary.trim();
  }

  return null;
}

export function getSeasonalNote(weather?: WeatherForecast): string | null {
  if (!weather) return null;
  if (weather.seasonalContext?.guidance?.trim()) {
    return weather.seasonalContext.guidance.trim();
  }
  if (weather.summary?.trim()) {
    return weather.summary.trim();
  }
  return null;
}

export function buildTripDayModeAssistantContext(params: {
  snapshot: TripDayScheduleSnapshot;
  dayLabel: string;
  delayMinutes: number;
}): TripDayModeAssistantContext {
  const { snapshot, dayLabel, delayMinutes } = params;

  return {
    currentItem: snapshot.currentItem
      ? {
          time: snapshot.currentItem.time,
          activity: snapshot.currentItem.activity,
          category: snapshot.currentItem.activityCategory,
        }
      : null,
    nextItem: snapshot.nextItem
      ? {
          time: snapshot.nextItem.time,
          activity: snapshot.nextItem.activity,
          movementNote: snapshot.nextItem.transportation || snapshot.currentItem?.travelTimeToNext,
        }
      : null,
    currentTime: formatCurrentTimeJa(),
    delayMinutes,
    scheduleStatus: snapshot.status,
    dayLabel,
  };
}

export function buildTripDayModeTitle(
  payload: SavedTripPayload,
  tripTitle?: string | null,
): string {
  if (tripTitle?.trim()) return tripTitle.trim();
  return `${payload.location}の旅行`;
}
