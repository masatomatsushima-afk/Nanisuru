import {
  getDayCountForDuration,
  getDurationDisplayLabel,
} from '@/lib/trip-duration';
import { addDaysToIsoDate, formatIsoDate, formatTripDateLabel, getTodayIsoDate } from '@/lib/weather';
import type { TripDurationOption } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type {
  CustomTripDuration,
  ResolvedTripSchedule,
  TripScheduleEditorValue,
} from '@/types/trip-schedule';

export const TRIP_SCHEDULE_MISSING_DATES = '出発日と帰宅日を選択してください';
export const TRIP_SCHEDULE_INVALID_DATE_FORMAT = '日付を正しく入力してください';
export const TRIP_SCHEDULE_INVALID_DURATION = '旅行期間を正しく入力してください';
export const TRIP_SCHEDULE_INVALID_DATES = '帰宅日は出発日より前にできません';

export const TRIP_DATE_QUICK_OPTIONS = ['今日', '明日', '週末'] as const;
export type TripDateQuickOption = (typeof TRIP_DATE_QUICK_OPTIONS)[number];

export const TRIP_DURATION_QUICK_OPTIONS = [
  '日帰り',
  '1泊2日',
  '2泊3日',
  '3泊4日',
  '5泊6日',
  '1週間',
  'その他',
] as const;
export type TripDurationQuickOption = (typeof TRIP_DURATION_QUICK_OPTIONS)[number];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  const trimmed = value.trim();
  if (!ISO_DATE_PATTERN.test(trimmed)) return false;
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return formatIsoDate(parsed) === trimmed;
}

export function sanitizeDateInputText(text: string): string {
  return text.replace(/[^\d-]/g, '').slice(0, 10);
}

export function dayCountBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const end = new Date(`${endDate}T12:00:00`).getTime();
  const diffDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
  return Math.max(1, diffDays + 1);
}

export function nightsBetween(startDate: string, endDate: string): number {
  return Math.max(0, dayCountBetween(startDate, endDate) - 1);
}

export function parseCustomDurationInput(
  customNights: string,
  customDays: string,
): CustomTripDuration | null {
  const nights = Number.parseInt(customNights.trim(), 10);
  const days = Number.parseInt(customDays.trim(), 10);
  if (!Number.isFinite(nights) || !Number.isFinite(days)) return null;
  if (nights < 0 || days < 1 || nights >= days) return null;
  return { nights, days };
}

export function inferPresetFromDates(
  departureDate: string,
  returnDate: string,
): { preset: TripDurationOption; custom?: CustomTripDuration } {
  const days = dayCountBetween(departureDate, returnDate);
  const nights = days - 1;

  if (days === 1) return { preset: '1日' };
  if (nights === 1 && days === 2) return { preset: '1泊2日' };
  if (nights === 2 && days === 3) return { preset: '2泊3日' };
  if (nights === 3 && days === 4) return { preset: '3泊4日' };
  if (nights === 5 && days === 6) return { preset: 'その他', custom: { nights: 5, days: 6 } };
  if (nights === 6 && days === 7) return { preset: '1週間' };

  return { preset: 'その他', custom: { nights, days } };
}

export function returnDateFromPreset(
  departureDate: string,
  preset: TripDurationOption,
  custom?: CustomTripDuration | null,
): string {
  if (preset === '半日' || preset === '1日') {
    return departureDate;
  }

  const dayCount = getDayCountForDuration(preset, custom);
  return addDaysToIsoDate(departureDate, dayCount - 1);
}

export function getDurationLabelFromDates(departureDate: string, returnDate: string): string {
  const days = dayCountBetween(departureDate, returnDate);
  const nights = nightsBetween(departureDate, returnDate);
  if (days === 1) return '1日';
  if (nights === 6 && days === 7) return '1週間';
  if (nights === 13 && days === 14) return '2週間';
  if (nights > 0) return `${nights}泊${days}日`;
  return `${days}日間`;
}

