import type { AiAdvice, BudgetBreakdown, ItineraryDay, ItineraryItem, PlanDetails, TripDurationOption } from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';
import type { ImaHimaMoodOption, ImaHimaTimeOption } from '@/types/imafima';

import { getOpenAiApiKey, isOpenAiConfigured } from './env';
import {
  buildSpontaneousContext,
  getImaHimaTripDuration,
  resolveMoodPreferences,
} from './imafima';
import { buildConciergePrompt, type PlanInput } from './prompts';
import { flattenItineraryDays, TRIP_DURATION_CONFIG } from './trip-duration';
import { fetchWeatherForecast, getTodayIsoDate, type WeatherForecast } from './weather';
import { getUserPreferences } from './user-memory';
import type { CurrencyCode } from '@/constants/currency';

export type GeneratedPlan = {
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
};

export { isOpenAiConfigured };

type AiPlanResponse = {
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
    activity: { type: 'string', description: 'Real place or venue name in Japanese' },
    reason: { type: 'string', description: 'Why this place was chosen, in Japanese' },
    estimatedCost: { type: 'string', description: 'Estimated cost with currency symbol' },
    transportation: {
      type: 'string',
      description: 'Transport to next stop; use — for last item of each day',
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
      minItems: 2,
      maxItems: 4,
    },
  };

  const required = [
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
  'あなたはプロの旅行プランナーです。' +
  'お客様の旅行タイプ（冒険家・グルメ・のんびり・映え重視・穴場好き）を最優先で反映し、' +
  '実在のスポット名、具体的な移動手段、丁寧な日本語で、指定JSONスキーマに厳密に従って回答してください。' +
  '架空の店名は避け、わからない場合はそのエリアの代表的な実在スポットを選んでください。';

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

export async function generateImaHimaPlan(params: {
  location: string;
  budget: string;
  currency: CurrencyCode;
  availableTime: ImaHimaTimeOption;
  mood: ImaHimaMoodOption;
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
    spontaneous,
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
    })),
  }));

  return {
    days,
    items: flattenItineraryDays(days),
    details: {
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

function parseApiError(status: number, body: string): string {
  try {
    const error = JSON.parse(body) as { error?: { message?: string } };
    const message = error.error?.message;
    if (message) return `OpenAI APIエラー: ${message}`;
  } catch {
    // fall through
  }
  return `OpenAI APIエラー (${status})`;
}

export async function generatePlanWithAi(input: PlanInput): Promise<GeneratedPlan> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      'OpenAI APIキーが設定されていません。\nnanisuru/.env に EXPO_PUBLIC_OPENAI_API_KEY を追加して Expo を再起動してください。',
    );
  }

  let weather: WeatherForecast | undefined;
  if (input.location.trim()) {
    try {
      weather = await fetchWeatherForecast({
        location: input.location,
        startDate: input.tripDate,
        tripDuration: input.tripDuration,
      });
    } catch {
      weather = undefined;
    }
  }

  const userPreferences = await getUserPreferences();
  const enrichedInput: PlanInput = {
    ...input,
    weather,
    userPreferences: userPreferences.hasData ? userPreferences : undefined,
  };

  const includeAiAdvice = isDateRelatedCompanion(input.companion);
  const isRegenerate = Boolean(input.avoidActivities && input.avoidActivities.length > 0);
  const isMultiDay = TRIP_DURATION_CONFIG[input.tripDuration].dayCount > 1 && !input.spontaneous;
  const isImaHima = Boolean(input.spontaneous);

  const schemaOverrides = input.spontaneous
    ? {
        dayCount: 1,
        itemsMin: input.spontaneous.itemsMin,
        itemsMax: input.spontaneous.itemsMax,
      }
    : undefined;

  let systemPrompt = SYSTEM_PROMPT;
  if (isImaHima) {
    systemPrompt = IMA_HIMA_SYSTEM_PROMPT;
  } else if (userPreferences.hasData && weather) {
    systemPrompt = `${MEMORY_SYSTEM_PROMPT} 天気予報にも合わせて屋内・屋外を調整してください。`;
  } else if (userPreferences.hasData) {
    systemPrompt = MEMORY_SYSTEM_PROMPT;
  } else if (weather) {
    systemPrompt = WEATHER_SYSTEM_PROMPT;
  }
  if (isRegenerate) {
    systemPrompt = includeAiAdvice
      ? `${REGENERATE_SYSTEM_PROMPT} カップル・初デート向けは aiAdvice も作成。天気予報がある場合は天候に合わせたスポット選定を維持。`
      : `${REGENERATE_SYSTEM_PROMPT}${weather ? ' 天気予報がある場合は天候に合わせたスポット選定を維持。' : ''}`;
  } else if (!isImaHima && includeAiAdvice) {
    systemPrompt = weather
      ? `${DATE_SYSTEM_PROMPT} 天気予報に合わせて屋内・屋外スポットを調整してください。`
      : DATE_SYSTEM_PROMPT;
  } else if (!isImaHima && isMultiDay) {
    systemPrompt = weather
      ? `${MULTI_DAY_SYSTEM_PROMPT} 日ごとの天気予報に合わせてスポットを調整してください。`
      : MULTI_DAY_SYSTEM_PROMPT;
  }

  if (isImaHima && weather) {
    systemPrompt = `${systemPrompt} 天気予報に合わせて屋内・屋外スポットを調整してください。`;
  }

  systemPrompt = `${systemPrompt} コンシェルジュモード: 全 item に reservationUrl, websiteUrl, travelTimeToNext を設定してください。`;

  const response = await fetch('https://api.openai.com/v1/responses', {
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

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(parseApiError(response.status, errorBody));
  }

  const data = await response.json();
  return parseAiResponse(
    extractResponseText(data),
    includeAiAdvice,
    input.tripDuration,
    input.tripDate,
    weather,
  );
}
