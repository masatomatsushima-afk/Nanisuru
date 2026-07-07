import type { PlanInput } from './prompts';
import type { TripDurationOption } from '@/types/plan';

export type PlanGenerationDevMeta = {
  destination: string;
  departureDate: string;
  returnDate: string;
  durationLabel: string;
  arrivalTime?: string;
  departureTime?: string;
  budget: string;
  currency: string;
  budgetIncludes?: string;
  peopleCount: string;
  companion: string;
  travelPurpose: string;
  customRequest?: string;
  weatherSummary?: string;
  preferencesSummary?: string;
  localGemsCount: number;
};

export function extractPlanGenerationDevMeta(input: PlanInput): PlanGenerationDevMeta {
  const budgetIncludes = input.budgetScope?.includedItems?.length
    ? input.budgetScope.includedItems.join('・')
    : undefined;

  const preferencesParts = [
    input.userPreferences?.favoriteTravelStyle
      ? `旅行タイプ:${input.userPreferences.favoriteTravelStyle}`
      : null,
    input.userPreferences?.budgetPreference
      ? `予算感:${input.userPreferences.budgetPreference}`
      : null,
    input.travelUserPreferences?.travelPace
      ? `ペース:${input.travelUserPreferences.travelPace}`
      : null,
  ].filter(Boolean);

  return {
    destination: input.location.trim() || '未指定',
    departureDate: input.departureDate ?? input.tripDate,
    returnDate: input.returnDate ?? input.tripEndDate ?? input.tripDate,
    durationLabel: input.durationLabel ?? input.tripDuration,
    arrivalTime: input.travelTiming?.arrivalTime,
    departureTime: input.travelTiming?.departureTime,
    budget: input.budget.trim() || '未指定',
    currency: input.currency,
    budgetIncludes,
    peopleCount: input.people.trim() || '1',
    companion: input.companion,
    travelPurpose:
      input.travelPurpose?.trim() ||
      input.customPreferences?.customTravelIntent?.trim() ||
      input.mood?.trim() ||
      '旅行',
    customRequest:
      input.customPreferences?.desiredPlaces?.trim() ||
      input.mustVisitPlaces?.trim() ||
      input.customPreferences?.customMood?.trim() ||
      undefined,
    weatherSummary: input.weather?.summary?.trim() || input.weather?.seasonalContext?.guidance,
    preferencesSummary: preferencesParts.length ? preferencesParts.join(' / ') : undefined,
    localGemsCount: input.localHiddenSpots?.length ?? 0,
  };
}

export function getPromptLengthFromRequestPayload(requestPayload: unknown): number {
  if (!requestPayload || typeof requestPayload !== 'object') return 0;
  const input = (requestPayload as { input?: Array<{ content?: string }> }).input;
  return (input ?? []).reduce((sum, message) => sum + (message.content?.length ?? 0), 0);
}

export function buildCompactPromptPlanInput(input: PlanInput): PlanInput {
  return {
    ...input,
    travelMemories: undefined,
    travelUserPreferences: undefined,
    realPlaces: undefined,
    spontaneous: undefined,
    bestDay: undefined,
    planAdjustment: undefined,
    weatherReplan: undefined,
    itineraryBalanceFix: undefined,
    itineraryQualityFix: undefined,
    avoidActivities: undefined,
    localHiddenSpots: input.localHiddenSpots?.slice(0, 3),
    compactPrompt: true,
  };
}

export function buildCompactSystemPrompt(tripDuration: TripDurationOption, dayCount: number): string {
  return (
    'あなたは旅行プランナーです。指定JSONスキーマのみ返してください。' +
    '日本語で、実在しそうなスポット名を使い、食事だけに偏らない行程にしてください。' +
    `期間:${tripDuration}${dayCount > 1 ? `・${dayCount}日分のdays配列` : ''}。` +
    'conciergeAnalysis・budgetBreakdown・days・highlights・rainyDayAlternativesを含めてください。'
  );
}
