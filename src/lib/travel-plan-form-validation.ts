import {
  formatTravelDurationSummaryLabel,
  isValidIsoDate,
  nightsBetween,
  parseCustomDurationInput,
  resolveTripSchedule,
  returnDateFromPreset,
} from '@/lib/trip-schedule';
import {
  normalizeBudgetInput,
  normalizePeopleCountInput,
  normalizeTimeInput,
  normalizeUserInput,
  parseBudgetAmount,
  parsePeopleCount,
} from '@/lib/normalize-user-input';
import type { CurrencyCode } from '@/constants/currency';
import type { CompanionOption } from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { TravelIntentOption } from '@/types/plan-creation';
import type { ResolvedTripSchedule, TripScheduleEditorValue } from '@/types/trip-schedule';
import type { TravelBudgetIncludeOption } from '@/lib/travel-budget-includes';
import {
  resolveTravelBudgetIncludes,
  travelBudgetIncludesToBudgetScope,
} from '@/lib/travel-budget-includes';

import { formatCombinedTravelIntent } from './plan-creation';
import { resolveTravelPurposeValue } from './travel-purpose';

export type TravelPlanFormInput = {
  destination: string;
  tripSchedule: TripScheduleEditorValue;
  arrivalTime?: string;
  departureTime?: string;
  budget: string;
  currency: CurrencyCode;
  budgetIncludes: TravelBudgetIncludeOption[];
  peopleCount: string;
  companionType: CompanionOption | null;
  travelIntent: TravelIntentOption | '';
  travelPurpose?: string | null;
  customPreferences: PlanCustomPreferences;
};

export type TravelPlanValidationField =
  | 'destination'
  | 'departureDate'
  | 'returnDate'
  | 'durationDuration'
  | 'arrivalTime'
  | 'departureTime'
  | 'budget'
  | 'peopleCount'
  | 'companionType'
  | 'travelPurpose';

export type TravelPlanValidationErrors = Partial<Record<TravelPlanValidationField, string>>;

export type NormalizedTravelPlanFormInput = TravelPlanFormInput & {
  normalizedBudget: string;
  normalizedPeopleCount: string;
  normalizedArrivalTime?: string;
  normalizedDepartureTime?: string;
};

function hasValidTripDurationSelection(schedule: TripScheduleEditorValue): boolean {
  if (schedule.durationPreset === 'その他') {
    return parseCustomDurationInput(schedule.customNights, schedule.customDays) !== null;
  }

  return Boolean(schedule.durationPreset);
}

export function resolveTravelPlanScheduleFromInput(
  input: TravelPlanFormInput,
): ResolvedTripSchedule {
  const schedule = input.tripSchedule;
  let working = { ...schedule };

  if (isValidIsoDate(working.departureDate)) {
    const custom =
      working.durationPreset === 'その他'
        ? parseCustomDurationInput(working.customNights, working.customDays)
        : null;

    const returnDateValid =
      isValidIsoDate(working.returnDate) && working.returnDate >= working.departureDate;

    if (!returnDateValid && hasValidTripDurationSelection(working)) {
      working = {
        ...working,
        returnDate: returnDateFromPreset(working.departureDate, working.durationPreset, custom),
      };
    }
  }

  return resolveTripSchedule(working);
}

export function getTravelPlanDurationMeta(input: TravelPlanFormInput) {
  const resolved = resolveTravelPlanScheduleFromInput(input);
  const nights = isValidIsoDate(resolved.departureDate) && isValidIsoDate(resolved.returnDate)
    ? nightsBetween(resolved.departureDate, resolved.returnDate)
    : Math.max(0, resolved.dayCount - 1);

  return {
    departureDate: resolved.departureDate,
    returnDate: resolved.returnDate,
    durationLabel: formatTravelDurationSummaryLabel(resolved),
    nights,
    days: resolved.dayCount,
    durationPreset: resolved.durationPreset,
    customDuration: resolved.customDuration,
  };
}

export function normalizeTravelPlanFormInput(input: TravelPlanFormInput): NormalizedTravelPlanFormInput {
  const destination = normalizeUserInput(input.destination);
  const normalizedBudget = normalizeBudgetInput(input.budget);
  const normalizedPeopleCount = normalizePeopleCountInput(input.peopleCount);

  const rawArrival = input.arrivalTime?.trim();
  const rawDeparture = input.departureTime?.trim();
  const normalizedArrivalTime =
    rawArrival && rawArrival.length > 0 ? normalizeTimeInput(rawArrival) : '';
  const normalizedDepartureTime =
    rawDeparture && rawDeparture.length > 0 ? normalizeTimeInput(rawDeparture) : '';

  return {
    ...input,
    destination,
    budget: normalizedBudget,
    peopleCount: normalizedPeopleCount,
    customPreferences: {
      ...input.customPreferences,
      desiredPlaces: input.customPreferences.desiredPlaces
        ? normalizeUserInput(input.customPreferences.desiredPlaces)
        : undefined,
      customTravelIntent: input.customPreferences.customTravelIntent
        ? normalizeUserInput(input.customPreferences.customTravelIntent)
        : undefined,
      avoidPreferences: input.customPreferences.avoidPreferences
        ? normalizeUserInput(input.customPreferences.avoidPreferences)
        : undefined,
    },
    normalizedBudget,
    normalizedPeopleCount,
    normalizedArrivalTime:
      normalizedArrivalTime === null ? undefined : normalizedArrivalTime || undefined,
    normalizedDepartureTime:
      normalizedDepartureTime === null ? undefined : normalizedDepartureTime || undefined,
  };
}

