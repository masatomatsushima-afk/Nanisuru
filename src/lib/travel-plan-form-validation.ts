import { isValidIsoDate } from '@/lib/trip-schedule';
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

import { formatCombinedTravelIntent } from './plan-creation';

export type TravelPlanFormInput = {
  destination: string;
  departureDate: string;
  returnDate: string;
  arrivalTime?: string;
  departureTime?: string;
  budget: string;
  currency: CurrencyCode;
  peopleCount: string;
  companionType: CompanionOption | null;
  travelIntent: TravelIntentOption | '';
  customPreferences: PlanCustomPreferences;
};

export type TravelPlanValidationField =
  | 'destination'
  | 'departureDate'
  | 'returnDate'
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

  if (!normalized.destination) {
    errors.destination = '行き先を入力してください';
  }

  if (!input.departureDate.trim() || !isValidIsoDate(input.departureDate)) {
    errors.departureDate = '出発日を選んでください';
  }

  if (!input.returnDate.trim() || !isValidIsoDate(input.returnDate)) {
    errors.returnDate = '帰宅日を選んでください';
  } else if (
    isValidIsoDate(input.departureDate) &&
    isValidIsoDate(input.returnDate) &&
    input.returnDate < input.departureDate
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
  const normalized = normalizeTravelPlanFormInput(input);
  const travelPurpose = formatCombinedTravelIntent(
    input.travelIntent,
    normalized.customPreferences.customTravelIntent,
  );
  return travelPurpose.trim() || 'AIに任せる';
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

export function buildTravelPlanSubmitPayload(input: TravelPlanFormInput) {
  const normalized = normalizeTravelPlanFormInput(input);
  const travelPurpose = resolveTravelPurpose(input);

  return {
    mode: 'travel' as const,
    destination: normalized.destination,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    arrivalTime: normalized.normalizedArrivalTime,
    departureTime: normalized.normalizedDepartureTime,
    budget: normalized.normalizedBudget,
    currency: input.currency,
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
