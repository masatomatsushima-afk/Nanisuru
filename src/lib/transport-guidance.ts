import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import { buildDirectionsDestination } from '@/lib/concierge-links';
import type {
  DayRouteNote,
  TransportGuidanceContext,
  TransportLinkOption,
  TransportMode,
  TransportRecommendation,
} from '@/types/transport-guidance';
import { TRANSPORT_MODE_LABELS } from '@/types/transport-guidance';

const WALKING_SPEED_METERS_PER_MINUTE = 80;

export function parseEstimatedMinutes(text?: string | null): number | null {
  if (!text?.trim()) return null;
  const match = text.match(/(\d+)\s*分/);
  if (!match) return null;
  const minutes = Number.parseInt(match[1], 10);
  return Number.isFinite(minutes) ? minutes : null;
}

export function estimateDistanceLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  const meters = minutes * WALKING_SPEED_METERS_PER_MINUTE;
  if (meters < 1000) return `約${Math.round(meters / 10) * 10}m`;
  return `約${(meters / 1000).toFixed(1)}km`;
}

export function buildGoogleMapsDirectionsUrl(input: {
  origin: string;
  destination: string;
  travelmode: 'walking' | 'transit' | 'driving';
}): string {
  const params = new URLSearchParams({
    api: '1',
    origin: input.origin.trim(),
    destination: input.destination.trim(),
    travelmode: input.travelmode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function mapsTravelMode(mode: TransportMode): 'walking' | 'transit' | 'driving' {
  if (mode === 'transit') return 'transit';
  if (mode === 'walking') return 'walking';
  return 'driving';
}

export function buildTransportLinks(
  fromItem: ItineraryItem,
  toItem: ItineraryItem,
): TransportLinkOption[] {
  const origin = buildDirectionsDestination(fromItem);
  const destination = buildDirectionsDestination(toItem);

  const modes: TransportMode[] = ['walking', 'transit', 'driving', 'taxi'];

  return modes.map((mode) => ({
    mode,
    label: TRANSPORT_MODE_LABELS[mode],
    openLabel:
      mode === 'walking'
        ? '徒歩で開く'
        : mode === 'transit'
          ? '電車・バスで開く'
          : mode === 'driving'
            ? '車で開く'
            : 'タクシーで開く',
    url: buildGoogleMapsDirectionsUrl({
      origin,
      destination,
      travelmode: mapsTravelMode(mode),
    }),
  }));
}

function hasMajorTransitCity(location?: string): boolean {
  if (!location?.trim()) return true;
  return /東京|大阪|京都|名古屋|福岡|札幌|横浜|神戸|仙台|広島|シンガポール|Singapore|ソウル|Seoul|台北|Taipei|香港|Hong Kong|ロンドン|London|パリ|Paris|ニューヨーク|New York|メルボルン|Melbourne|シドニー|Sydney|バンコク|Bangkok/i.test(
    location,
  );
}

function isRainyContext(context: TransportGuidanceContext, dayIndex?: number): boolean {
  if (context.weather?.hasRainExpected) return true;
  const day = dayIndex != null ? context.weather?.days[dayIndex] : context.weather?.days[0];
  return Boolean(day && (day.category === 'rainy' || day.precipitationProbability >= 45));
}

function isHotContext(context: TransportGuidanceContext, dayIndex?: number): boolean {
  const day = dayIndex != null ? context.weather?.days[dayIndex] : context.weather?.days[0];
  return Boolean(day && day.temperatureMax >= 30);
}

function isFirstDayWithArrival(context: TransportGuidanceContext, dayIndex: number): boolean {
  return dayIndex === 0 && Boolean(context.travelTiming?.arrivalTime?.trim());
}

function isLastDayWithDeparture(
  context: TransportGuidanceContext,
  dayIndex: number,
  totalDays: number,
): boolean {
  return dayIndex === totalDays - 1 && Boolean(context.travelTiming?.departureTime?.trim());
}

function departureBufferNote(context: TransportGuidanceContext): string | null {
  const time = context.travelTiming?.departureTime?.trim();
  if (!time) return null;

  const [hourText, minuteText] = time.split(':');
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText ?? '0', 10);
  if (!Number.isFinite(hour)) return null;

  const total = hour * 60 + minute;
  const leaveCity = total - 180;
  const leaveHour = Math.floor(Math.max(leaveCity, 0) / 60);
  const leaveMinute = Math.max(leaveCity, 0) % 60;
  const leaveLabel = `${String(leaveHour).padStart(2, '0')}:${String(leaveMinute).padStart(2, '0')}`;

  if (context.travelTiming?.departurePlace === '空港') {
    return `帰りの飛行機が${time}なので、${leaveLabel}には市内を出る想定です`;
  }
  return `出発が${time}のため、余裕を持った移動がおすすめです`;
}

export function recommendTransport(input: {
  fromItem: ItineraryItem;
  toItem: ItineraryItem;
  context: TransportGuidanceContext;
  dayIndex?: number;
  totalDays?: number;
  itemIndex?: number;
}): TransportRecommendation {
  const { fromItem, toItem, context, dayIndex = 0, totalDays = 1 } = input;
  const estimatedMinutes =
    parseEstimatedMinutes(fromItem.travelTimeToNext) ??
    parseEstimatedMinutes(fromItem.transportation);
  const distanceLabel = estimateDistanceLabel(estimatedMinutes);

  const rainy = isRainyContext(context, dayIndex);
  const hot = isHotContext(context, dayIndex);
  const firstDayArrival = isFirstDayWithArrival(context, dayIndex);
  const lastDayDeparture = isLastDayWithDeparture(context, dayIndex, totalDays);
  const transitCity = hasMajorTransitCity(context.location);
  const departureNote = lastDayDeparture ? departureBufferNote(context) : null;

  let recommendedMode: TransportMode = 'walking';
  let recommendationText = 'この距離なら徒歩がおすすめです';

  if (estimatedMinutes != null && estimatedMinutes <= 12) {
    recommendedMode = rainy ? 'transit' : 'walking';
    recommendationText = rainy
      ? '距離は近いですが、雨なので電車・バスがおすすめです'
      : 'この距離なら徒歩がおすすめです';
  } else if (estimatedMinutes != null && estimatedMinutes <= 25) {
    recommendedMode = rainy || hot ? 'transit' : transitCity ? 'transit' : 'walking';
    recommendationText =
      rainy
        ? '雨の可能性があるため、電車・バスがおすすめです'
        : hot
          ? '暑い日は無理に歩かず、電車・バスが快適です'
          : transitCity
            ? '都市部の移動なので、電車・バスが効率的です'
            : '距離次第ですが、徒歩でも回れます';
  } else if (estimatedMinutes != null && estimatedMinutes > 25) {
    recommendedMode = transitCity ? 'transit' : 'driving';
    recommendationText = transitCity
      ? '距離があるため、電車・バスがおすすめです'
      : '距離があるため、車移動が現実的です';
  }

  if (firstDayArrival && (input.itemIndex ?? 0) <= 1) {
    recommendedMode = 'taxi';
    recommendationText = '荷物がある初日はタクシーがおすすめです';
  }

  if (lastDayDeparture && departureNote) {
    recommendedMode = 'transit';
    recommendationText = `最終日は時間があるため、余裕を持って電車・バスがおすすめです。${departureNote}`;
  } else if (lastDayDeparture) {
    recommendedMode = 'transit';
    recommendationText = '最終日は飛行機・電車の時間があるため、余裕を持って電車・バスがおすすめです';
  }

  if (context.companion === '家族' && estimatedMinutes != null && estimatedMinutes >= 15) {
    recommendedMode = rainy ? 'taxi' : 'transit';
    recommendationText = rainy
      ? '家族での移動は、雨の日はタクシーが楽です'
      : '家族での移動は、電車・バスだと疲れにくいです';
  }

  const transportHint = fromItem.transportation?.trim() ?? '';
  if (/タクシー|taxi|uber|配車/i.test(transportHint)) {
    recommendedMode = 'taxi';
    recommendationText = 'プラン上もタクシー移動が想定されています';
  } else if (/電車|地下鉄|バス|新幹線|JR|metro|train|bus/i.test(transportHint)) {
    recommendedMode = 'transit';
    recommendationText = 'この区間は公共交通機関が効率的です';
  } else if (/車|レンタカー|drive|高速/i.test(transportHint)) {
    recommendedMode = 'driving';
    recommendationText = 'この区間は車移動が現実的です';
  }

  return {
    recommendedMode,
    recommendationText,
    estimatedMinutes,
    distanceLabel,
  };
}

export function buildDayRouteNote(
  day: ItineraryDay,
  context: TransportGuidanceContext,
  dayIndex: number,
  totalDays: number,
): DayRouteNote | null {
  const moveItems = day.items.filter((item) => item.activityCategory !== '移動');
  if (moveItems.length <= 1) return null;

  let walkLegs = 0;
  let transitLegs = 0;
  let longLegs = 0;
  let totalWalkMinutes = 0;

  for (let i = 0; i < moveItems.length - 1; i += 1) {
    const fromItem = moveItems[i];
    const toItem = moveItems[i + 1];
    const minutes = parseEstimatedMinutes(fromItem.travelTimeToNext);
    if (minutes != null) totalWalkMinutes += minutes;
    if (minutes != null && minutes > 25) longLegs += 1;

    const hint = fromItem.transportation ?? '';
    if (/徒歩|walk/i.test(hint) || (minutes != null && minutes <= 15)) walkLegs += 1;
    if (/電車|バス|train|bus|metro/i.test(hint)) transitLegs += 1;
  }

  const hasTour = day.theme.includes('ツアー') || day.items.some((item) => /ツアー|tour/i.test(item.activity));
  const rainy = isRainyContext(context, dayIndex);

  if (longLegs >= 2 || totalWalkMinutes >= 90) {
    return {
      label: 'この日は移動が多い日',
      detail: rainy ? '雨の可能性もあるため、公共交通機関を活用すると楽です' : undefined,
    };
  }

  if (walkLegs >= Math.max(2, moveItems.length - 2) && longLegs === 0) {
    return { label: 'この日は徒歩中心で回れます' };
  }

  if (transitLegs >= 1 || (hasMajorTransitCity(context.location) && longLegs >= 1)) {
    return {
      label: 'この日は電車移動がおすすめ',
      detail: rainy ? '雨の日は駅近スポットを優先すると快適です' : undefined,
    };
  }

  if (hasTour || day.theme.includes('体験')) {
    return { label: 'この日はツアー利用が便利', detail: '移動込みの体験を検討すると効率的です' };
  }

  if (isFirstDayWithArrival(context, dayIndex)) {
    return { label: '到着日は移動を少なめに', detail: '荷物があるためタクシーも検討しましょう' };
  }

  if (isLastDayWithDeparture(context, dayIndex, totalDays)) {
    const note = departureBufferNote(context);
    return {
      label: '最終日は帰路優先',
      detail: note ?? '出発時間に間に合う移動を意識しましょう',
    };
  }

  return null;
}

export function logTransportRecommendation(
  fromActivity: string,
  toActivity: string,
  recommendation: TransportRecommendation,
): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[Nanisuru] transport_recommendation', {
      from: fromActivity,
      to: toActivity,
      mode: recommendation.recommendedMode,
      text: recommendation.recommendationText,
    });
  }
}
