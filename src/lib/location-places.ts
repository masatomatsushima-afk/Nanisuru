import { searchPlacesForPlan } from '@/lib/google-places';
import { isGoogleMapsConfigured } from '@/lib/env';
import { resolveCurrencyForLocation } from '@/lib/location-currency';
import { getCachedPlaces, normalizeLocationKey, setCachedPlaces } from '@/lib/places-cache';
import { groupNearbyPlacesByCategory } from '@/lib/nearby-places';
import { buildStaticPlacesContext, findStaticCityPack } from '@/lib/static-places';
import type { NearbyPlace, NearbyPlacesContext } from '@/types/nearby-places';

export const REAL_PLACES_FETCH_ERROR = '実在スポットを取得できませんでした';

export const PLACES_NOTICE = {
  apiKeyMissing:
    'Google Maps APIキーが未設定のため、定番スポットリストを使用しています。',
  liveUnavailable:
    'ライブのスポット情報は取得できませんでした。定番スポットリストを使用しています。',
  unsupportedCity:
    '実在スポットを取得できませんでした。この都市の定番リストは未対応です。',
} as const;

const PLAN_MAX_PLACES = 8;
const PLAN_MIN_LIVE_PLACES = 3;

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

/**
 * Fetches real places for plan generation.
 * Call only when the user presses the generate button — not on input change.
 * Uses 24h cache, max 1 Google API call, and static fallback for major cities.
 */
export async function fetchRealPlacesForLocation(location: string): Promise<NearbyPlacesContext> {
  const trimmed = location.trim();
  if (!trimmed) {
    throw new Error(REAL_PLACES_FETCH_ERROR);
  }

  const locationKey = normalizeLocationKey(trimmed);

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
      // fall through to static fallback
    }

    const fallback = buildFallbackContext(trimmed, PLACES_NOTICE.liveUnavailable);
    if (fallback) return fallback;

    throw new Error(PLACES_NOTICE.unsupportedCity);
  }

  const fallback = buildFallbackContext(trimmed, PLACES_NOTICE.apiKeyMissing);
  if (fallback) return fallback;

  throw new Error(PLACES_NOTICE.unsupportedCity);
}

export function buildRealPlacesPromptSection(context: NearbyPlacesContext): string {
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
4. activity にはリストの**名称をそのまま**記載すること（表記ゆれ・略称・創作名は禁止）
5. websiteUrl が不明な場合は、リストの Google Maps URL を使用すること
6. rainyDayAlternatives もリスト内のスポットのみ使用すること
7. スポット数が足りない場合は、**同じリスト内の別スポット**を選び直すこと（創作しない）

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
        websiteUrl: item.websiteUrl?.trim()
          ? item.websiteUrl
          : match.mapsUrl || undefined,
      };
    }),
  }));
}
