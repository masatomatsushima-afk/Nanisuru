import {
  fetchCurrentLocation,
  LOCATION_PERMISSION_DENIED_MESSAGE,
} from '@/lib/current-location';
import { searchNearbyPlaces } from '@/lib/google-places';
import { APP_MESSAGES, AppError } from '@/lib/app-errors';
import type { NearbyPlace, NearbyPlacesContext } from '@/types/nearby-places';
import { NEARBY_PLACE_CATEGORIES } from '@/types/nearby-places';

export async function fetchNearbyFromCurrentLocation(): Promise<NearbyPlacesContext> {
  const result = await fetchCurrentLocation();

  if (result.status === 'denied') {
    throw new AppError(LOCATION_PERMISSION_DENIED_MESSAGE, 'LOCATION_PERMISSION_DENIED');
  }
  if (result.status !== 'success') {
    throw new AppError(APP_MESSAGES.locationFetchFailed, 'UNKNOWN');
  }

  const location = result.data;

  let places: NearbyPlace[];
  try {
    places = await searchNearbyPlaces({
      latitude: location.latitude,
      longitude: location.longitude,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(APP_MESSAGES.placesApiFailed, 'PLACES_API_FAILED');
  }

  if (places.length === 0) {
    throw new AppError(APP_MESSAGES.noNearbyPlaces, 'NO_PLACES_FOUND');
  }

  return {
    coordinates: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    locationLabel: location.label,
    searchedAt: new Date().toISOString(),
    places,
  };
}

export function groupNearbyPlacesByCategory(
  places: NearbyPlace[],
): Record<string, NearbyPlace[]> {
  const grouped: Record<string, NearbyPlace[]> = {};

  for (const { label } of NEARBY_PLACE_CATEGORIES) {
    grouped[label] = [];
  }

  for (const place of places) {
    if (!grouped[place.categoryLabel]) {
      grouped[place.categoryLabel] = [];
    }
    grouped[place.categoryLabel].push(place);
  }

  return grouped;
}

export function buildNearbyPlacesBrief(context: NearbyPlacesContext): string {
  const grouped = groupNearbyPlacesByCategory(context.places);
  const sections = NEARBY_PLACE_CATEGORIES.map(({ label }) => {
    const items = grouped[label];
    if (!items || items.length === 0) return null;

    const lines = items
      .slice(0, 4)
      .map(
        (place, index) =>
          `  ${index + 1}. ${place.name} — ${place.distanceLabel} · 徒歩約${place.walkMinutes}分` +
          (place.rating != null ? ` · ★${place.rating.toFixed(1)}` : '') +
          (place.address ? `\n     ${place.address}` : ''),
      )
      .join('\n');

    return `【${label}】\n${lines}`;
  }).filter(Boolean);

  return `
=== ユーザーの現在地と周辺スポット（Google Places · 把握済み） ===

【現在地】${context.locationLabel}
【座標】${context.coordinates.latitude.toFixed(5)}, ${context.coordinates.longitude.toFixed(5)}
【検索時刻】${new Date(context.searchedAt).toLocaleString('ja-JP')}

【周辺スポット（半径2km · 徒歩時間は概算）】
${sections.join('\n\n')}

近くのおすすめを聞かれたら、上記スポットを優先的に提案してください。
距離・徒歩時間・評価を具体的に伝え、必要なら Google マップで開けるよう案内してください。
===`.trim();
}
