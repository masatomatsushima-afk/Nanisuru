import { geocodeLocationQuery, searchAfterPlanPlaces } from '@/lib/google-places';
import type { AfterPlanInput, AfterPlanPlacesContext, AfterPlanWalkDistance } from '@/types/after-plan';

function walkDistanceToMeters(distance: AfterPlanWalkDistance): number {
  switch (distance) {
    case '5分以内':
      return 400;
    case '10分以内':
      return 800;
    case '15分以内':
      return 1_200;
    case 'タクシーでもOK':
      return 3_000;
    default:
      return 800;
  }
}

function isLateNight(time: string): boolean {
  const [hourPart] = time.split(':');
  const hour = parseInt(hourPart, 10);
  return !Number.isNaN(hour) && (hour >= 22 || hour < 5);
}

export async function fetchAfterPlanPlaces(
  input: AfterPlanInput,
): Promise<AfterPlanPlacesContext | null> {
  const geocoded = await geocodeLocationQuery(input.currentLocation);
  if (!geocoded) return null;

  const coordinates = {
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
  };

  const radiusMeters = walkDistanceToMeters(input.walkDistance);
  const openNow = !isLateNight(input.currentTime) || true;

  const places = await searchAfterPlanPlaces(coordinates, {
    radiusMeters,
    openNow,
  });

  const filtered =
    input.walkDistance === 'タクシーでもOK'
      ? places
      : places.filter((place) => place.distanceMeters <= radiusMeters + 200);

  return {
    coordinates,
    locationLabel: geocoded.label,
    places: filtered.slice(0, 24),
    openNowApplied: openNow,
  };
}

export function buildAfterPlanPlacesBrief(context: AfterPlanPlacesContext): string {
  if (context.places.length === 0) {
    return '周辺の実在スポットデータ: 取得できませんでした（AIが一般的な候補を提案します）';
  }

  const lines = context.places.slice(0, 20).map(
    (place) =>
      `- ${place.name}（${place.categoryLabel}）· ${place.distanceLabel} · 徒歩約${place.walkMinutes}分` +
      (place.rating ? ` · ★${place.rating.toFixed(1)}` : '') +
      (place.mapsUrl ? ` · ${place.mapsUrl}` : ''),
  );

  return `周辺の実在スポット（${context.openNowApplied ? '営業中優先' : '営業時間フィルタなし'}）:\n${lines.join('\n')}`;
}
