import { getTripById, getUserTrips, updateTrip } from '@/lib/saved-trips';
import type { ItineraryItem } from '@/types/plan';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';

export const LOCAL_GEM_TIME_SLOTS = ['10:00', '12:00', '15:00', '18:00', '20:00'] as const;

export type AddLocalGemToPlanInput = {
  gemId: string;
  spot: LocalHiddenSpot;
  tripId: string;
  dayIndex: number;
  timeSlot: string;
};

export async function listSavedTripsForGemPlan() {
  return getUserTrips();
}

export async function addLocalGemToSavedTrip(input: AddLocalGemToPlanInput): Promise<void> {
  console.log('[LocalGems] add to plan', {
    gemId: input.gemId,
    planId: input.tripId,
    dayIndex: input.dayIndex,
  });

  const trip = await getTripById(input.tripId);
  if (!trip) {
    throw new Error('プランが見つかりません');
  }

  const days = [...(trip.payload.days ?? [])];
  if (days.length === 0) {
    throw new Error('このプランには日程がありません');
  }

  const day = days[input.dayIndex];
  if (!day) {
    throw new Error('選択した日が見つかりません');
  }

  const newItem: ItineraryItem = {
    time: input.timeSlot,
    activity: input.spot.name,
    placeAddress: input.spot.area,
    placeCategory: input.spot.category,
    reason: `ローカルの穴場: ${input.spot.description.slice(0, 100)}`,
  };

  days[input.dayIndex] = {
    ...day,
    items: [...day.items, newItem],
  };

  await updateTrip(input.tripId, {
    ...trip.payload,
    days,
  });
}