export function getUpcomingWeekendDates(): { departureDate: string; returnDate: string } {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dayOfWeek = today.getDay();

  let saturday: Date;
  if (dayOfWeek === 6) {
    saturday = today;
  } else if (dayOfWeek === 0) {
    saturday = new Date(today);
    saturday.setDate(today.getDate() + 6);
  } else {
    saturday = new Date(today);
    saturday.setDate(today.getDate() + (6 - dayOfWeek));
  }

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  return {
    departureDate: formatIsoDate(saturday),
    returnDate: formatIsoDate(sunday),
  };
}

export function createDefaultTripSchedule(): TripScheduleEditorValue {
  const departureDate = getTodayIsoDate();
  return {
    departureDate,
    returnDate: departureDate,
    durationPreset: '1日',
    customNights: '4',
    customDays: '5',
  };
}

export function resolveTripSchedule(value: TripScheduleEditorValue): ResolvedTripSchedule {
  const { departureDate, returnDate } = value;
  const datesValid =
    isValidIsoDate(departureDate) &&
    isValidIsoDate(returnDate) &&
    returnDate >= departureDate;

  let durationPreset = value.durationPreset;
  let customDuration =
    value.durationPreset === 'その他'
      ? parseCustomDurationInput(value.customNights, value.customDays) ?? undefined
      : undefined;

  if (datesValid) {
    const inferred = inferPresetFromDates(departureDate, returnDate);
    durationPreset = inferred.preset;
    customDuration =
      inferred.custom ??
      (inferred.preset === 'その他' ? customDuration : undefined);
  }

  const durationLabel = datesValid
    ? getDurationLabelFromDates(departureDate, returnDate)
    : getDurationDisplayLabel(durationPreset, customDuration);
  const dayCount = datesValid
    ? dayCountBetween(departureDate, returnDate)
    : getDayCountForDuration(durationPreset, customDuration);

  return {
    departureDate,
    returnDate,
    durationPreset,
    customDuration,
    durationLabel,
    dayCount,
  };
}

export function validateTripSchedule(value: TripScheduleEditorValue): string | null {
  if (!value.departureDate?.trim() || !value.returnDate?.trim()) {
    return TRIP_SCHEDULE_MISSING_DATES;
  }

  if (!isValidIsoDate(value.departureDate) || !isValidIsoDate(value.returnDate)) {
    return TRIP_SCHEDULE_INVALID_DATE_FORMAT;
  }

  if (value.returnDate < value.departureDate) {
    return TRIP_SCHEDULE_INVALID_DATES;
  }

  if (value.durationPreset === 'その他') {
    if (!parseCustomDurationInput(value.customNights, value.customDays)) {
      return TRIP_SCHEDULE_INVALID_DURATION;
    }
  }

  return null;
}

