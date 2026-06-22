import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SavedFavorite } from '@/types/plan';
import type { CompanionOption, ItineraryDay, PersonalityOption, PlanDetails, PlanParams, TripDurationOption } from '@/types/plan';
import { TRIP_DURATION_OPTIONS } from '@/types/plan';
import { flattenItineraryDays } from '@/lib/trip-duration';

const FAVORITES_KEY = 'nanisuru_favorites';

export function buildFavoriteTitle(
  location: string,
  personality: PersonalityOption,
  companion: CompanionOption,
  tripDuration?: string,
): string {
  const place = location.trim() || 'お出かけ';
  const durationPart = tripDuration ? `${tripDuration}・` : '';
  return `${place}・${durationPart}${personality}の${companion}プラン`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readFavorites(): Promise<SavedFavorite[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SavedFavorite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFavorites(favorites: SavedFavorite[]): Promise<void> {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export async function getFavorites(): Promise<SavedFavorite[]> {
  const favorites = await readFavorites();
  return favorites.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function saveFavorite(
  input: PlanParams & {
    personality: PersonalityOption;
    tripDuration: TripDurationOption;
    days: ItineraryDay[];
    details: PlanDetails;
  },
): Promise<SavedFavorite> {
  const favorite: SavedFavorite = {
    id: generateId(),
    title: buildFavoriteTitle(
      input.location,
      input.personality,
      input.companion,
      input.tripDuration,
    ),
    location: input.location.trim() || '未指定',
    createdAt: new Date().toISOString(),
    budget: input.budget,
    currency: input.currency,
    people: input.people,
    mood: input.mood,
    companion: input.companion,
    personality: input.personality,
    tripDuration: input.tripDuration,
    days: input.days,
    items: input.items.length > 0 ? input.items : flattenItineraryDays(input.days),
    details: input.details,
  };

  const favorites = await readFavorites();
  favorites.unshift(favorite);
  await writeFavorites(favorites);
  return favorite;
}

export async function deleteFavorite(id: string): Promise<void> {
  const favorites = await readFavorites();
  await writeFavorites(favorites.filter((item) => item.id !== id));
}

export function formatFavoriteDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function favoriteToPlanParams(favorite: SavedFavorite) {
  const days =
    favorite.days?.length > 0
      ? favorite.days
      : [{ dayNumber: 1, label: '1日目', theme: '', items: favorite.items }];

  return {
    location: favorite.location,
    budget: favorite.budget,
    currency: favorite.currency,
    people: favorite.people,
    mood: favorite.mood,
    companion: favorite.companion,
    personality: favorite.personality,
    tripDuration: favorite.tripDuration ?? TRIP_DURATION_OPTIONS[1],
    days: JSON.stringify(days),
    items: JSON.stringify(favorite.items),
    details: JSON.stringify(favorite.details),
  };
}
