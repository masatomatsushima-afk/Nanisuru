import type { ItineraryItem, PlanDetails } from '@/types/plan';

import { buildConciergePrompt, type PlanInput } from './prompts';

export type GeneratedPlan = {
  items: ItineraryItem[];
  details: PlanDetails;
};

type AiPlanResponse = {
  items?: ItineraryItem[];
  totalBudget?: string;
  duration?: string;
  highlights?: string[];
  rainyDayAlternatives?: string[];
};

function getApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_OPENAI_API_KEY;
}

function parseAiResponse(content: string): GeneratedPlan {
  const parsed = JSON.parse(content) as AiPlanResponse;

  if (!parsed.items || parsed.items.length === 0) {
    throw new Error('プランの形式が正しくありません');
  }

  const items = parsed.items.map((item) => ({
    time: item.time,
    activity: item.activity,
  }));

  return {
    items,
    details: {
      totalBudget: parsed.totalBudget ?? '予算目安を算出できませんでした',
      duration: parsed.duration ?? '約1日',
      highlights: parsed.highlights ?? [],
      rainyDayAlternatives: parsed.rainyDayAlternatives ?? [],
    },
  };
}

export function isOpenAiConfigured(): boolean {
  return Boolean(getApiKey());
}

export async function generatePlanWithAi(input: PlanInput): Promise<GeneratedPlan> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OpenAI APIキーが設定されていません。.env に EXPO_PUBLIC_OPENAI_API_KEY を追加してください。');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'あなたは日本のお出かけプランを提案するプロのコンシェルジュです。常にJSONのみを返してください。',
        },
        {
          role: 'user',
          content: buildConciergePrompt(input),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI APIエラー (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AIからの応答が空でした');
  }

  return parseAiResponse(content);
}
