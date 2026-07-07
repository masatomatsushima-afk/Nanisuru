import type {
  AiAdvice,
  BudgetBreakdown,
  ConciergeAnalysis,
  ItineraryDay,
  ItineraryItem,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';
import type { ImaHimaMoodOption, ImaHimaTimeOption } from '@/types/imafima';
import type { BestDayMoodOption, BestDayTimeOption } from '@/types/best-day';


import { getOpenAiApiKey, isOpenAiConfigured } from './env';
import {
  buildSpontaneousContext,
  getImaHimaTripDuration,
  resolveMoodPreferences,
} from './imafima';
import {
  buildBestDayContext,
  getBestDayTripDuration,
  resolveBestDayPreferences,
} from './best-day';
import { buildConciergePrompt, type PlanInput } from './prompts';
import {
  getGeneratePlanApiUrlForLog,
  getWindowOriginForLog,
  shouldUsePlanGenerationApiProxy,
  validatePlanApiRequestConfig,
} from './plan-api-url';
import { safeJsonParse, stripJsonCodeFence } from './safe-json';
import { flattenItineraryDays, resolveDurationConfig } from './trip-duration';
import { fetchWeatherForecast, getTodayIsoDate, resolveWeatherLocation, resolveWeatherForTrip, createUnavailableWeatherForecast, type WeatherForecast } from './weather';
import { getUserPreferences } from './user-memory';
import { getTravelMemories } from './travel-memory';
import { getTravelUserPreferences } from './travel-user-preferences';
import { hasTravelUserPreferences } from '@/types/travel-user-preferences';
import {
  loadRelevantLocalGemsForPlan,
  shouldPrioritizeLocalHiddenSpots,
} from './local-hidden-spots';
import {
  buildEmptyPlacesContext,
  enrichPlanWithRealPlaceLinks,
  fetchRealPlacesForLocation,
} from './location-places';
import {
  analyzeItineraryBalance,
  isGourmetTourIntent,
  ITINERARY_ACTIVITY_CATEGORIES,
} from './itinerary-balance';
import {
  dedupeItineraryPlaces,
  logItineraryQualityReport,
  shouldAttemptQualityFix,
  validateItineraryQuality,
} from './itinerary-quality';
import { finalizeItineraryBeforeDisplay } from './finalize-itinerary';
import { isAbortError } from './plan-generation-progress';
import { inferCurrencyFromLocation } from './location-currency';
import {
  APP_MESSAGES,
  AppError,
  OpenAiRequestError,
  PlanGenerationRequestError,
  resolvePlanGenerationFetchFailure,
} from './app-errors';
import {
  AiGenerationTimeoutError,
  createGenerationAbortSignal,
  getOpenAiRetryDelayMs,
  isRetryableOpenAiError,
  OPENAI_MAX_GENERATION_ATTEMPTS,
  sleep,
} from './openai-generation';
import { isDevFallbackEligibleError } from './openai-dev-fallback';
import {
  buildCompactPromptPlanInput,
  buildCompactSystemPrompt,
  extractPlanGenerationDevMeta,
} from './plan-generation-dev-meta';
import {
  buildDevFallbackTravelPlan,
  parseDevFallbackTravelPlanFromApiResponse,
} from './travel-plan-dev-fallback';
import { learnFromCustomPreferences } from './custom-preferences';
import {
  buildPlanGenerationLogPayload,
  logPlanGenerationError,
  logPlanGenerationStep,
  normalizePlanGenerationInput,
  validatePlanGenerationInput,
} from './plan-generation-log';
import type { CurrencyCode } from '@/constants/currency';
import type { CustomTripDuration } from '@/types/trip-schedule';
import type { TourSuggestion, TravelTimingSettings } from '@/types/travel-timing';
import {
  BUDGET_KEY_DESCRIPTIONS,
  getBreakdownKeysForScope,
} from './budget-scope';
import { buildDefaultPreTripBookingLinks } from './pre-trip-links';
import {
  generateOutfitPackingAdvice,
  logOutfitAdviceGenerated,
} from './outfit-packing-advice';
import type { BudgetScopeSettings } from '@/types/budget-scope';

export type GeneratedPlan = {
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
  /** Shown in dev when OpenAI timed out and a sample plan was used instead. */
  devFallbackNotice?: string;
};

export { isOpenAiConfigured };

type AiPlanResponse = {
  conciergeAnalysis?: ConciergeAnalysis;
  plannerMessage?: string;
  days?: ItineraryDay[];
  budgetBreakdown?: BudgetBreakdown;
  totalBudget?: string;
  duration?: string;
  highlights?: string[];
  rainyDayAlternatives?: string[];
  weatherReplanChanges?: string[];
  aiAdvice?: AiAdvice;
  tourSuggestions?: TourSuggestion[];
};

const ITINERARY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    time: { type: 'string', description: 'Start time HH:MM' },
    activity: { type: 'string', description: 'Real place name in Japanese — must match provided real places list when available' },
    activityCategory: {
      type: 'string',
      enum: [...ITINERARY_ACTIVITY_CATEGORIES],
      description:
        'Itinerary stop category in Japanese: 食事 / カフェ / 散歩 / 体験 / 景色 / 買い物 / 文化 / 休憩 / 夜景 / 移動',
    },
    placeCategory: {
      type: 'string',
      description:
        'Short category label for the place in Japanese or English e.g. カフェ cafe brunch 美術館 — used for social search',
    },
    reason: {
      type: 'string',
      description:
        'Detailed selection reasoning in 2-3 Japanese sentences referencing preferences weather budget or travel style',
    },
    estimatedCost: {
      type: 'string',
      description: 'Realistic cost estimate with currency symbol considering party size',
    },
    transportation: {
      type: 'string',
      description:
        'Specific transport to next stop with route station walking time and fare hint; use — for last item of each day',
    },
    reservationUrl: {
      type: 'string',
      description:
        'Direct reservation URL (official booking, Tabelog reserve, etc.) or empty string if not applicable',
    },
    websiteUrl: {
      type: 'string',
      description: 'Official website URL or empty string if unknown',
    },
    travelTimeToNext: {
      type: 'string',
      description:
        'Estimated travel time to next stop in Japanese e.g. 約15分（徒歩）; use — for last item of each day',
    },
    weatherBackup: {
      type: 'string',
      description:
        'Rain or bad weather alternative for this stop in one Japanese sentence; or 天候に関わらず可 if always suitable',
    },
  },
  required: [
    'time',
    'activity',
    'activityCategory',
    'placeCategory',
    'reason',
    'estimatedCost',
    'transportation',
    'reservationUrl',
    'websiteUrl',
    'travelTimeToNext',
    'weatherBackup',
  ],
  additionalProperties: false,
} as const;

