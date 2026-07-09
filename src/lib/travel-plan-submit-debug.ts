import { Platform } from 'react-native';

import { isOpenAiConfigured } from '@/lib/env';
import {
  getGeneratePlanApiUrlForLog,
  shouldUsePlanGenerationApiProxy,
} from '@/lib/plan-api-url';
import {
  buildTravelPlanSubmitPayload,
  type TravelPlanFormInput,
  type TravelPlanValidationErrors,
} from '@/lib/travel-plan-form-validation';
import { OpenAiRequestError, PlanGenerationRequestError, getPlanGenerationRequestUrl } from '@/lib/app-errors';

const VALIDATION_FIELD_LABELS: Record<string, string> = {
  destination: '行き先',
  departureDate: '出発日',
  returnDate: '帰宅日',
  durationDuration: '旅行期間',
  arrivalTime: '到着時間',
  departureTime: '帰り時間',
  budget: '予算',
  peopleCount: '人数',
  companionType: '誰と行く？',
  travelPurpose: '旅行の目的',
};

export function logTravelPlanSubmitFinalState(input: TravelPlanFormInput): void {
  const payload = buildTravelPlanSubmitPayload(input);

  console.log('[TravelPlanSubmit] final form state', {
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
    budgetIncludes: payload.budgetIncludes,
    peopleCount: payload.peopleCount,
    companion: payload.companionType,
    travelPurpose: payload.travelPurpose,
    customRequest: payload.customRequest ?? '',
  });
}

export function logTravelPlanAiAvailability(): void {
  const useProxy = shouldUsePlanGenerationApiProxy();
  console.log('[AI] hasOpenAIKey', isOpenAiConfigured());
  console.log('[AI] model', 'gpt-4o-mini');
  console.log('[AI] platform', Platform.OS);
  console.log('[AI] usePlanApiProxy', useProxy);
  if (useProxy) {
    console.log('[AI] planApiUrl', getGeneratePlanApiUrlForLog());
    console.warn(
      '[AI] web client uses /api/generate-plan proxy — OpenAI key stays on server',
    );
  } else if (Platform.OS === 'web') {
    console.warn(
      '[AI] web client calls OpenAI directly — if generation fails with "Failed to fetch", use the native app or an API proxy',
    );
  }
}

function isSafeSerializableValue(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value == null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return true;
  if (type === 'symbol' || type === 'function') return false;
  if (Array.isArray(value)) {
    return value.every((item) => isSafeSerializableValue(item, depth + 1));
  }
  if (type === 'object') {
    if (value instanceof Date) return false;
    return Object.values(value as Record<string, unknown>).every((item) =>
      isSafeSerializableValue(item, depth + 1),
    );
  }
  return false;
}

export function logTravelPlanPayloadSafety(input: TravelPlanFormInput): void {
  const payload = buildTravelPlanSubmitPayload(input);
  if (isSafeSerializableValue(payload)) {
    console.log('[TravelPlanSubmit] payload serialization check OK');
    return;
  }
  console.warn('[TravelPlanSubmit] payload contains non-serializable values', payload);
}

export function logTravelPlanValidationFailure(errors: TravelPlanValidationErrors): void {
  const missingFields = Object.keys(errors);
  const labels = missingFields.map((key) => VALIDATION_FIELD_LABELS[key] ?? key);
  console.warn('[TravelPlanSubmit] validation failed', { missingFields, labels, errors });
}

export function formatTravelPlanValidationUserMessage(
  errors: TravelPlanValidationErrors,
): string {
  const labels = Object.keys(errors)
    .map((key) => VALIDATION_FIELD_LABELS[key] ?? key)
    .filter(Boolean);

  if (labels.length === 0) {
    return '未入力の項目があります';
  }

  return `未入力の項目があります\n${labels.join('、')}を入力してください`;
}

/**
 * AI/network generation failures are expected (timeout, 5xx, offline, malformed response) and are
 * handled by retry + a dev fallback plan wherever possible — never console.error here, or
 * Expo/RN Web shows a red screen even on runs that otherwise recover fine. Kept at console.warn
 * (and only in __DEV__) so it's still visible for debugging without alarming the UI.
 */
export function logTravelPlanGenerationFailed(error: unknown): void {
  if (!__DEV__) return;

  const requestUrl = getPlanGenerationRequestUrl(error);
  const record =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  console.warn('[TravelPlanSubmit] generation failed', {
    platform: Platform.OS,
    requestUrl,
    message: error instanceof Error ? error.message : String(error),
    status:
      error instanceof OpenAiRequestError
        ? error.status
        : typeof record.status === 'number'
          ? record.status
          : undefined,
    statusText: error instanceof OpenAiRequestError ? error.statusText : undefined,
    body:
      error instanceof OpenAiRequestError
        ? error.body
        : typeof record.body === 'string'
          ? record.body
          : undefined,
    code: record.code,
  });
}
