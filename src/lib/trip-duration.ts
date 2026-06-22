import type { ItineraryDay, ItineraryItem, TripDurationOption } from '@/types/plan';
import { TRIP_DURATION_OPTIONS } from '@/types/plan';

export type TripDurationConfig = {
  dayCount: number;
  itemsMin: number;
  itemsMax: number;
  guide: string;
};

export const TRIP_DURATION_CONFIG: Record<TripDurationOption, TripDurationConfig> = {
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

export function isMultiDayDuration(duration: TripDurationOption): boolean {
  return TRIP_DURATION_CONFIG[duration].dayCount > 1;
}

export function flattenItineraryDays(days: ItineraryDay[]): ItineraryItem[] {
  return days.flatMap((day) => day.items);
}

export function getAllActivities(days: ItineraryDay[]): string[] {
  return flattenItineraryDays(days).map((item) => item.activity);
}

export function parseItineraryDays(
  daysJson?: string | null,
  fallbackItems?: ItineraryItem[],
): ItineraryDay[] {
  if (daysJson) {
    try {
      const parsed = JSON.parse(daysJson) as ItineraryDay[];
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

export function getDurationBadgeLabel(duration: TripDurationOption): string {
  if (duration === '半日') return '半日';
  if (duration === '1日') return '1日';
  return `${TRIP_DURATION_CONFIG[duration].dayCount}日間`;
}