const CONCIERGE_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    userPreferences: {
      type: 'string',
      description: 'Analysis of user preferences and history in Japanese 2-3 sentences',
    },
    weather: {
      type: 'string',
      description:
        'Weather and seasonal analysis memo in Japanese 2-3 sentences. For future trips use seasonal tendencies not exact forecast. Include clothing advice hint.',
    },
    budget: {
      type: 'string',
      description: 'Budget analysis and allocation strategy in Japanese 2-3 sentences',
    },
    tripDuration: {
      type: 'string',
      description: 'Trip duration and schedule pacing analysis in Japanese 2-3 sentences',
    },
    travelStyle: {
      type: 'string',
      description: 'Travel personality and companion style analysis in Japanese 2-3 sentences',
    },
    overallStrategy: {
      type: 'string',
      description: 'Overall concierge planning strategy in Japanese 2-4 sentences',
    },
  },
  required: [
    'userPreferences',
    'weather',
    'budget',
    'tripDuration',
    'travelStyle',
    'overallStrategy',
  ],
  additionalProperties: false,
} as const;

const AI_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    conversationTips: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 4,
    },
    recommendedTopics: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 4,
    },
    topicsToAvoid: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 3,
    },
  },
  required: ['conversationTips', 'recommendedTopics', 'topicsToAvoid'],
  additionalProperties: false,
} as const;

const BUDGET_BREAKDOWN_SCHEMA = {
  type: 'object',
  properties: {
    total: { type: 'string', description: 'Total budget with currency symbol in Japanese' },
    accommodation: { type: 'string', description: 'Accommodation cost estimate in Japanese' },
    food: { type: 'string', description: 'Food cost estimate in Japanese' },
    transportation: { type: 'string', description: 'Transportation cost estimate in Japanese' },
    activity: { type: 'string', description: 'Activity cost estimate in Japanese' },
  },
  required: ['total', 'accommodation', 'food', 'transportation', 'activity'],
  additionalProperties: false,
} as const;

function buildBudgetBreakdownSchema(budgetScope?: BudgetScopeSettings) {
  if (!budgetScope) {
    return BUDGET_BREAKDOWN_SCHEMA;
  }

  const keys = getBreakdownKeysForScope(budgetScope);
  const properties: Record<string, unknown> = {
    total: { type: 'string', description: 'Total budget with currency symbol in Japanese' },
  };

  for (const key of keys) {
    properties[key] = {
      type: 'string',
      description: `${BUDGET_KEY_DESCRIPTIONS[key]}（${symbolHint(key)}）`,
    };
  }

  const required = ['total', ...keys];

  if (budgetScope.customItems.length > 0) {
    properties.customItems = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          amount: { type: 'string' },
        },
        required: ['label', 'amount'],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: Math.max(budgetScope.customItems.length, 1),
    };
    required.push('customItems');
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

function symbolHint(_key: string): string {
  return '現地通貨記号付き';
}

const TOUR_SUGGESTION_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    dayNumber: {
      type: ['number', 'null'],
      description: 'Suggested day number (1-based), or null if not tied to a specific day',
    },
    title: { type: 'string', description: 'Tour suggestion title in Japanese' },
    description: {
      type: 'string',
      description: 'Why this tour fits the trip in Japanese, mention booking if needed',
    },
    needsBooking: {
      type: 'boolean',
      description: 'True if advance booking is likely required',
    },
  },
  required: ['dayNumber', 'title', 'description', 'needsBooking'],
  additionalProperties: false,
} as const;

