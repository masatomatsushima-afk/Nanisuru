import { getTodayIsoDate } from '@/lib/weather';
import type { SavedTrip } from '@/types/trip';
import type { ItineraryMemorySlot, TripMemoryMedia } from '@/types/trip-memory';

export type TripMemoryDayGroup = {
  dayNumber: number;
  dayLabel: string;
  items: Array<{
    slotLabel: string;
    slotTime: string;
    slotActivity: string;
    media: TripMemoryMedia[];
  }>;
};

export function buildItinerarySlotFromIndices(
  trip: SavedTrip,
  dayIndex: number,
  itemIndex: number,
): ItineraryMemorySlot | null {
  const day = trip.payload.days[dayIndex];
  const item = day?.items[itemIndex];
  if (!day || !item) return null;

  return {
    dayIndex,
    itemIndex,
    dayNumber: day.dayNumber,
    dayLabel: day.label,
    time: item.time,
    activity: item.activity,
    placeName: item.placeAddress ?? item.activity,
  };
}

export function resolveTodayDayIndex(trip: SavedTrip): number {
  if (trip.payload.days.length <= 1) return 0;

  const tripStart = trip.payload.details.tripDate?.trim() || getTodayIsoDate();
  const today = getTodayIsoDate();
  const startMs = new Date(`${tripStart}T12:00:00`).getTime();
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const diffDays = Math.round((todayMs - startMs) / (24 * 60 * 60 * 1000));

  return Math.max(0, Math.min(diffDays, trip.payload.days.length - 1));
}

export function filterTodayMemories(trip: SavedTrip, media: TripMemoryMedia[]): TripMemoryMedia[] {
  const todayDayIndex = resolveTodayDayIndex(trip);
  const todayDay = trip.payload.days[todayDayIndex];
  if (!todayDay) return [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return media.filter((item) => {
    const created = new Date(item.createdAt);
    if (created >= todayStart && created <= todayEnd) return true;

    if (item.itineraryDayNumber === todayDay.dayNumber) return true;

    return false;
  });
}

export function filterNoteMemories(media: TripMemoryMedia[]): TripMemoryMedia[] {
  return media.filter((item) => item.mediaType === 'note');
}

export function filterFavoriteMemories(media: TripMemoryMedia[]): TripMemoryMedia[] {
  return media.filter((item) => item.isFavorite);
}

export function groupMemoriesByItineraryDay(
  media: TripMemoryMedia[],
  trip: SavedTrip,
): TripMemoryDayGroup[] {
  const groups: TripMemoryDayGroup[] = [];

  for (let dayIndex = 0; dayIndex < trip.payload.days.length; dayIndex += 1) {
    const day = trip.payload.days[dayIndex];
    const slotGroups: TripMemoryDayGroup['items'] = [];

    for (let itemIndex = 0; itemIndex < day.items.length; itemIndex += 1) {
      const itineraryItem = day.items[itemIndex];
      const matched = media.filter(
        (entry) =>
          entry.itineraryDayNumber === day.dayNumber &&
          entry.itineraryItemTime === itineraryItem.time &&
          entry.itineraryItemActivity === itineraryItem.activity,
      );

      if (matched.length > 0) {
        slotGroups.push({
          slotLabel: `${itineraryItem.time} ${itineraryItem.activity}`,
          slotTime: itineraryItem.time,
          slotActivity: itineraryItem.activity,
          media: matched,
        });
      }
    }

    const unlinkedForDay = media.filter(
      (entry) =>
        entry.itineraryDayNumber === day.dayNumber &&
        !day.items.some(
          (itineraryItem) =>
            entry.itineraryItemTime === itineraryItem.time &&
            entry.itineraryItemActivity === itineraryItem.activity,
        ),
    );

    if (unlinkedForDay.length > 0) {
      slotGroups.push({
        slotLabel: 'その他の思い出',
        slotTime: '',
        slotActivity: '',
        media: unlinkedForDay,
      });
    }

    if (slotGroups.length > 0) {
      groups.push({
        dayNumber: day.dayNumber,
        dayLabel: day.label,
        items: slotGroups,
      });
    }
  }

  const unlinked = media.filter((entry) => !entry.itineraryDayNumber);
  if (unlinked.length > 0) {
    groups.push({
      dayNumber: 0,
      dayLabel: 'その他',
      items: [
        {
          slotLabel: 'プラン外の思い出',
          slotTime: '',
          slotActivity: '',
          media: unlinked,
        },
      ],
    });
  }

  return groups;
}
