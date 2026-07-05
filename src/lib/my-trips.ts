import { getUserTrips } from '@/lib/saved-trips';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchUserTripFolders } from '@/lib/trip-folders';
import { getTodayIsoDate } from '@/lib/weather';
import type { SavedTrip } from '@/types/trip';
import type { TripFolder } from '@/types/trip-folder';

export type MyTripsData = {
  savedPlans: SavedTrip[];
  tripFolders: TripFolder[];
};

export function countPlansInFolder(folder: TripFolder): number {
  let count = 0;
  if (folder.planPayload?.days?.length) count += 1;
  if (folder.savedTripId && !folder.planPayload?.days?.length) count += 1;
  return count;
}

export function getFolderWeatherNote(folder: TripFolder): string | null {
  const weather = folder.planPayload?.details?.weather;
  if (!weather) return null;

  if (weather.planningMode === 'seasonal') {
    const label = weather.seasonalContext?.monthLabel ?? weather.seasonalContext?.seasonLabel;
    if (label) return `季節傾向: ${label}`;
    return weather.planningMessage ?? '季節の傾向でプラン作成';
  }

  if (weather.planningMode === 'forecast') {
    return weather.summary?.trim() || '天気予報連動';
  }

  return weather.summary?.trim() || weather.planningMessage?.trim() || null;
}

export function isUpcomingTripFolder(folder: TripFolder): boolean {
  const today = getTodayIsoDate();
  if (folder.returnDate?.trim()) {
    return folder.returnDate >= today;
  }
  if (folder.departureDate?.trim()) {
    return folder.departureDate >= today;
  }
  return true;
}

export function sortTripFoldersByDeparture(folders: TripFolder[]): TripFolder[] {
  return [...folders].sort((a, b) => {
    const aKey = a.departureDate?.trim() || '9999-12-31';
    const bKey = b.departureDate?.trim() || '9999-12-31';
    return aKey.localeCompare(bKey);
  });
}

export function getUpcomingTripFolders(folders: TripFolder[]): TripFolder[] {
  return sortTripFoldersByDeparture(folders.filter(isUpcomingTripFolder));
}

export function formatPlanUpdatedAt(iso?: string | null): string {
  if (!iso?.trim()) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function loadMyTripsData(): Promise<MyTripsData> {
  console.log('[MyTrips] loading saved plans');

  if (!isSupabaseConfigured()) {
    console.warn('[MyTrips] Supabase is not configured — returning empty data');
    return { savedPlans: [], tripFolders: [] };
  }

  try {
    const [savedPlans, tripFolders] = await Promise.all([
      getUserTrips().catch((error) => {
        console.warn('[MyTrips] failed to load saved plans', error);
        return [] as SavedTrip[];
      }),
      fetchUserTripFolders().catch((error) => {
        console.warn('[MyTrips] failed to load trip folders', error);
        return [] as TripFolder[];
      }),
    ]);

    console.log('[MyTrips] saved plans', savedPlans);
    console.log('[MyTrips] trip folders', tripFolders);

    return { savedPlans, tripFolders };
  } catch (error) {
    console.warn('[MyTrips] load failed — using empty fallback', error);
    return { savedPlans: [], tripFolders: [] };
  }
}