function buildPlanJsonSchema(
  tripDuration: TripDurationOption,
  includeAiAdvice: boolean,
  overrides?: { dayCount?: number; itemsMin?: number; itemsMax?: number },
  customDuration?: CustomTripDuration | null,
  budgetScope?: BudgetScopeSettings,
  options?: { includeTourSuggestions?: boolean; includeWeatherReplanChanges?: boolean },
) {
  const config = resolveDurationConfig(tripDuration, customDuration);
  const dayCount = overrides?.dayCount ?? config.dayCount;
  const itemsMin = overrides?.itemsMin ?? config.itemsMin;
  const itemsMax = overrides?.itemsMax ?? config.itemsMax;

  const properties: Record<string, unknown> = {
    plannerMessage: {
      type: 'string',
      description: 'Professional planner greeting message in Japanese',
    },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayNumber: { type: 'number', description: 'Day number starting at 1' },
          label: { type: 'string', description: 'Day label in Japanese e.g. 1日目' },
          theme: { type: 'string', description: 'Day theme in Japanese' },
          items: {
            type: 'array',
            items: ITINERARY_ITEM_SCHEMA,
            minItems: itemsMin,
            maxItems: itemsMax,
          },
        },
        required: ['dayNumber', 'label', 'theme', 'items'],
        additionalProperties: false,
      },
      minItems: dayCount,
      maxItems: dayCount,
    },
    budgetBreakdown: {
      ...buildBudgetBreakdownSchema(budgetScope),
      description: 'Category budget breakdown optimized for user budget in Japanese',
    },
    totalBudget: {
      type: 'string',
      description: 'Total trip budget with currency symbol in Japanese, same as budgetBreakdown.total',
    },
    duration: { type: 'string', description: 'Total duration in Japanese' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 4,
    },
    rainyDayAlternatives: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 5,
      description: 'Specific rainy-day backup spots with when to use them in Japanese',
    },
    conciergeAnalysis: {
      ...CONCIERGE_ANALYSIS_SCHEMA,
      description: 'Pre-itinerary concierge analysis in Japanese',
    },
  };

  if (options?.includeWeatherReplanChanges) {
    properties.weatherReplanChanges = {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 6,
      description:
        'Specific summary of weather-based plan changes in Japanese e.g. rain forecast indoor swap',
    };
  }

  const required = [
    'conciergeAnalysis',
    'plannerMessage',
    'days',
    'budgetBreakdown',
    'totalBudget',
    'duration',
    'highlights',
    'rainyDayAlternatives',
  ];

  if (includeAiAdvice) {
    properties.aiAdvice = {
      ...AI_ADVICE_SCHEMA,
      description: 'Date conversation advice in Japanese',
    };
    required.push('aiAdvice');
  }

  if (options?.includeTourSuggestions) {
    properties.tourSuggestions = {
      type: 'array',
      items: TOUR_SUGGESTION_ITEM_SCHEMA,
      minItems: 1,
      maxItems: 4,
      description: 'Optional tour and local experience suggestions for multi-day trips',
    };
    required.push('tourSuggestions');
  }

  if (options?.includeWeatherReplanChanges) {
    required.push('weatherReplanChanges');
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

const SYSTEM_PROMPT =
  'あなたはプロの旅行コンシェルジュです。' +
  '行程作成前に好み・天気・予算・期間・旅行スタイルを分析し、conciergeAnalysis に記載してから itinerary を設計してください。' +
  '各スポットには詳細な選定理由、現実的な概算費用、具体的な交通手段、天候変化時の代替（weatherBackup）を必ず含めてください。' +
  'プランは食事ばかりにせず、散歩・体験・景色・文化・休憩を織り交ぜた人間らしい1日の流れにすること。' +
  '実在のスポット名、丁寧な日本語、指定JSONスキーマに厳密に従って回答してください。';

const REGENERATE_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 別プラン提案時は、前回提案済みのスポット名を絶対に再利用せず、条件を保ちながら全く異なるプランを作成してください。';

const DATE_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' カップル・初デート向けの場合は、プラン内容に合わせた会話アドバイス（aiAdvice）も日本語で作成してください。';

const MULTI_DAY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 複数日の旅行では、days配列の各日ごとに独立した itinerary を日本語で作成してください。';

const WEATHER_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 天気予報が提供されている場合は、雨の日は屋内スポットを、晴れの日は屋外スポットを優先してください。';

const MEMORY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' ユーザーの好み（旅行タイプ・予算・期間・アクティビティ）が記憶されている場合は、矛盾しない範囲でプランに反映してください。';

const IMA_HIMA_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 即興プラン（今暇モード）では今すぐ行ける近場スポットを優先し、移動時間を最小限にしてください。';

const BEST_DAY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 最高の1日モードでは、ユーザーは計画を一切任せています。' +
  'プレミアムAIコンシェルジュとして、感情に寄り添い、theme・overallStrategy（選定理由）・plannerMessage（一言）・highlights・timeline を完璧に設計してください。' +
  '旅行メモリーがある場合は最優先で反映し、ユーザーが「自分のことを理解してくれた」と感じさせてください。' +
  'plannerMessage は1〜2文の感情的な一言、overallStrategy は2〜4文の選定理由 — 役割を混同しないこと。';

const ADJUST_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 既存プラン調整モード: ベースプランの構造と良い要素を参考にしつつ、ユーザーの調整指示と編集後の条件に合わせて全体を更新してください。' +
  '行程・費用・選定理由を一貫して更新し、指定JSONスキーマに従ってください。';

export async function generateImaHimaPlan(params: {
  location: string;
  budget: string;
  currency: CurrencyCode;
  availableTime: ImaHimaTimeOption;
  mood: ImaHimaMoodOption;
  customPreferences?: import('@/types/plan-preferences').PlanCustomPreferences;
  abortSignal?: AbortSignal;
}): Promise<GeneratedPlan> {
  const moodPrefs = resolveMoodPreferences(params.mood);
  const spontaneous = buildSpontaneousContext(params.availableTime, params.mood);
  const tripDuration = getImaHimaTripDuration(params.availableTime);
  const people =
    moodPrefs.companion === 'カップル'
      ? '2'
      : moodPrefs.companion === '一人'
        ? '1'
        : '2';

  return generatePlanWithAi({
    location: params.location,
    budget: params.budget,
    currency: params.currency,
    people,
    companion: moodPrefs.companion,
    personality: moodPrefs.personality,
    tripDuration,
    tripDate: getTodayIsoDate(),
    mood: params.mood,
    customPreferences: params.customPreferences,
    spontaneous,
    abortSignal: params.abortSignal,
  });
}

export async function generateBestDayPlan(params: {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  availableTime: BestDayTimeOption;
  mood: BestDayMoodOption;
  customPreferences?: import('@/types/plan-preferences').PlanCustomPreferences;
}): Promise<GeneratedPlan> {
  const moodPrefs = resolveBestDayPreferences(params.mood, params.people);
  const bestDay = buildBestDayContext(
    params.mood,
    params.availableTime,
    moodPrefs.effectivePeople,
    moodPrefs.moodDescription,
  );
  const tripDuration = getBestDayTripDuration(params.availableTime);

  return generatePlanWithAi({
    location: params.location,
    budget: params.budget,
    currency: params.currency,
    people: moodPrefs.effectivePeople,
    companion: moodPrefs.companion,
    personality: moodPrefs.personality,
    tripDuration,
    tripDate: getTodayIsoDate(),
    mood: params.mood,
    customPreferences: params.customPreferences,
    bestDay,
  });
}

function parseAiResponse(
  raw: unknown,
  includeAiAdvice: boolean,
  tripDuration: TripDurationOption,
  tripDate: string,
  weather?: WeatherForecast,
  tripEndDate?: string,
  customDuration?: CustomTripDuration,
  travelTiming?: TravelTimingSettings,
): GeneratedPlan {
  if (__DEV__) {
    console.log('[AI] raw result type', typeof raw);
    console.log(
      '[AI] raw result preview',
      typeof raw === 'string' ? raw.slice(0, 600) : JSON.stringify(raw).slice(0, 600),
    );
  }

  const parsed = safeJsonParse<AiPlanResponse | null>(
    typeof raw === 'string' ? stripJsonCodeFence(raw) : raw,
    null,
  );

  if (!parsed?.days || parsed.days.length === 0) {
    throw new Error('プランの形式が正しくありません');
  }

  const days: ItineraryDay[] = parsed.days.map((day) => ({
    dayNumber: day.dayNumber,
    label: day.label,
    theme: day.theme,
    items: day.items.map((item) => ({
      time: item.time,
      activity: item.activity,
      activityCategory: item.activityCategory,
      placeCategory: item.placeCategory,
      reason: item.reason,
      estimatedCost: item.estimatedCost,
      transportation: item.transportation,
      reservationUrl: item.reservationUrl || undefined,
      websiteUrl: item.websiteUrl || undefined,
      travelTimeToNext: item.travelTimeToNext || undefined,
      weatherBackup: item.weatherBackup || undefined,
    })),
  }));

  return {
    days,
    items: flattenItineraryDays(days),
    details: {
      conciergeAnalysis: parsed.conciergeAnalysis,
      plannerMessage: parsed.plannerMessage,
      totalBudget:
        parsed.budgetBreakdown?.total ?? parsed.totalBudget ?? '予算目安を算出できませんでした',
      budgetBreakdown: parsed.budgetBreakdown,
      duration: parsed.duration ?? resolveDurationConfig(tripDuration, customDuration).label,
      tripDuration,
      tripDate,
      tripEndDate,
      customDuration,
      weather,
      highlights: parsed.highlights ?? [],
      rainyDayAlternatives: parsed.rainyDayAlternatives ?? [],
      weatherReplanChanges: parsed.weatherReplanChanges,
      aiAdvice: includeAiAdvice ? parsed.aiAdvice : undefined,
      tourSuggestions: parsed.tourSuggestions?.map((suggestion) => ({
        dayNumber: suggestion.dayNumber ?? undefined,
        title: suggestion.title,
        description: suggestion.description,
        needsBooking: suggestion.needsBooking,
      })),
      travelTiming,
    },
  };
}

function extractResponseText(data: unknown): string {
  const response = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string; parsed?: unknown }>;
    }>;
  };

  if (response.output_text?.trim()) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.parsed != null && typeof part.parsed === 'object') {
        if (__DEV__) {
          console.log('[AI] using pre-parsed structured output object');
        }
        return JSON.stringify(part.parsed);
      }
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text;
      }
    }
  }

  throw new Error('AIからの応答が空でした');
}

