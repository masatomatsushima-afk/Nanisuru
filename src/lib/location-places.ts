import { searchPlacesForPlan } from '@/lib/google-places';
import { isGoogleMapsConfigured } from '@/lib/env';
import { APP_MESSAGES, AppError } from '@/lib/app-errors';
import { resolveCurrencyForLocation } from '@/lib/location-currency';
import { getCachedPlaces, normalizeLocationKey, setCachedPlaces } from '@/lib/places-cache';
import { groupNearbyPlacesByCategory } from '@/lib/nearby-places';
import { buildStaticPlacesContext, findStaticCityPack } from '@/lib/static-places';
import type { NearbyPlace, NearbyPlacesContext } from '@/types/nearby-places';

export const PLACES_NOTICE = {
  apiKeyMissing: APP_MESSAGES.placesApiFailed,
  liveUnavailable: APP_MESSAGES.placesApiFailed,
} as const;

const PLAN_MAX_PLACES = 16;
const PLAN_MIN_LIVE_PLACES = 4;

function limitPlaces(places: NearbyPlace[]): NearbyPlace[] {
  return places.slice(0, PLAN_MAX_PLACES);
}

async function fetchLivePlacesFromGoogle(location: string): Promise<NearbyPlacesContext | null> {
  const result = await searchPlacesForPlan(location, PLAN_MAX_PLACES);
  if (!result || result.places.length < PLAN_MIN_LIVE_PLACES) {
    return null;
  }

  const trimmed = location.trim();

  return {
    coordinates: result.center,
    locationLabel: result.locationLabel,
    searchedAt: new Date().toISOString(),
    places: limitPlaces(result.places),
    geocodeAddress: result.address,
    inferredCurrency: resolveCurrencyForLocation(trimmed, result.address),
    source: 'google',
  };
}

function buildFallbackContext(location: string, notice: string): NearbyPlacesContext | null {
  const pack = findStaticCityPack(location);
  if (!pack) return null;

  return {
    ...buildStaticPlacesContext(pack, location),
    notice,
  };
}

export function buildEmptyPlacesContext(location: string, notice: string): NearbyPlacesContext {
  return {
    coordinates: { latitude: 35.6762, longitude: 139.6503 },
    locationLabel: location,
    places: [],
    searchedAt: new Date().toISOString(),
    source: 'static',
    notice,
  };
}

/**
 * Fetches real places for plan generation.
 * Never throws for Google/static lookup failures — returns fallback or empty context instead.
 */
export async function fetchRealPlacesForLocation(location: string): Promise<NearbyPlacesContext> {
  const trimmed = location.trim();
  if (!trimmed) {
    throw new AppError(APP_MESSAGES.locationRequired, 'NO_PLACES_FOUND');
  }

  const locationKey = normalizeLocationKey(trimmed);

  try {
    const cached = await getCachedPlaces(locationKey);
    if (cached && cached.places.length > 0) {
      return cached;
    }

    if (isGoogleMapsConfigured()) {
      try {
        const live = await fetchLivePlacesFromGoogle(trimmed);
        if (live) {
          await setCachedPlaces(locationKey, live);
          return live;
        }
      } catch {
        const fallback = buildFallbackContext(trimmed, PLACES_NOTICE.liveUnavailable);
        if (fallback) return fallback;
      }

      const fallback = buildFallbackContext(trimmed, PLACES_NOTICE.liveUnavailable);
      if (fallback) return fallback;

      return buildEmptyPlacesContext(trimmed, PLACES_NOTICE.liveUnavailable);
    }

    const fallback = buildFallbackContext(trimmed, PLACES_NOTICE.apiKeyMissing);
    if (fallback) return fallback;

    return buildEmptyPlacesContext(trimmed, PLACES_NOTICE.apiKeyMissing);
  } catch (error) {
    const fallback = buildFallbackContext(trimmed, PLACES_NOTICE.liveUnavailable);
    if (fallback) return fallback;
    return buildEmptyPlacesContext(
      trimmed,
      error instanceof Error ? error.message : PLACES_NOTICE.liveUnavailable,
    );
  }
}

export function buildRealPlacesPromptSection(context: NearbyPlacesContext): string {
  if (!context.places.length) {
    return `
## 実在スポットリスト
ライブ・静的データとも取得できませんでした。**実在する店名・施設名**を使用してください（架空の名称は禁止）。
${context.notice ? `※ ${context.notice}` : ''}`;
  }

  const grouped = groupNearbyPlacesByCategory(context.places);
  const sourceLabel =
    context.source === 'google'
      ? 'Google Places（ライブ）'
      : context.source === 'cache'
        ? 'Google Places（キャッシュ · 24時間）'
        : '定番スポットリスト（静的）';

  const sections = Object.entries(grouped)
    .filter(([, items]) => items && items.length > 0)
    .map(([label, items]) => {
      const lines = items!
        .map((place, index) => {
          const rating = place.rating != null ? ` · ★${place.rating.toFixed(1)}` : '';
          const maps = place.mapsUrl ? `\n     Google Maps: ${place.mapsUrl}` : '';
          return (
            `  ${index + 1}. **${place.name}**` +
            `\n     カテゴリ: ${place.categoryLabel}${rating}` +
            (place.address ? `\n     住所: ${place.address}` : '') +
            maps
          );
        })
        .join('\n');

      return `【${label}】\n${lines}`;
    });

  const placeNames = context.places.map((place) => place.name).join('、');

  return `
## 実在スポットリスト（${sourceLabel} · 必須遵守）

**${context.locationLabel}** から **${context.places.length}件** の実在スポットを使用します。
${context.source === 'cache' ? '※24時間以内のキャッシュデータです。' : ''}
${context.source === 'static' ? '※ライブデータ未取得のため、定番スポットリストを使用しています。' : ''}
検索時刻: ${new Date(context.searchedAt).toLocaleString('ja-JP')}

### 最重要ルール（違反禁止）
1. **以下のリストに含まれるスポット名のみ**を days[].items[].activity に使用すること
2. **架空の店名・施設名・存在しないスポットは一切禁止**
3. リストにないスポットを追加・創作しないこと
4. **飲食店だけに偏らず**、散歩・公園・文化・体験・買い物系スポットもバランスよく使うこと
5. activity にはリストの**名称をそのまま**記載すること（表記ゆれ・略称・創作名は禁止）
6. websiteUrl が不明な場合は、リストの Google Maps URL を使用すること
7. rainyDayAlternatives もリスト内のスポットのみ使用すること
8. スポット数が足りない場合は、**同じリスト内の別スポット**を選び直すこと（創作しない）

### 使用可能なスポット名一覧
${placeNames}

### スポット詳細
${sections.join('\n\n')}
`.trim();
}

export function enrichPlanWithRealPlaceLinks(
  days: import('@/types/plan').ItineraryDay[],
  places: NearbyPlace[],
): import('@/types/plan').ItineraryDay[] {
  if (places.length === 0) return days;

  const byName = new Map(places.map((place) => [place.name, place]));

  return days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      const match =
        byName.get(item.activity) ??
        places.find(
          (place) =>
            item.activity.includes(place.name) || place.name.includes(item.activity),
        );

      if (!match) return item;

      return {
        ...item,
        placeAddress: item.placeAddress?.trim() ? item.placeAddress : match.address || undefined,
        placeCategory: item.placeCategory?.trim()
          ? item.placeCategory
          : match.categoryLabel || undefined,
        websiteUrl: item.websiteUrl?.trim()
          ? item.websiteUrl
          : match.mapsUrl || undefined,
      };
    }),
  }));
}
