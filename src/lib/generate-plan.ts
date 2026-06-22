import type { ItineraryItem, PlanDetails } from '@/types/plan';

import { getOpenAiApiKey, isOpenAiConfigured } from './env';
import { buildConciergePrompt, type PlanInput } from './prompts';

export type GeneratedPlan = {
  items: ItineraryItem[];
  details: PlanDetails;
};

export { isOpenAiConfigured };

type AiPlanResponse = {
  plannerMessage?: string;
  items?: ItineraryItem[];
  totalBudget?: string;
  duration?: string;
  highlights?: string[];
  rainyDayAlternatives?: string[];
};

const PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    plannerMessage: {
      type: 'string',
      description: 'Professional planner greeting message in Japanese',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          time: { type: 'string', description: 'Start time HH:MM' },
          activity: { type: 'string', description: 'Real place or venue name in Japanese' },
          reason: { type: 'string', description: 'Why this place was chosen, in Japanese' },
          estimatedCost: { type: 'string', description: 'Estimated cost with currency symbol' },
          transportation: {
            type: 'string',
            description: 'Transport to next stop; use — for last item',
          },
        },
        required: ['time', 'activity', 'reason', 'estimatedCost', 'transportation'],
        additionalProperties: false,
      },
      minItems: 4,
      maxItems: 6,
    },
    totalBudget: { type: 'string', description: 'Total day budget with currency symbol in Japanese' },
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
  },
  required: [
    'plannerMessage',
    'items',
    'totalBudget',
    'duration',
    'highlights',
    'rainyDayAlternatives',
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  'あなたはプロの旅行プランナーです。' +
  'お客様の旅行タイプ（冒険家・グルメ・のんびり・映え重視・穴場好き）を最優先で反映し、' +
  '実在のスポット名、具体的な移動手段、丁寧な日本語で、指定JSONスキーマに厳密に従って回答してください。' +
  '架空の店名は避け、わからない場合はそのエリアの代表的な実在スポットを選んでください。';

function parseAiResponse(content: string): GeneratedPlan {
  const parsed = JSON.parse(content) as AiPlanResponse;

  if (!parsed.items || parsed.items.length === 0) {
    throw new Error('プランの形式が正しくありません');
  }

  const items: ItineraryItem[] = parsed.items.map((item) => ({
    time: item.time,
    activity: item.activity,
    reason: item.reason,
    estimatedCost: item.estimatedCost,
    transportation: item.transportation,
  }));

  return {
    items,
    details: {
      plannerMessage: parsed.plannerMessage,
      totalBudget: parsed.totalBudget ?? '予算目安を算出できませんでした',
      duration: parsed.duration ?? '約1日',
      highlights: parsed.highlights ?? [],
      rainyDayAlternatives: parsed.rainyDayAlternatives ?? [],
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

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildConciergePrompt(input) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'nanisuru_day_plan',
          strict: true,
          schema: PLAN_JSON_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(parseApiError(response.status, errorBody));
  }

  const data = await response.json();
  return parseAiResponse(extractResponseText(data));
}
