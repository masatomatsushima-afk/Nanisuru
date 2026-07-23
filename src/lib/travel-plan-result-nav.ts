import { router } from 'expo-router';

import type { CurrencyCode } from '@/constants/currency';
import { LOOP_TEST_RESTORE } from '@/lib/loop-test-config';
import { cleanSerializable, serializeRouteParamJson } from '@/lib/safe-json';
import { safeRouteParams, safeText } from '@/lib/safe-text';
import {
  buildTravelPlanSubmitPayload,
  type TravelPlanFormInput,
} from '@/lib/travel-plan-form-validation';
import type { TravelBudgetIncludeOption } from '@/lib/travel-budget-includes';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { TravelIntentOption } from '@/types/plan-creation';
import type { TravelTimingSettings } from '@/types/travel-timing';
import type { TripScheduleEditorValue } from '@/types/trip-schedule';

export type TravelPlanSubmitSnapshot = {
  location: string;
  country?: string;
  city?: string;
  baseArea?: string;
  arrivalPoint?: string;
  destinationLabel?: string;
  budget: string;
  people: string;
  currency: CurrencyCode;
  companion: CompanionOption;
  travelTiming: TravelTimingSettings;
  travelIntent: TravelIntentOption | '';
  customPreferences: PlanCustomPreferences;
  tripSchedule: TripScheduleEditorValue;
  budgetIncludes: TravelBudgetIncludeOption[];
  travelPurpose: string;
  accommodation?: string;
  /** Multi-purpose selection (1–3) with priority/weight — optional for backward compat. */
  selectedPurposes?: import('@/lib/selected-purposes').SelectedPurpose[];
};

export function snapshotToTravelPlanFormInput(
  snap: TravelPlanSubmitSnapshot,
): TravelPlanFormInput {
  return {
    destination: snap.location,
    country: snap.country,
    city: snap.city,
    baseArea: snap.baseArea,
    arrivalPoint: snap.arrivalPoint,
    tripSchedule: snap.tripSchedule,
    arrivalTime: snap.travelTiming.arrivalTime,
    departureTime: snap.travelTiming.departureTime,
    budget: snap.budget,
    currency: snap.currency,
    budgetIncludes: snap.budgetIncludes,
    peopleCount: snap.people,
    companionType: snap.companion,
    travelIntent: snap.travelIntent,
    travelPurpose: snap.travelPurpose,
    customPreferences: snap.customPreferences,
    accommodation: snap.accommodation,
  };
}

export function buildTravelPlanResultRouteParams(
  snap: TravelPlanSubmitSnapshot,
  plan?: { days: ItineraryDay[]; details: PlanDetails },
): Record<string, string> {
  const payload = buildTravelPlanSubmitPayload(snapshotToTravelPlanFormInput(snap));

  const raw: Record<string, unknown> = {
    destination: payload.destination,
    departureDate: payload.departureDate,
    returnDate: payload.returnDate,
    durationLabel: payload.durationLabel,
    nights: payload.nights,
    days: payload.days,
    arrivalTime: payload.arrivalTime ?? '',
    departureTime: payload.departureTime ?? '',
    budget: payload.budget,
    currency: payload.currency,
    budgetIncludes: serializeRouteParamJson(payload.budgetIncludes),
    peopleCount: payload.peopleCount,
    companion: payload.companionType,
    travelPurpose: payload.travelPurpose,
    customRequest: payload.customRequest ?? '',
  };

  // Do not pass full plan JSON in route params — Safari/web URL length limits cause navigation failures.
  void plan;

  return safeRouteParams(raw);
}

export function logTravelPlanSubmitPayload(snap: TravelPlanSubmitSnapshot): void {
  if (!__DEV__) return;
  const payload = buildTravelPlanSubmitPayload(snapshotToTravelPlanFormInput(snap));
  console.log('[TravelPlanForm] submit payload', payload);
}

export function navigateAfterTravelPlanGeneration(
  snap: TravelPlanSubmitSnapshot,
  plan: { days: ItineraryDay[]; items: ItineraryItem[]; details: PlanDetails },
  detailParams: Record<string, string>,
): void {
  if (!LOOP_TEST_RESTORE.travelPlanGeneration) return;

  if (LOOP_TEST_RESTORE.planDetailRoute) {
    if (__DEV__) {
      console.log('[TravelPlanSubmit] generated plan before serialize', plan);
      console.log('[TravelPlanSubmit] plan detail params keys', Object.keys(detailParams));
    }
    router.push({
      pathname: '/plan-detail',
      params: detailParams,
    } as never);
    return;
  }

  const resultParams = buildTravelPlanResultRouteParams(snap, plan);
  if (__DEV__) {
    console.log('[TravelPlanSubmit] generated plan before serialize', plan);
    console.log('[TravelPlanSubmit] result route params keys', Object.keys(resultParams));
  }

  router.push({
    pathname: '/travel-plan-result',
    params: resultParams,
  } as never);
}

export function buildPlanDetailParamsFromGeneration(input: {
  snap: TravelPlanSubmitSnapshot;
  plan: { days: ItineraryDay[]; items: ItineraryItem[]; details: PlanDetails };
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
}): Record<string, string> {
  const cleanPlan = cleanSerializable({
    days: input.plan.days,
    items: input.plan.items,
    details: input.plan.details,
  });

  if (__DEV__) {
    console.log('[TravelPlanSubmit] serialized planJson lengths', {
      days: serializeRouteParamJson(cleanPlan.days).length,
      items: serializeRouteParamJson(cleanPlan.items).length,
      details: serializeRouteParamJson(cleanPlan.details).length,
    });
  }

  return safeRouteParams({
    location: input.snap.location,
    budget: input.snap.budget,
    currency: input.snap.currency,
    people: input.snap.people,
    mood: input.snap.travelPurpose,
    companion: input.snap.companion,
    personality: input.personality,
    tripDuration: input.tripDuration,
    days: serializeRouteParamJson(cleanPlan.days),
    items: serializeRouteParamJson(cleanPlan.items),
    details: serializeRouteParamJson(cleanPlan.details),
    travelPurpose: input.snap.travelPurpose,
    budgetIncludes: serializeRouteParamJson(input.snap.budgetIncludes),
  });
}

export function formatTravelPlanResultSummary(
  params: Record<string, string | string[] | undefined>,
): string {
  const read = (key: string) => safeText(Array.isArray(params[key]) ? params[key][0] : params[key]);
  return [
    `行き先: ${read('destination')}`,
    `旅行の目的: ${read('travelPurpose')}`,
    `期間: ${read('durationLabel')}`,
    `予算: ${read('budget')} ${read('currency')}`,
  ].join('\n');
}
