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
import { flattenItineraryDays, TRIP_DURATION_CONFIG } from './trip-duration';
import { fetchWeatherForecast, getTodayIsoDate, type WeatherForecast } from './weather';
import { getUserPreferences } from './user-memory';
import { getTravelMemories } from './travel-memory';
import {
  enrichPlanWithRealPlaceLinks,
  fetchRealPlacesForLocation,
} from './location-places';
import { inferCurrencyFromLocation } from './location-currency';
import { APP_MESSAGES, AppError, classifyError, isNetworkError } from './app-errors';
import { learnFromCustomPreferences } from './custom-preferences';
import type { CurrencyCode } from '@/constants/currency';

export type GeneratedPlan = {
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
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
  aiAdvice?: AiAdvice;
};

const ITINERARY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    time: { type: 'string', description: 'Start time HH:MM' },
    activity: { type: 'string', description: 'Real place name in Japanese — must match provided real places list when available' },
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
      description: 'Weather analysis and contingency strategy in Japanese 2-3 sentences',
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

function buildPlanJsonSchema(
  tripDuration: TripDurationOption,
  includeAiAdvice: boolean,
  overrides?: { dayCount?: number; itemsMin?: number; itemsMax?: number },
) {
  const config = TRIP_DURATION_CONFIG[tripDuration];
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
      ...BUDGET_BREAKDOWN_SCHEMA,
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
  content: string,
  includeAiAdvice: boolean,
  tripDuration: TripDurationOption,
  tripDate: string,
  weather?: WeatherForecast,
): GeneratedPlan {
  const parsed = JSON.parse(content) as AiPlanResponse;

  if (!parsed.days || parsed.days.length === 0) {
    throw new Error('プランの形式が正しくありません');
  }

  const days: ItineraryDay[] = parsed.days.map((day) => ({
    dayNumber: day.dayNumber,
    label: day.label,
    theme: day.theme,
    items: day.items.map((item) => ({
      time: item.time,
      activity: item.activity,
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
      duration: parsed.duration ?? tripDuration,
      tripDuration,
      tripDate,
      weather,
      highlights: parsed.highlights ?? [],
      rainyDayAlternatives: parsed.rainyDayAlternatives ?? [],
      aiAdvice: includeAiAdvice ? parsed.aiAdvice : undefined,
    },
  };
}

function extractResponseText(data: unknown): string {
  const response = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (response.output_text?.trim()) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text;
      }
    }
  }

  throw new Error('AIからの応答が空でした');
}

function parseApiError(status: number, body: string): never {
  if (status === 0 || status >= 500) {
    throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
  }

  try {
    const error = JSON.parse(body) as { error?: { message?: string } };
    const message = error.error?.message;
    if (message && /rate limit|timeout|overloaded|server/i.test(message)) {
      throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
    }
  } catch (parseErr) {
    if (parseErr instanceof AppError) throw parseErr;
  }

  throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
}

export async function generatePlanWithAi(input: PlanInput): Promise<GeneratedPlan> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new AppError(APP_MESSAGES.openAiNotConfigured, 'OPENAI_FAILED');
  }

  let weather: WeatherForecast | undefined;
  const locationTrimmed = input.location.trim();
  if (!locationTrimmed) {
    throw new AppError(APP_MESSAGES.locationRequired, 'NO_PLACES_FOUND');
  }

  let realPlaces;
  try {
    [weather, realPlaces] = await Promise.all([
      fetchWeatherForecast({
        location: locationTrimmed,
        startDate: input.tripDate,
        tripDuration: input.tripDuration,
      }).catch(() => undefined),
      fetchRealPlacesForLocation(locationTrimmed),
    ]);
  } catch (err) {
    if (isNetworkError(err)) {
      throw new AppError(APP_MESSAGES.networkError, 'NETWORK_ERROR');
    }
    throw classifyError(err);
  }

  const [userPreferences, travelMemories] = await Promise.all([
    getUserPreferences(),
    getTravelMemories(),
  ]);

  const resolvedCurrency =
    realPlaces?.inferredCurrency ??
    inferCurrencyFromLocation(locationTrimmed) ??
    input.currency;

  const enrichedInput: PlanInput = {
    ...input,
    currency: resolvedCurrency,
    weather,
    realPlaces,
    userPreferences: userPreferences.hasData ? userPreferences : undefined,
    travelMemories: travelMemories.length > 0 ? travelMemories : undefined,
  };

  const includeAiAdvice = isDateRelatedCompanion(input.companion);
  const isRegenerate = Boolean(input.avoidActivities && input.avoidActivities.length > 0);
  const isAdjustment = Boolean(input.planAdjustment);
  const isMultiDay = TRIP_DURATION_CONFIG[input.tripDuration].dayCount > 1 && !input.spontaneous && !input.bestDay;
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

  let systemPrompt = SYSTEM_PROMPT;
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

  if (realPlaces) {
    systemPrompt = `${systemPrompt} 実在スポットリストが提供されています。リスト以外の店名・施設名を一切使用しないこと。activity にはリストの名称をそのまま使用し、架空のスポットは禁止。`;
  }

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildConciergePrompt(enrichedInput) },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: includeAiAdvice ? 'nanisuru_trip_plan_with_advice' : 'nanisuru_trip_plan',
            strict: true,
            schema: buildPlanJsonSchema(input.tripDuration, includeAiAdvice, schemaOverrides),
          },
        },
      }),
    });
  } catch (err) {
    if (isNetworkError(err)) {
      throw new AppError(APP_MESSAGES.networkError, 'NETWORK_ERROR');
    }
    throw classifyError(err);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    parseApiError(response.status, errorBody);
  }

  const data = await response.json();
  const plan = parseAiResponse(
    extractResponseText(data),
    includeAiAdvice,
    input.tripDuration,
    input.tripDate,
    weather,
  );

  if (realPlaces) {
    plan.days = enrichPlanWithRealPlaceLinks(plan.days, realPlaces.places);
    plan.items = flattenItineraryDays(plan.days);
    if (realPlaces.notice || realPlaces.source) {
      plan.details = {
        ...plan.details,
        placesNotice: realPlaces.notice,
        placesSource: realPlaces.source,
      };
    }
  }

  void learnFromCustomPreferences(input.customPreferences);

  return plan;
}