function extractAiPlanPayload(data: unknown): unknown {
  const response = data as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string; parsed?: unknown }>;
    }>;
  };

  for (const item of response.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.parsed != null && typeof part.parsed === 'object') {
        return part.parsed;
      }
    }
  }

  return extractResponseText(data);
}

function logFetchPlanFromAiRawError(error: unknown): void {
  const record =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  console.error('[fetchPlanFromAi] RAW ERROR', {
    name: error instanceof Error ? error.name : record.name,
    message: error instanceof Error ? error.message : String(error),
    status: record.status,
    code: record.code,
    type: record.type,
    stack: error instanceof Error ? error.stack : undefined,
    raw: error,
  });
}

function throwOpenAiHttpError(
  status: number,
  statusText: string,
  errorBody: string,
  requestUrl?: string,
): never {
  console.error('[fetchPlanFromAi] OpenAI response error', {
    status,
    statusText,
    body: errorBody,
    requestUrl,
  });
  throw new OpenAiRequestError(status, statusText, errorBody, requestUrl);
}

async function fetchPlanFromAi(params: {
  apiKey: string;
  systemPrompt: string;
  planInput: PlanInput;
  fallbackPlanInput?: PlanInput;
  tripDuration: TripDurationOption;
  includeAiAdvice: boolean;
  schemaOverrides?: { dayCount?: number; itemsMin?: number; itemsMax?: number };
  customDuration?: CustomTripDuration;
  tripDate: string;
  tripEndDate?: string;
  weather?: WeatherForecast;
}): Promise<GeneratedPlan> {
  const durationConfig = resolveDurationConfig(params.tripDuration, params.customDuration);
  const isTravelPlan =
    params.planInput.planCreationType === '旅行プラン' ||
    params.planInput.planCreationType === '週末プラン';
  const includeTourSuggestions =
    isTravelPlan && durationConfig.dayCount >= 3 && !params.planInput.spontaneous && !params.planInput.bestDay;

  const userPrompt = buildConciergePrompt(params.planInput);

  console.log('[AI] generation started', {
    destination: params.planInput.location,
    durationLabel:
      params.planInput.durationLabel ??
      resolveDurationConfig(params.tripDuration, params.customDuration).label,
    companion: params.planInput.companion,
    travelPurpose: params.planInput.travelPurpose ?? params.planInput.travelIntent,
    promptLength: userPrompt.length,
  });

  logPlanGenerationStep('openai_request', {
    systemPromptPreview: params.systemPrompt.slice(0, 600),
    promptPreview: userPrompt.slice(0, 1200),
    promptLength: userPrompt.length,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= OPENAI_MAX_GENERATION_ATTEMPTS; attempt++) {
    const { signal, cleanup, didTimeout } = createGenerationAbortSignal(params.planInput.abortSignal);

    try {
      const plan = await executePlanFromAiRequest({
        ...params,
        userPrompt,
        includeTourSuggestions,
        attemptSignal: signal,
        fallbackPlanInput: params.fallbackPlanInput ?? params.planInput,
      });
      cleanup();
      console.log('[AI] generation success');
      return plan;
    } catch (err) {
      cleanup();
      lastError = err;

      if (params.planInput.abortSignal?.aborted || (isAbortError(err) && !didTimeout())) {
        throw err;
      }

      if (didTimeout()) {
        lastError = new AiGenerationTimeoutError();
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new AiGenerationTimeoutError();
      }

      const status = lastError instanceof OpenAiRequestError ? lastError.status : undefined;
      const message = lastError instanceof Error ? lastError.message : String(lastError);
      console.error('[AI] generation failed', { status, message, attempt });

      if (attempt >= OPENAI_MAX_GENERATION_ATTEMPTS || !isRetryableOpenAiError(lastError)) {
        if (didTimeout() || lastError instanceof AiGenerationTimeoutError) {
          throw new AiGenerationTimeoutError();
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }

      console.warn('[AI] retrying generation', { attempt, errorMessage: message });
      await sleep(getOpenAiRetryDelayMs(attempt));
    }
  }

  if (lastError instanceof AiGenerationTimeoutError) {
    throw lastError;
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function executePlanFromAiRequest(params: {
  apiKey: string;
  systemPrompt: string;
  planInput: PlanInput;
  fallbackPlanInput: PlanInput;
  tripDuration: TripDurationOption;
  includeAiAdvice: boolean;
  schemaOverrides?: { dayCount?: number; itemsMin?: number; itemsMax?: number };
  customDuration?: CustomTripDuration;
  tripDate: string;
  tripEndDate?: string;
  weather?: WeatherForecast;
  userPrompt: string;
  includeTourSuggestions: boolean;
  attemptSignal: AbortSignal;
}): Promise<GeneratedPlan> {
  const model = 'gpt-4o-mini';
  const schemaName = params.includeAiAdvice ? 'nanisuru_trip_plan_with_advice' : 'nanisuru_trip_plan';
  const requestPayload = {
    model,
    input: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: schemaName,
        strict: true,
        schema: buildPlanJsonSchema(
          params.tripDuration,
          params.includeAiAdvice,
          params.schemaOverrides,
          params.customDuration,
          params.planInput.budgetScope,
          {
            includeTourSuggestions: params.includeTourSuggestions,
            includeWeatherReplanChanges: Boolean(params.planInput.weatherReplan),
          },
        ),
      },
    },
  };

  if (__DEV__) {
    const useProxy = shouldUsePlanGenerationApiProxy();
    console.log('[fetchPlanFromAi] start');
    console.log('[fetchPlanFromAi] useProxy', useProxy);
    console.log('[fetchPlanFromAi] hasOpenAIKey', useProxy || Boolean(params.apiKey));
    console.log('[fetchPlanFromAi] model', model);
    console.log('[fetchPlanFromAi] request payload', {
      model: requestPayload.model,
      schemaName,
      systemPromptLength: params.systemPrompt.length,
      userPromptLength: params.userPrompt.length,
      inputMessageCount: requestPayload.input.length,
    });
    if (useProxy) {
      console.log('[TravelPlanSubmit] request URL', getGeneratePlanApiUrlForLog());
      console.log('[TravelPlanSubmit] request payload', {
        model: requestPayload.model,
        schemaName,
        systemPromptLength: params.systemPrompt.length,
        userPromptLength: params.userPrompt.length,
      });
    }
  }

  const useProxy = shouldUsePlanGenerationApiProxy();
  const apiValidation = useProxy ? validatePlanApiRequestConfig() : null;
  const requestUrl = useProxy ? apiValidation!.fetchUrl : 'https://api.openai.com/v1/responses';
  const requestUrlForLog = useProxy ? apiValidation!.logUrl : requestUrl;

  console.log('[TravelPlanSubmit] request URL', requestUrlForLog);
  console.log(
    '[TravelPlanSubmit] window origin',
    typeof window !== 'undefined' ? window.location.origin : 'no-window',
  );

  if (useProxy && apiValidation && !apiValidation.ok) {
    console.error('[TravelPlanSubmit] invalid API request config', apiValidation);
    throw new PlanGenerationRequestError(
      apiValidation.userMessage ?? APP_MESSAGES.planApiBadOrigin,
      'NETWORK_ERROR',
      requestUrlForLog,
    );
  }

  let response: Response;
  try {
    if (useProxy) {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: params.attemptSignal,
        body: JSON.stringify({
          requestPayload,
          ...(__DEV__ ? { devMeta: extractPlanGenerationDevMeta(params.fallbackPlanInput) } : {}),
        }),
      });
    } else {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.apiKey}`,
        },
        signal: params.attemptSignal,
        body: JSON.stringify(requestPayload),
      });
    }
  } catch (err) {
    console.error('[TravelPlanSubmit] fetch failed raw', err);
    console.error('[TravelPlanSubmit] fetch failed details', {
      name: err instanceof Error ? err.name : undefined,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      requestUrl: requestUrlForLog,
      origin: getWindowOriginForLog(),
    });
    logFetchPlanFromAiRawError(err);
    logPlanGenerationError('openai_fetch', err, { requestUrl: requestUrlForLog });
    if (params.planInput.abortSignal?.aborted || (isAbortError(err) && !params.attemptSignal.aborted)) {
      throw err;
    }
    if (params.attemptSignal.aborted) {
      throw new PlanGenerationRequestError(
        APP_MESSAGES.aiGenerationTimeout,
        'OPENAI_FAILED',
        requestUrlForLog,
        err,
      );
    }
    throw resolvePlanGenerationFetchFailure(err, requestUrlForLog, useProxy);
  }

  console.log('[TravelPlanSubmit] response status', response.status);

  if (!response.ok) {
    const text = await response.text();
    console.error('[TravelPlanSubmit] response not ok', {
      status: response.status,
      statusText: response.statusText,
      text,
      requestUrl: requestUrlForLog,
    });
    throwOpenAiHttpError(response.status, response.statusText, text, requestUrlForLog);
  }

  const data = await response.json();
  const devFallbackPlan = parseDevFallbackTravelPlanFromApiResponse(data, params.fallbackPlanInput);
  if (devFallbackPlan) {
    console.warn('[AI] using dev fallback plan from API response');
    return devFallbackPlan;
  }

  try {
    const aiPayload = extractAiPlanPayload(data);
    return parseAiResponse(
      aiPayload,
      params.includeAiAdvice,
      params.tripDuration,
      params.tripDate,
      params.weather,
      params.tripEndDate,
      params.customDuration,
      params.planInput.travelTiming,
    );
  } catch (err) {
    logFetchPlanFromAiRawError(err);
    logPlanGenerationError('openai_parse', err, { responsePreview: JSON.stringify(data).slice(0, 800) });
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function attachRealPlaces(plan: GeneratedPlan, realPlaces: NonNullable<PlanInput['realPlaces']>): GeneratedPlan {
  const days =
    realPlaces.places.length > 0
      ? enrichPlanWithRealPlaceLinks(plan.days, realPlaces.places)
      : plan.days;

  return {
    ...plan,
    days,
    items: flattenItineraryDays(days),
    details: {
      ...plan.details,
      placesNotice: realPlaces.notice ?? plan.details.placesNotice,
      placesSource: realPlaces.source ?? plan.details.placesSource,
    },
  };
}

function applyDuplicateDedupAndEnrich(
  plan: GeneratedPlan,
  realPlaces?: import('@/types/nearby-places').NearbyPlacesContext,
): GeneratedPlan {
  const deduped = dedupeItineraryPlaces(plan.days, realPlaces?.places ?? []);
  let days = deduped.days;
  if (realPlaces && realPlaces.places.length > 0) {
    days = enrichPlanWithRealPlaceLinks(days, realPlaces.places);
  }
  if (deduped.replacedCount > 0) {
    logPlanGenerationStep('duplicate_replacement', {
      replacedCount: deduped.replacedCount,
    });
  }
  return {
    ...plan,
    days,
    items: flattenItineraryDays(days),
  };
}

function mergeRegeneratedDays(
  basePlan: GeneratedPlan,
  regenerated: GeneratedPlan,
  targetDayNumbers: number[],
): GeneratedPlan {
  const targetSet = new Set(targetDayNumbers);
  const regenByDay = new Map(regenerated.days.map((day) => [day.dayNumber, day]));

  const days = basePlan.days.map((day) => {
    if (!targetSet.has(day.dayNumber)) return day;
    return regenByDay.get(day.dayNumber) ?? day;
  });

  return {
    ...basePlan,
    days,
    items: flattenItineraryDays(days),
    details: {
      ...basePlan.details,
      ...regenerated.details,
      outfitAdvice: basePlan.details.outfitAdvice ?? regenerated.details.outfitAdvice,
      weather: basePlan.details.weather ?? regenerated.details.weather,
      budgetBreakdown: regenerated.details.budgetBreakdown ?? basePlan.details.budgetBreakdown,
    },
  };
}

async function runQualityPartialRegeneration(params: {
  instruction: string;
  basePlan: { days: ItineraryDay[]; details: PlanDetails };
  enrichedInput: PlanInput;
  apiKey: string;
  systemPrompt: string;
  tripDuration: TripDurationOption;
  includeAiAdvice: boolean;
  schemaOverrides?: Parameters<typeof fetchPlanFromAi>[0]['schemaOverrides'];
  customDuration?: CustomTripDuration;
  tripDate: string;
  tripEndDate?: string;
  weather?: WeatherForecast;
  realPlaces?: import('@/types/nearby-places').NearbyPlacesContext;
  targetDayNumbers?: number[];
  abortSignal?: AbortSignal;
}): Promise<{ days: ItineraryDay[]; details: PlanDetails }> {
  if (params.abortSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const partialInput: PlanInput = {
    ...params.enrichedInput,
    itineraryQualityFix: {
      baseDays: params.basePlan.days,
      baseDetails: params.basePlan.details,
      issues: [params.instruction],
      targetDayNumbers: params.targetDayNumbers,
    },
  };

  let regen = await fetchPlanFromAi({
    apiKey: params.apiKey,
    systemPrompt: `${params.systemPrompt}\n${params.instruction}`,
    planInput: partialInput,
    tripDuration: params.tripDuration,
    includeAiAdvice: params.includeAiAdvice,
    schemaOverrides: params.schemaOverrides,
    customDuration: params.customDuration,
    tripDate: params.tripDate,
    tripEndDate: params.tripEndDate,
    weather: params.weather,
  });

  if (params.realPlaces) {
    regen = attachRealPlaces(regen, params.realPlaces);
    regen = applyDuplicateDedupAndEnrich(regen, params.realPlaces);
  }

  if (params.targetDayNumbers?.length) {
    regen = mergeRegeneratedDays(
      { ...params.basePlan, items: flattenItineraryDays(params.basePlan.days) },
      regen,
      params.targetDayNumbers,
    );
    if (params.realPlaces) {
      regen = applyDuplicateDedupAndEnrich(regen, params.realPlaces);
    }
  }

  return { days: regen.days, details: regen.details };
}

export async function generatePlanWithAi(input: PlanInput): Promise<GeneratedPlan> {
  const normalized = normalizePlanGenerationInput(input);
  validatePlanGenerationInput(normalized);

  logPlanGenerationStep('input', buildPlanGenerationLogPayload(normalized));

  const useProxy = shouldUsePlanGenerationApiProxy();
  if (!useProxy && !getOpenAiApiKey()) {
    console.error('[fetchPlanFromAi] missing API key', {
      hasEnvVar: Boolean(process.env.EXPO_PUBLIC_OPENAI_API_KEY),
    });
    throw new AppError(APP_MESSAGES.openAiNotConfigured, 'OPENAI_FAILED');
  }
  const apiKey: string = useProxy ? 'proxy' : getOpenAiApiKey()!;

  if (__DEV__) {
    console.log('[AI] hasOpenAIKey', useProxy || Boolean(getOpenAiApiKey()));
    console.log('[AI] model', 'gpt-4o-mini');
    console.log('[AI] usePlanApiProxy', useProxy);
    if (useProxy) {
      console.log('[AI] planApiUrl', getGeneratePlanApiUrlForLog());
    }
  }

  let weather: WeatherForecast;
  const locationTrimmed = normalized.location;
  if (!locationTrimmed) {
    throw new AppError(APP_MESSAGES.locationRequired, 'NO_PLACES_FOUND');
  }

  try {
    const weatherLocation = resolveWeatherLocation(locationTrimmed);
    weather = await resolveWeatherForTrip({
      location: locationTrimmed,
      startDate: input.tripDate,
      tripDuration: input.tripDuration,
      endDate: input.tripEndDate,
      customDuration: input.customDuration,
    });

    if (!weather.available && weather.planningMode !== 'seasonal') {
      console.warn('[Weather] using fallback weather context', {
        destination: locationTrimmed,
        weatherLocation,
        location: weather.location,
        planningMode: weather.planningMode,
      });
    } else if (weather.planningMode === 'seasonal') {
      if (__DEV__) {
        console.log('[Weather] using seasonal weather context', {
          destination: locationTrimmed,
          planningMode: weather.planningMode,
        });
      }
    }
  } catch (error) {
    console.warn('[Weather] fetch failed, continuing without weather', error);
    const weatherLocation = resolveWeatherLocation(locationTrimmed);
    weather = createUnavailableWeatherForecast(locationTrimmed, weatherLocation);
  }

  let realPlaces;
  try {
    realPlaces = await fetchRealPlacesForLocation(locationTrimmed);
    logPlanGenerationStep('places', {
      count: realPlaces.places.length,
      source: realPlaces.source,
      notice: realPlaces.notice,
      sample: realPlaces.places.slice(0, 3).map((place) => place.name),
    });
  } catch (err) {
    console.warn('[Places] fetch failed, continuing with fallback places context', err);
    if (err instanceof AppError && err.code === 'NO_PLACES_FOUND') {
      throw err;
    }
    realPlaces = buildEmptyPlacesContext(locationTrimmed, APP_MESSAGES.placesFetchWarning);
  }

  const [userPreferences, travelMemories, travelUserPreferences] = await Promise.all([
    getUserPreferences(),
    getTravelMemories(),
    getTravelUserPreferences(),
  ]);

  if (hasTravelUserPreferences(travelUserPreferences)) {
    if (__DEV__ && travelUserPreferences) {
      console.log('[PlanGeneration] preferences used');
    }
  }

  const customText = [
    input.customPreferences?.desiredPlaces,
    input.customPreferences?.customTravelIntent,
    input.customPreferences?.customMood,
    input.mustVisitPlaces,
  ]
    .filter(Boolean)
    .join(' ');

  const prioritizeLocalSpots =
    shouldPrioritizeLocalHiddenSpots({
      personality: input.personality,
      mood: input.mood,
      travelIntent: input.travelIntent,
      customText,
    }) ||
    (hasTravelUserPreferences(travelUserPreferences) &&
      travelUserPreferences.favoriteCategories.includes('ローカル穴場'));

  let localHiddenSpots: Awaited<ReturnType<typeof loadRelevantLocalGemsForPlan>> = [];
  if (prioritizeLocalSpots) {
    try {
      localHiddenSpots = await loadRelevantLocalGemsForPlan({
        location: locationTrimmed,
        limit: 3,
      });
    } catch (error) {
      console.warn('[LocalGems] optional local gems unavailable, continuing', error);
      console.log('[TravelPlanSubmit] local gems count', 0);
      localHiddenSpots = [];
    }
  }

  if (__DEV__) {
    console.log('[TravelPlanSubmit] continuing generation');
  }

  const resolvedCurrency =
    realPlaces?.inferredCurrency ??
    inferCurrencyFromLocation(locationTrimmed) ??
    input.currency;

  const includeAiAdvice = isDateRelatedCompanion(input.companion);
  const isRegenerate = Boolean(input.avoidActivities && input.avoidActivities.length > 0);
  const isAdjustment = Boolean(input.planAdjustment);
  const useCompactPrompt =
    !input.planAdjustment &&
    !input.weatherReplan &&
    !input.itineraryBalanceFix &&
    !input.itineraryQualityFix &&
    !input.spontaneous &&
    !input.bestDay &&
    !isRegenerate;

  const compactLocalGems = localHiddenSpots.slice(0, 3);
  const promptPlanInput = useCompactPrompt
    ? buildCompactPromptPlanInput({
        ...input,
        currency: resolvedCurrency,
        weather,
        userPreferences: userPreferences.hasData ? userPreferences : undefined,
        localHiddenSpots: compactLocalGems.length > 0 ? compactLocalGems : undefined,
        prioritizeLocalGems: prioritizeLocalSpots && localHiddenSpots.length === 0,
        planType: normalized.planType,
        travelPurpose: normalized.travelPurpose,
        departureDate: normalized.departureDate,
        returnDate: normalized.returnDate,
        durationLabel: normalized.durationLabel,
        mustVisitPlaces: normalized.mustVisitPlaces,
        avoidPreferences: normalized.avoidPreferences,
        budgetScope: input.budgetScope,
      })
    : null;

  const enrichedInput: PlanInput = {
    ...input,
    currency: resolvedCurrency,
    weather,
    realPlaces,
    userPreferences: userPreferences.hasData ? userPreferences : undefined,
    travelUserPreferences: hasTravelUserPreferences(travelUserPreferences)
      ? travelUserPreferences
      : undefined,
    travelMemories: useCompactPrompt ? undefined : travelMemories.length > 0 ? travelMemories : undefined,
    localHiddenSpots: compactLocalGems.length > 0 ? compactLocalGems : undefined,
    prioritizeLocalGems: prioritizeLocalSpots && localHiddenSpots.length === 0,
    compactPrompt: useCompactPrompt,
    planType: normalized.planType,
    travelPurpose: normalized.travelPurpose,
    departureDate: normalized.departureDate,
    returnDate: normalized.returnDate,
    durationLabel: normalized.durationLabel,
    mustVisitPlaces: normalized.mustVisitPlaces,
    avoidPreferences: normalized.avoidPreferences,
    budgetScope: input.budgetScope,
  };
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const isMultiDay = durationConfig.dayCount > 1 && !input.spontaneous && !input.bestDay;
  const isImaHima = Boolean(input.spontaneous);
  const isBestDay = Boolean(input.bestDay);

  const schemaOverrides = input.bestDay
    ? {
        dayCount: 1,
        itemsMin: input.bestDay.itemsMin,
        itemsMax: input.bestDay.itemsMax,
      }
    : input.spontaneous
      ? {
          dayCount: 1,
          itemsMin: input.spontaneous.itemsMin,
          itemsMax: input.spontaneous.itemsMax,
        }
      : undefined;

  let systemPrompt = useCompactPrompt
    ? buildCompactSystemPrompt(input.tripDuration, durationConfig.dayCount)
    : SYSTEM_PROMPT;
  if (!useCompactPrompt) {
    if (isAdjustment) {
      systemPrompt = ADJUST_SYSTEM_PROMPT;
    } else if (isBestDay) {
      systemPrompt = BEST_DAY_SYSTEM_PROMPT;
    } else if (isImaHima) {
      systemPrompt = IMA_HIMA_SYSTEM_PROMPT;
    } else if (userPreferences.hasData && weather) {
      systemPrompt = `${MEMORY_SYSTEM_PROMPT} 天気予報にも合わせて屋内・屋外を調整してください。`;
    } else if (userPreferences.hasData) {
      systemPrompt = MEMORY_SYSTEM_PROMPT;
    } else if (travelMemories.length > 0 && weather) {
      systemPrompt = `${MEMORY_SYSTEM_PROMPT} ユーザーの旅行メモリーを最優先で反映し、天気予報にも合わせて調整してください。`;
    } else if (travelMemories.length > 0) {
      systemPrompt = `${MEMORY_SYSTEM_PROMPT} ユーザーの旅行メモリーを最優先で反映してください。`;
    } else if (weather) {
      systemPrompt = WEATHER_SYSTEM_PROMPT;
    }
    if (isRegenerate) {
      systemPrompt = includeAiAdvice
        ? `${REGENERATE_SYSTEM_PROMPT} カップル・初デート向けは aiAdvice も作成。天気予報がある場合は天候に合わせたスポット選定を維持。`
        : `${REGENERATE_SYSTEM_PROMPT}${weather ? ' 天気予報がある場合は天候に合わせたスポット選定を維持。' : ''}`;
    } else if (!isAdjustment && !isImaHima && !isBestDay && includeAiAdvice) {
      systemPrompt = weather
        ? `${DATE_SYSTEM_PROMPT} 天気予報に合わせて屋内・屋外スポットを調整してください。`
        : DATE_SYSTEM_PROMPT;
    } else if (!isAdjustment && !isImaHima && !isBestDay && isMultiDay) {
      systemPrompt = weather
        ? `${MULTI_DAY_SYSTEM_PROMPT} 日ごとの天気予報に合わせてスポットを調整してください。`
        : MULTI_DAY_SYSTEM_PROMPT;
    }

    if (isAdjustment && weather) {
      systemPrompt = `${systemPrompt} 天気予報に合わせて屋内・屋外スポットを調整してください。`;
    }
    if (isAdjustment && travelMemories.length > 0) {
      systemPrompt = `${systemPrompt} ユーザーの旅行メモリーを反映してください。`;
    }

    if ((isImaHima || isBestDay) && weather) {
      systemPrompt = `${systemPrompt} 天気予報に合わせて屋内・屋外スポットを調整してください。`;
    }

    systemPrompt = `${systemPrompt} コンシェルジュモード: conciergeAnalysis を完成させてから days を設計。全 item に reservationUrl, websiteUrl, travelTimeToNext, weatherBackup を設定してください。`;

    if (realPlaces && realPlaces.places.length > 0) {
      systemPrompt = `${systemPrompt} 実在スポットリストが提供されています。リスト以外の店名・施設名を一切使用しないこと。activity にはリストの名称をそのまま使用し、架空のスポットは禁止。飲食店だけに偏らず、リスト内の公園・文化・観光スポットも積極的に使うこと。同じスポットを旅全体で2回以上使わないこと。`;
    }
  }

  logPlanGenerationStep('prepared', buildPlanGenerationLogPayload(normalized, {
    realPlaces,
    systemPrompt,
  }));

  let plan: GeneratedPlan;
  const aiPlanInput = promptPlanInput ?? enrichedInput;
  try {
    plan = await fetchPlanFromAi({
      apiKey,
      systemPrompt,
      planInput: aiPlanInput,
      fallbackPlanInput: enrichedInput,
      tripDuration: input.tripDuration,
      includeAiAdvice,
      schemaOverrides,
      customDuration: input.customDuration,
      tripDate: input.tripDate,
      tripEndDate: input.tripEndDate,
      weather,
    });
  } catch (err) {
    if (__DEV__ && isDevFallbackEligibleError(err)) {
      console.warn('[AI] using dev fallback plan after retries exhausted', err);
      plan = buildDevFallbackTravelPlan(enrichedInput);
    } else {
      throw err;
    }
  }

  if (realPlaces) {
    plan = attachRealPlaces(plan, realPlaces);
    plan = applyDuplicateDedupAndEnrich(plan, realPlaces);
  }

  const gourmetTour = isGourmetTourIntent({
    personality: input.personality,
    mood: input.mood,
    travelIntent: normalized.travelPurpose,
    customPreferences: input.customPreferences,
  });

  const shouldBalanceCheck =
    !input.planAdjustment &&
    !input.weatherReplan &&
    !input.itineraryBalanceFix &&
    !input.itineraryQualityFix &&
    !gourmetTour &&
    !input.spontaneous &&
    !input.bestDay;

  if (!plan.devFallbackNotice && shouldBalanceCheck && analyzeItineraryBalance(plan.days).isTooFoodHeavy) {
    if (input.abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const rebalanceInput: PlanInput = {
      ...enrichedInput,
      itineraryBalanceFix: {
        baseDays: plan.days,
        baseDetails: plan.details,
      },
    };

    plan = await fetchPlanFromAi({
      apiKey,
      systemPrompt: `${systemPrompt} 前回のプランは食事偏重だったため、散歩・体験・文化・景色・休憩を増やした人間らしいプランに作り直すこと。`,
      planInput: rebalanceInput,
      tripDuration: input.tripDuration,
      includeAiAdvice,
      schemaOverrides,
      customDuration: input.customDuration,
      tripDate: input.tripDate,
      tripEndDate: input.tripEndDate,
      weather,
    });

    if (realPlaces) {
      plan = attachRealPlaces(plan, realPlaces);
      plan = applyDuplicateDedupAndEnrich(plan, realPlaces);
    }
  }

  if (!input.spontaneous && !input.bestDay) {
    plan = applyDuplicateDedupAndEnrich(plan, realPlaces);

    let qualityReport = validateItineraryQuality(plan.days, {
      travelTiming: input.travelTiming,
      dayCount: durationConfig.dayCount,
      gourmetTour,
    });
    logItineraryQualityReport(qualityReport);

    const canQualityFix =
      !plan.devFallbackNotice &&
      !input.planAdjustment &&
      !input.weatherReplan &&
      !input.itineraryQualityFix &&
      !input.itineraryBalanceFix &&
      shouldAttemptQualityFix(qualityReport, { gourmetTour });

    if (canQualityFix) {
      if (input.abortSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const qualityFixInput: PlanInput = {
        ...enrichedInput,
        itineraryQualityFix: {
          baseDays: plan.days,
          baseDetails: plan.details,
          issues: qualityReport.issues,
        },
      };

      plan = await fetchPlanFromAi({
        apiKey,
        systemPrompt: `${systemPrompt} 前回のプラン品質に問題があったため、重複排除・エリア多様性・到着出発時間・体験バランスを改善したプランに作り直すこと。`,
        planInput: qualityFixInput,
        tripDuration: input.tripDuration,
        includeAiAdvice,
        schemaOverrides,
        customDuration: input.customDuration,
        tripDate: input.tripDate,
        tripEndDate: input.tripEndDate,
        weather,
      });

      if (realPlaces) {
        plan = attachRealPlaces(plan, realPlaces);
        plan = applyDuplicateDedupAndEnrich(plan, realPlaces);
      }

      qualityReport = validateItineraryQuality(plan.days, {
        travelTiming: input.travelTiming,
        dayCount: durationConfig.dayCount,
        gourmetTour,
      });
      logItineraryQualityReport(qualityReport);
    }
  }

  void learnFromCustomPreferences(input.customPreferences);

  const isTravelPlan =
    input.planCreationType === '旅行プラン' || input.planCreationType === '週末プラン';

  const outfitAdvice = generateOutfitPackingAdvice({
    days: plan.days,
    weather: plan.details.weather ?? weather,
    location: locationTrimmed,
    planType: input.planCreationType,
    companion: input.companion,
    outfitStyleMode: input.outfitStyleMode,
    dayCount: durationConfig.dayCount,
    tripDate: input.tripDate,
  });
  logOutfitAdviceGenerated(outfitAdvice);

  plan = {
    ...plan,
    details: {
      ...plan.details,
      budgetScope: input.budgetScope,
      preTripPlanning: isTravelPlan
        ? {
            ...plan.details.preTripPlanning,
            bookingLinks: buildDefaultPreTripBookingLinks({
              destination: locationTrimmed,
              departureDate: input.tripDate,
              returnDate: input.tripEndDate,
            }),
          }
        : plan.details.preTripPlanning,
      travelTiming: input.travelTiming,
      outfitAdvice,
    },
  };

  const transportContext = {
    location: locationTrimmed,
    weather: plan.details.weather ?? weather,
    travelTiming: input.travelTiming,
    companion: input.companion,
    budget: input.budget,
  };

  const canRunFinalValidation = !input.spontaneous && !input.bestDay;
  const { plan: finalizedPlan } = await finalizeItineraryBeforeDisplay({
    plan,
    realPlaces,
    travelTiming: input.travelTiming,
    dayCount: durationConfig.dayCount,
    gourmetTour,
    budgetScope: input.budgetScope,
    location: locationTrimmed,
    companion: input.companion,
    outfitStyleMode: input.outfitStyleMode,
    planCreationType: input.planCreationType,
    tripDate: input.tripDate,
    weather: plan.details.weather ?? weather,
    transportContext,
    allowAiPartialFix:
      canRunFinalValidation &&
      !input.itineraryQualityFix &&
      !input.itineraryBalanceFix,
    onPartialRegenerate: canRunFinalValidation
      ? async (instruction, basePlan) =>
          runQualityPartialRegeneration({
            instruction,
            basePlan,
            enrichedInput,
            apiKey,
            systemPrompt,
            tripDuration: input.tripDuration,
            includeAiAdvice,
            schemaOverrides,
            customDuration: input.customDuration,
            tripDate: input.tripDate,
            tripEndDate: input.tripEndDate,
            weather,
            realPlaces,
            abortSignal: input.abortSignal,
          })
      : undefined,
    onRegenerateDays: canRunFinalValidation
      ? async (dayNumbers, instruction, basePlan) =>
          runQualityPartialRegeneration({
            instruction,
            basePlan,
            enrichedInput,
            apiKey,
            systemPrompt,
            tripDuration: input.tripDuration,
            includeAiAdvice,
            schemaOverrides,
            customDuration: input.customDuration,
            tripDate: input.tripDate,
            tripEndDate: input.tripEndDate,
            weather,
            realPlaces,
            targetDayNumbers: dayNumbers,
            abortSignal: input.abortSignal,
          })
      : undefined,
  });

  return {
    ...finalizedPlan,
    items: flattenItineraryDays(finalizedPlan.days),
  };
}

/** Alias for generatePlanWithAi — accepts normalized plan creation fields. */
export const generatePlan = generatePlanWithAi;
