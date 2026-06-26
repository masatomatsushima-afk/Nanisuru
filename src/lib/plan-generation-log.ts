import type { CurrencyCode } from '@/constants/currency';
import type { CompanionOption, PersonalityOption, TripDurationOption } from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { PlanCreationType, TravelIntentOption } from '@/types/plan-creation';
import type { NearbyPlacesContext } from '@/types/nearby-places';
import type { CustomTripDuration } from '@/types/trip-schedule';

import {
  formatCombinedTravelIntent,
  showsMoodQuestion,
  showsTravelIntentQuestion,
} from './plan-creation';
import { formatCombinedMood } from './custom-preferences';
import { getDurationDisplayLabel } from './trip-duration';
import { validateTripSchedule } from './trip-schedule';
import type { TripScheduleEditorValue } from '@/types/trip-schedule';
import { AppError, APP_MESSAGES } from './app-errors';

export type NormalizedPlanGenerationInput = {
  planType?: PlanCreationType;
  location: string;
  departureDate: string;
  returnDate: string;
  durationLabel: string;
  tripDuration: TripDurationOption;
  customDuration?: CustomTripDuration;
  budget: string;
  currency: CurrencyCode;
  people: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  mood: string;
  travelPurpose: string;
  mustVisitPlaces: string;
  avoidPreferences: string;
  customPreferences?: PlanCustomPreferences;
};

export type PlanGenerationLogPayload = NormalizedPlanGenerationInput & {
  realPlacesCount?: number;
  realPlacesSource?: string;
  realPlacesNotice?: string;
  promptPreview?: string;
  systemPromptPreview?: string;
};

const LOG_PREFIX = '[Nanisuru PlanGen]';

export function logPlanGenerationStep(
  step: string,
  payload?: Record<string, unknown>,
): void {
  if (__DEV__) {
    console.log(`${LOG_PREFIX} ${step}`, payload ?? '');
  }
}

export function logPlanGenerationError(
  step: string,
  error: unknown,
  payload?: Record<string, unknown>,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`${LOG_PREFIX} ERROR ${step}`, {
    message,
    stack,
    ...(payload ?? {}),
  });
}

export function normalizePlanGenerationInput(input: {
  planCreationType?: PlanCreationType;
  location: string;
  tripDate: string;
  tripEndDate?: string;
  tripDuration: TripDurationOption;
  customDuration?: CustomTripDuration;
  budget: string;
  currency: CurrencyCode;
  people: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  mood: string;
  travelIntent?: string;
  customPreferences?: PlanCustomPreferences;
}): NormalizedPlanGenerationInput {
  const durationLabel = getDurationDisplayLabel(input.tripDuration, input.customDuration);
  const mood = formatCombinedMood(input.mood, input.customPreferences?.customMood);
  const travelPurpose = formatCombinedTravelIntent(
    (input.travelIntent ?? '') as TravelIntentOption | '',
    input.customPreferences?.customTravelIntent,
  );

  return {
    planType: input.planCreationType,
    location: input.location.trim(),
    departureDate: input.tripDate,
    returnDate: input.tripEndDate ?? input.tripDate,
    durationLabel,
    tripDuration: input.tripDuration,
    customDuration: input.customDuration,
    budget: input.budget.trim(),
    currency: input.currency,
    people: input.people.trim(),
    companion: input.companion,
    personality: input.personality,
    mood,
    travelPurpose,
    mustVisitPlaces: input.customPreferences?.desiredPlaces?.trim() ?? '',
    avoidPreferences: input.customPreferences?.avoidPreferences?.trim() ?? '',
    customPreferences: input.customPreferences,
  };
}

export function validatePlanGenerationInput(
  normalized: NormalizedPlanGenerationInput,
  schedule?: TripScheduleEditorValue,
): void {
  if (!normalized.location) {
    throw new AppError(APP_MESSAGES.locationRequired, 'NO_PLACES_FOUND');
  }

  if (!normalized.companion) {
    throw new AppError(APP_MESSAGES.inputIncomplete, 'INPUT_INCOMPLETE');
  }

  if (schedule) {
    const scheduleError = validateTripSchedule(schedule);
    if (scheduleError) {
      throw new AppError(scheduleError, 'INPUT_INCOMPLETE');
    }
  }

  const planType = normalized.planType;

  if (planType && showsMoodQuestion(planType) && !normalized.mood) {
    throw new AppError(
      '気分を選ぶか、「その他の気分を入力」に記入してください。',
      'INPUT_INCOMPLETE',
    );
  }

  if (planType && showsTravelIntentQuestion(planType) && !normalized.travelPurpose) {
    throw new AppError(
      '旅行の目的を選ぶか、「その他を入力」に記入してください。',
      'INPUT_INCOMPLETE',
    );
  }
}

export function buildPlanGenerationLogPayload(
  normalized: NormalizedPlanGenerationInput,
  extras?: {
    realPlaces?: NearbyPlacesContext | null;
    prompt?: string;
    systemPrompt?: string;
  },
): PlanGenerationLogPayload {
  return {
    ...normalized,
    realPlacesCount: extras?.realPlaces?.places.length,
    realPlacesSource: extras?.realPlaces?.source,
    realPlacesNotice: extras?.realPlaces?.notice,
    promptPreview: extras?.prompt?.slice(0, 1200),
    systemPromptPreview: extras?.systemPrompt?.slice(0, 600),
  };
}

export function resolveEffectiveMoodForPrompt(normalized: NormalizedPlanGenerationInput): string {
  if (
    normalized.planType &&
    showsTravelIntentQuestion(normalized.planType)
  ) {
    return normalized.travelPurpose || '未指定';
  }

  if (
    normalized.planType &&
    showsMoodQuestion(normalized.planType)
  ) {
    return normalized.mood || '未指定';
  }

  return normalized.mood || normalized.travelPurpose || '未指定';
}