export function validateTravelPlanForm(input: TravelPlanFormInput): TravelPlanValidationErrors {
  const errors: TravelPlanValidationErrors = {};
  const normalized = normalizeTravelPlanFormInput(input);
  const schedule = input.tripSchedule;
  const resolved = resolveTravelPlanScheduleFromInput(input);

  if (!normalized.destination) {
    errors.destination = '行き先を入力してください';
  }

  if (!schedule.departureDate.trim() || !isValidIsoDate(schedule.departureDate)) {
    errors.departureDate = '出発日を選んでください';
  }

  const hasValidReturnDate =
    isValidIsoDate(schedule.returnDate) &&
    (!isValidIsoDate(schedule.departureDate) || schedule.returnDate >= schedule.departureDate);
  const hasValidDuration = hasValidTripDurationSelection(schedule);

  if (schedule.durationPreset === 'その他' && !hasValidDuration) {
    errors.durationDuration = '旅行期間を正しく入力してください';
  }

  if (isValidIsoDate(schedule.departureDate)) {
    if (!hasValidReturnDate && !hasValidDuration) {
      errors.returnDate = '帰宅日を選ぶか、旅行期間を選んでください';
    } else if (
      hasValidReturnDate &&
      isValidIsoDate(schedule.returnDate) &&
      schedule.returnDate < schedule.departureDate
    ) {
      errors.returnDate = '帰宅日は出発日以降にしてください';
    }
  } else if (!hasValidReturnDate && !hasValidDuration) {
    errors.returnDate = '帰宅日を選ぶか、旅行期間を選んでください';
  }

  if (
    isValidIsoDate(resolved.departureDate) &&
    isValidIsoDate(resolved.returnDate) &&
    resolved.returnDate < resolved.departureDate
  ) {
    errors.returnDate = '帰宅日は出発日以降にしてください';
  }

  if (input.arrivalTime?.trim()) {
    const arrival = normalizeTimeInput(input.arrivalTime);
    if (arrival === null) {
      errors.arrivalTime = '時間を選択してください';
    }
  }

  if (input.departureTime?.trim()) {
    const departure = normalizeTimeInput(input.departureTime);
    if (departure === null) {
      errors.departureTime = '時間を選択してください';
    }
  }

  if (input.budget.trim() && !parseBudgetAmount(input.budget)) {
    errors.budget = '予算は数字で入力してください';
  } else if (!parseBudgetAmount(input.budget)) {
    errors.budget = '予算を入力してください';
  }

  if (input.peopleCount.trim() && !parsePeopleCount(input.peopleCount)) {
    errors.peopleCount = '人数は数字で入力してください';
  } else if (!parsePeopleCount(input.peopleCount)) {
    errors.peopleCount = '人数を入力してください';
  }

  if (!input.companionType) {
    errors.companionType = '誰と行くか選んでください';
  }

  return errors;
}

export function resolveTravelPurpose(input: TravelPlanFormInput): string {
  return resolveTravelPurposeValue({
    travelPurpose: input.travelPurpose,
    travelIntent: input.travelIntent,
    customTravelIntent: normalizeTravelPlanFormInput(input).customPreferences.customTravelIntent,
  });
}

export function getTravelPlanValidationMessages(
  errors: TravelPlanValidationErrors,
): string[] {
  return Object.values(errors).filter((message): message is string => Boolean(message));
}

export function isTravelPlanFormValid(errors: TravelPlanValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}

export function getFirstTravelPlanValidationError(
  errors: TravelPlanValidationErrors,
): string | null {
  const order: TravelPlanValidationField[] = [
    'destination',
    'departureDate',
    'returnDate',
    'durationDuration',
    'arrivalTime',
    'departureTime',
    'budget',
    'peopleCount',
    'companionType',
    'travelPurpose',
  ];

  for (const key of order) {
    const message = errors[key];
    if (message) return message;
  }

  return null;
}

export function getTravelPlanBudgetIncludes(input: TravelPlanFormInput): TravelBudgetIncludeOption[] {
  return resolveTravelBudgetIncludes(input.budgetIncludes);
}

export function buildTravelPlanSubmitPayload(input: TravelPlanFormInput) {
  const normalized = normalizeTravelPlanFormInput(input);
  const travelPurpose = resolveTravelPurpose(input);
  const duration = getTravelPlanDurationMeta(input);
  const budgetIncludes = getTravelPlanBudgetIncludes(input);
  const budgetScope = travelBudgetIncludesToBudgetScope(input.budgetIncludes);

  return {
    mode: 'travel' as const,
    destination: normalized.destination,
    departureDate: duration.departureDate,
    returnDate: duration.returnDate,
    durationLabel: duration.durationLabel,
    nights: duration.nights,
    days: duration.days,
    durationPreset: duration.durationPreset,
    customDuration: duration.customDuration,
    arrivalTime: normalized.normalizedArrivalTime,
    departureTime: normalized.normalizedDepartureTime,
    budget: normalized.normalizedBudget,
    currency: input.currency,
    budgetIncludes,
    budgetScope,
    peopleCount: normalized.normalizedPeopleCount,
    companionType: input.companionType,
    travelPurpose,
    customRequest: normalized.customPreferences.desiredPlaces || undefined,
  };
}

export function applyNormalizedTravelPlanFormState(input: TravelPlanFormInput): {
  location: string;
  budget: string;
  people: string;
  arrivalTime?: string;
  departureTime?: string;
  customPreferences: PlanCustomPreferences;
} {
  const normalized = normalizeTravelPlanFormInput(input);
  return {
    location: normalized.destination,
    budget: normalized.normalizedBudget,
    people: normalized.normalizedPeopleCount,
    arrivalTime: normalized.normalizedArrivalTime,
    departureTime: normalized.normalizedDepartureTime,
    customPreferences: normalized.customPreferences,
  };
}
