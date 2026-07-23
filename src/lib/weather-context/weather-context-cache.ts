/**
 * Process-memory cache for WeatherContext.
 * TTL constant; cleared on server restart. Cache key never includes API keys.
 */

import type { WeatherContext, WeatherProviderId } from '@/types/weather-context';
import {
  WEATHER_CACHE_COORD_DECIMALS,
  WEATHER_CONTEXT_CACHE_TTL_MS,
} from './weather-context-constants';

type CacheEntry = {
  expiresAt: number;
  value: WeatherContext;
};

const store = new Map<string, CacheEntry>();

export function buildWeatherCacheKey(params: {
  provider: Exclude<WeatherProviderId, 'none'> | string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
}): string {
  const lat = params.latitude.toFixed(WEATHER_CACHE_COORD_DECIMALS);
  const lng = params.longitude.toFixed(WEATHER_CACHE_COORD_DECIMALS);
  return `${params.provider}|${lat},${lng}|${params.startDate}|${params.endDate}`;
}

export function getWeatherCache(key: string, nowMs = Date.now()): WeatherContext | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setWeatherCache(
  key: string,
  value: WeatherContext,
  nowMs = Date.now(),
  ttlMs = WEATHER_CONTEXT_CACHE_TTL_MS,
): void {
  store.set(key, { expiresAt: nowMs + ttlMs, value });
}

/** Test helper — clears in-memory cache. */
export function clearWeatherCacheForTests(): void {
  store.clear();
}

export function weatherCacheSizeForTests(): number {
  return store.size;
}
