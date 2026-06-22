import type { AiAdvice, ItineraryDay, ItineraryItem, PlanDetails, TripDurationOption } from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';

import { getOpenAiApiKey, isOpenAiConfigured } from './env';
import { buildConciergePrompt, type PlanInput } from './prompts';
import { flattenItineraryDays, TRIP_DURATION_CONFIG } from './trip-duration';

export type GeneratedPlan = {
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
};

export { isOpenAiConfigured };

type AiPlanResponse = {
  plannerMessage?: string;
  days?: ItineraryDay[];
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
  },
  required: ['time', 'activity', 'reason', 'estimatedCost', 'transportation'],
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

function buildPlanJsonSchema(tripDuration: TripDurationOption, includeAiAdvice: boolean) {
  const { dayCount, itemsMin, itemsMax } = TRIP_DURATION_CONFIG[tripDuration];

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
    totalBudget: {
      type: 'string',
      description: 'Total trip budget with currency symbol in Japanese',
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

function parseAiResponse(
  content: string,
  includeAiAdvice: boolean,
  tripDuration: TripDurationOption,
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
    })),
  }));

  return {
    days,
    items: flattenItineraryDays(days),
    details: {
      plannerMessage: parsed.plannerMessage,
      totalBudget: parsed.totalBudget ?? '予算目安を算出できませんでした',
      duration: parsed.duration ?? tripDuration,
      tripDuration,
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

  const includeAiAdvice = isDateRelatedCompanion(input.companion);
  const isRegenerate = Boolean(input.avoidActivities && input.avoidActivities.length > 0);
  const isMultiDay = TRIP_DURATION_CONFIG[input.tripDuration].dayCount > 1;

  let systemPrompt = SYSTEM_PROMPT;
  if (isRegenerate) {
    systemPrompt = includeAiAdvice ? `${REGENERATE_SYSTEM_PROMPT} カップル・初デート向けは aiAdvice も作成。` : REGENERATE_SYSTEM_PROMPT;
  } else if (includeAiAdvice) {
    systemPrompt = DATE_SYSTEM_PROMPT;
  } else if (isMultiDay) {
    systemPrompt = MULTI_DAY_SYSTEM_PROMPT;
  }

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
        { role: 'user', content: buildConciergePrompt(input) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: includeAiAdvice ? 'nanisuru_trip_plan_with_advice' : 'nanisuru_trip_plan',
          strict: true,
          schema: buildPlanJsonSchema(input.tripDuration, includeAiAdvice),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(parseApiError(response.status, errorBody));
  }

  const data = await response.json();
  return parseAiResponse(extractResponseText(data), includeAiAdvice, input.tripDuration);
}
