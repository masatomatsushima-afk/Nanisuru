import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NearbyPlacesContext } from '@/types/nearby-places';

const CACHE_PREFIX = 'nanisuru:places:v1:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedPlacesEntry = {
  cachedAt: string;
  context: NearbyPlacesContext;
};

export function normalizeLocationKey(location: string): string {
  return location
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[、,./\\]/g, ' ');
}

function isCacheValid(cachedAt: string): boolean {
  const age = Date.now() - new Date(cachedAt).getTime();
  return age >= 0 && age < CACHE_TTL_MS;
}

export async function getCachedPlaces(locationKey: string): Promise<NearbyPlacesContext | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${locationKey}`);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CachedPlacesEntry;
    if (!isCacheValid(entry.cachedAt)) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${locationKey}`);
      return null;
    }

    return {
      ...entry.context,
      source: 'cache',
      notice: undefined,
    };
  } catch {
    return null;
  }
}

export async function setCachedPlaces(
  locationKey: string,
  context: NearbyPlacesContext,
): Promise<void> {
  try {
    const entry: CachedPlacesEntry = {
      cachedAt: new Date().toISOString(),
      context: {
        ...context,
        source: context.source ?? 'google',
        notice: undefined,
      },
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${locationKey}`, JSON.stringify(entry));
  } catch {
    // cache write failure is non-fatal
  }
}