export function formatTripDateRangeLabel(departureDate?: string, returnDate?: string): string | null {
  if (!departureDate?.trim()) return null;

  const startLabel = formatTripDateLabel(departureDate);
  if (!returnDate?.trim() || returnDate === departureDate) {
    return startLabel;
  }

  const start = new Date(`${departureDate}T12:00:00`);
  const end = new Date(`${returnDate}T12:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const endLabel = end.toLocaleDateString('ja-JP', {
    year: sameYear ? undefined : 'numeric',
    month: sameMonth ? undefined : 'long',
    day: 'numeric',
  });

  const startShort = start.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `${startShort}〜${endLabel}`;
}

export function formatTripScheduleSummary(input: {
  location?: string;
  departureDate?: string;
  returnDate?: string;
  tripDuration: TripDurationOption;
  customDuration?: CustomTripDuration | null;
}): string {
  const parts: string[] = [];
  const dateRange = formatTripDateRangeLabel(input.departureDate, input.returnDate);
  const durationLabel = getDurationDisplayLabel(input.tripDuration, input.customDuration);

  if (dateRange) parts.push(dateRange);
  parts.push(durationLabel);

  if (input.location?.trim()) {
    return `${input.location.trim()}旅行・${durationLabel}${dateRange ? `（${dateRange}）` : ''}`;
  }

  return parts.join(' ／ ');
}

export function payloadToTripSchedule(payload: SavedTripPayload): TripScheduleEditorValue {
  const departureDate = payload.details.tripDate ?? getTodayIsoDate();
  const returnDate = payload.details.tripEndDate ?? returnDateFromPreset(
    departureDate,
    payload.tripDuration,
    payload.customDuration,
  );

  const custom = payload.customDuration;

  return {
    departureDate,
    returnDate,
    durationPreset: payload.tripDuration,
    customNights: custom ? String(custom.nights) : '4',
    customDays: custom ? String(custom.days) : '5',
  };
}

export function applyTripScheduleToPayload(
  payload: SavedTripPayload,
  value: TripScheduleEditorValue,
): SavedTripPayload {
  const resolved = resolveTripSchedule(value);

  return {
    ...payload,
    tripDuration: resolved.durationPreset,
    customDuration: resolved.customDuration,
    details: {
      ...payload.details,
      tripDate: resolved.departureDate,
      tripEndDate: resolved.returnDate,
      tripDuration: resolved.durationPreset,
      duration: resolved.durationLabel,
    },
  };
}

export function syncScheduleOnDepartureChange(
  value: TripScheduleEditorValue,
  departureDate: string,
): TripScheduleEditorValue {
  const custom =
    value.durationPreset === 'その他'
      ? parseCustomDurationInput(value.customNights, value.customDays)
      : null;

  return {
    ...value,
    departureDate,
    returnDate: returnDateFromPreset(departureDate, value.durationPreset, custom),
  };
}

export function syncScheduleOnReturnChange(
  value: TripScheduleEditorValue,
  returnDate: string,
): TripScheduleEditorValue {
  const inferred = inferPresetFromDates(value.departureDate, returnDate);
  return {
    ...value,
    returnDate,
    durationPreset: inferred.preset,
    customNights: inferred.custom ? String(inferred.custom.nights) : value.customNights,
    customDays: inferred.custom ? String(inferred.custom.days) : value.customDays,
  };
}

export function syncScheduleOnPresetChange(
  value: TripScheduleEditorValue,
  preset: TripDurationOption,
): TripScheduleEditorValue {
  const custom =
    preset === 'その他'
      ? parseCustomDurationInput(value.customNights, value.customDays) ?? { nights: 4, days: 5 }
      : null;

  return {
    ...value,
    durationPreset: preset,
    customNights: custom ? String(custom.nights) : value.customNights,
    customDays: custom ? String(custom.days) : value.customDays,
    returnDate: returnDateFromPreset(value.departureDate, preset, custom),
  };
}

export function syncScheduleOnCustomChange(
  value: TripScheduleEditorValue,
  customNights: string,
  customDays: string,
): TripScheduleEditorValue {
  const custom = parseCustomDurationInput(customNights, customDays);
  return {
    ...value,
    durationPreset: 'その他',
    customNights,
    customDays,
    returnDate: custom
      ? returnDateFromPreset(value.departureDate, 'その他', custom)
      : value.returnDate,
  };
}

export function applyQuickDateOption(
  value: TripScheduleEditorValue,
  option: TripDateQuickOption,
): TripScheduleEditorValue {
  if (option === '今日') {
    const today = getTodayIsoDate();
    return syncScheduleOnReturnChange(
      syncScheduleOnDepartureChange(
        { ...value, durationPreset: '1日' },
        today,
      ),
      today,
    );
  }

  if (option === '明日') {
    const tomorrow = addDaysToIsoDate(getTodayIsoDate(), 1);
    return syncScheduleOnReturnChange(
      syncScheduleOnDepartureChange(
        { ...value, durationPreset: '1日' },
        tomorrow,
      ),
      tomorrow,
    );
  }

  const weekend = getUpcomingWeekendDates();
  return syncScheduleOnReturnChange(
    syncScheduleOnDepartureChange(
      { ...value, durationPreset: '1泊2日' },
      weekend.departureDate,
    ),
    weekend.returnDate,
  );
}

export function applyQuickDurationOption(
  value: TripScheduleEditorValue,
  option: TripDurationQuickOption,
): TripScheduleEditorValue {
  if (option === '日帰り') {
    return syncScheduleOnPresetChange(value, '1日');
  }

  if (option === '5泊6日') {
    return syncScheduleOnPresetChange(
      {
        ...value,
        durationPreset: 'その他',
        customNights: '5',
        customDays: '6',
      },
      'その他',
    );
  }

  if (option === 'その他') {
    return syncScheduleOnPresetChange(value, 'その他');
  }

  return syncScheduleOnPresetChange(value, option);
}
