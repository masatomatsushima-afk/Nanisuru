import type { TripDurationOption } from '@/types/plan';
import { TRIP_DURATION_OPTIONS } from '@/types/plan';
import type { CustomTripDuration } from '@/types/trip-schedule';

export type TripDurationConfig = {
  dayCount: number;
  itemsMin: number;
  itemsMax: number;
  guide: string;
};

export const TRIP_DURATION_CONFIG: Record<
  Exclude<TripDurationOption, 'その他'>,
  TripDurationConfig
> = {
  半日: {
    dayCount: 1,
    itemsMin: 2,
    itemsMax: 3,
    guide: '午前または午後の半日プラン。スポットは2〜3件に絞り、13:00〜17:00または10:00〜14:00程度の時間帯で組む。',
  },
  '1日': {
    dayCount: 1,
    itemsMin: 4,
    itemsMax: 6,
    guide: '1日で完結するプラン。朝から夜まで4〜6件のスポットを地理的に近い順に配置する。',
  },
  '1泊2日': {
    dayCount: 2,
    itemsMin: 3,
    itemsMax: 4,
    guide: '1泊2日の旅行。1日目=到着・市内、2日目=メイン観光または余韻、日ごとにテーマを変えて各日3〜4件。',
  },
  '2泊3日': {
    dayCount: 3,
    itemsMin: 3,
    itemsMax: 4,
    guide:
      '2泊3日の旅行。1日目=到着・市内、2日目=メイン観光、3日目=余韻・お土産など、日ごとにテーマを変えて各日3〜4件。',
  },
  '3泊4日': {
    dayCount: 4,
    itemsMin: 3,
    itemsMax: 4,
    guide:
      '3泊4日の旅行。4日間それぞれ異なるエリア・体験を提案し、移動日と観光日のバランスを取る。各日3〜4件。',
  },
  '1週間': {
    dayCount: 7,
    itemsMin: 3,
    itemsMax: 3,
    guide:
      '1週間の旅行。7日間それぞれ独立した日次プランを作成。前半・後半でエリアを分け、各日3件程度で無理のないペースに。',
  },
};

export type ResolvedDurationConfig = TripDurationConfig & {
  label: string;
};

export function formatCustomDurationLabel(custom: CustomTripDuration): string {
  if (custom.nights > 0) {
    return `${custom.nights}泊${custom.days}日`;
  }
  if (custom.days === 14) return '2週間';
  return `${custom.days}日間`;
}

export function resolveDurationConfig(
  tripDuration: TripDurationOption,
  customDuration?: CustomTripDuration | null,
): ResolvedDurationConfig {
  if (tripDuration === 'その他' && customDuration && customDuration.days >= 1) {
    const dayCount = customDuration.days;
    return {
      dayCount,
      itemsMin: dayCount <= 1 ? 2 : 3,
      itemsMax: dayCount <= 1 ? 4 : dayCount >= 7 ? 3 : 4,
      guide: `${formatCustomDurationLabel(customDuration)}の旅行。${dayCount}日間それぞれ独立した日次プラン（Day 1〜Day ${dayCount}）を作成。日ごとにテーマを変え、移動と観光のバランスを取る。`,
      label: formatCustomDurationLabel(customDuration),
    };
  }

  if (tripDuration === 'その他') {
    return { ...TRIP_DURATION_CONFIG['1日'], label: '1日' };
  }

  const config = TRIP_DURATION_CONFIG[tripDuration];
  return { ...config, label: tripDuration };
}

export function getDayCountForDuration(
  tripDuration: TripDurationOption,
  customDuration?: CustomTripDuration | null,
): number {
  return resolveDurationConfig(tripDuration, customDuration).dayCount;
}

export function getDurationDisplayLabel(
  tripDuration: TripDurationOption,
  customDuration?: CustomTripDuration | null,
): string {
  return resolveDurationConfig(tripDuration, customDuration).label;
}

export function isMultiDayDuration(
  tripDuration: TripDurationOption,
  customDuration?: CustomTripDuration | null,
): boolean {
  return getDayCountForDuration(tripDuration, customDuration) > 1;
}

export function flattenItineraryDays(days: import('@/types/plan').ItineraryDay[]): import('@/types/plan').ItineraryItem[] {
  return days.flatMap((day) => day.items);
}

export function getAllActivities(days: import('@/types/plan').ItineraryDay[]): string[] {
  return flattenItineraryDays(days).map((item) => item.activity);
}

export function parseItineraryDays(
  daysJson?: string | null,
  fallbackItems?: import('@/types/plan').ItineraryItem[],
): import('@/types/plan').ItineraryDay[] {
  if (daysJson) {
    try {
      const parsed = JSON.parse(daysJson) as import('@/types/plan').ItineraryDay[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }

  if (fallbackItems && fallbackItems.length > 0) {
    return [{ dayNumber: 1, label: '1日目', theme: '', items: fallbackItems }];
  }

  return [];
}

export function isTripDurationOption(value: string): value is TripDurationOption {
  return TRIP_DURATION_OPTIONS.includes(value as TripDurationOption);
}

export function getDurationBadgeLabel(
  tripDuration: TripDurationOption,
  customDuration?: CustomTripDuration | null,
): string {
  if (tripDuration === '半日') return '半日';
  if (tripDuration === '1日') return '1日';
  if (tripDuration === 'その他' && customDuration) {
    return formatCustomDurationLabel(customDuration);
  }
  const dayCount = getDayCountForDuration(tripDuration, customDuration);
  if (tripDuration === '1泊2日') return '1泊2日';
  if (tripDuration === '2泊3日') return '2泊3日';
  if (tripDuration === '3泊4日') return '3泊4日';
  if (tripDuration === '1週間') return '1週間';
  return `${dayCount}日間`;
}
