import { APP_MESSAGES, AppError, isNetworkError } from '@/lib/app-errors';
import { getOpenAiApiKey, isOpenAiConfigured } from '@/lib/env';
import { buildAfterPlanPlacesBrief, fetchAfterPlanPlaces } from '@/lib/after-plan-places';
import {
  AFTER_PLAN_NIGHT_CATEGORIES,
  type AfterPlanInput,
  type AfterPlanOption,
  type AfterPlanResult,
} from '@/types/after-plan';
import type { NearbyPlace } from '@/types/nearby-places';

const AFTER_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: [...AFTER_PLAN_NIGHT_CATEGORIES] },
          reason: { type: 'string' },
          atmosphere: { type: 'string' },
          budgetEstimate: { type: 'string' },
          travelTime: { type: 'string' },
          lastTrainOk: { type: 'string' },
          placeName: { type: 'string' },
          placeAddress: { type: 'string' },
          placeCategory: { type: 'string' },
          safetyNote: { type: 'string' },
          isNonAlcohol: { type: 'boolean' },
        },
        required: [
          'title',
          'category',
          'reason',
          'atmosphere',
          'budgetEstimate',
          'travelTime',
          'lastTrainOk',
          'placeName',
          'placeAddress',
          'placeCategory',
          'safetyNote',
          'isNonAlcohol',
        ],
        additionalProperties: false,
      },
    },
    safetyReminder: { type: 'string' },
  },
  required: ['options', 'safetyReminder'],
  additionalProperties: false,
} as const;

function parseHour(time: string): number | null {
  const [hourPart] = time.split(':');
  const hour = parseInt(hourPart, 10);
  return Number.isNaN(hour) ? null : hour;
}

function buildSafetySection(input: AfterPlanInput): string {
  const hour = parseHour(input.currentTime);
  const lines: string[] = ['## 安全ルール（必ず守る）'];

  if (hour != null && (hour >= 22 || hour < 5)) {
    lines.push('- 深夜帯のため、遠方・人通りの少ない場所・長距離移動は避ける');
    lines.push('- 徒歩圏内・明るいエリア・駅近の公共的な場所を優先');
  }

  if (input.companionType === '恋人' || input.companionType === '初対面') {
    lines.push('- デート・初対面のため、安全で公共的で居心地の良い場所を優先');
    lines.push('- 個室のみ・不審な場所は避ける');
  }

  if (input.departureTime?.trim()) {
    lines.push(`- 出発/早朝フライトあり（${input.departureTime}）→ 低リスク・短時間・確実に間に合うプラン`);
  }

  if (input.lastTrainTime?.trim()) {
    lines.push(`- 終電 ${input.lastTrainTime} → 各案で終電に間に合うか明記`);
  }

  lines.push('- 必ず「帰りの時間に余裕を持って移動してください」を safetyReminder に含める');

  return lines.join('\n');
}

function buildPrompt(input: AfterPlanInput, placesBrief: string): string {
  const nonAlcoholFirst =
    input.alcohol === 'お酒なし'
      ? '\n**重要**: お酒なし希望。夜カフェ・カラオケ・夜景散歩・スイーツ・ラーメン・コンビニ→ホテル等のノンアル案を優先し、最初の2案は必ずノンアルにすること。'
      : '';

  return `あなたは日本の夜・2軒目プラン専門AIです。
1軒目のあと「このあとどうする？」と迷っているユーザーに、3〜5個の具体的な次の行き先案を提案してください。

## 状況
- 今いる場所: ${input.currentLocation}
- 現在時刻: ${input.currentTime}
- 人数: ${input.peopleCount}人
- 誰と: ${input.companionType}
- 今の気分: ${input.mood}
- 予算: ${input.budget} ${input.currency}
- 歩ける距離: ${input.walkDistance}
- お酒: ${input.alcohol}
- 雰囲気: ${input.vibe}
${input.smoking ? `- タバコ: ${input.smoking}` : ''}
${input.lastTrainTime ? `- 終電: ${input.lastTrainTime}` : ''}
${input.destinationDirection ? `- 帰り方向: ${input.destinationDirection}` : ''}
${input.quickNote ? `- 追加メモ: ${input.quickNote}` : ''}
${nonAlcoholFirst}

## 日本の夜カテゴリ（各案に1つ割り当て）
2軒目バー / 居酒屋 / 締めラーメン / 夜カフェ / カラオケ / ダーツバー / 夜景スポット / コンビニ寄ってホテル / 終電前プラン

## 提案ルール
1. 3〜5案。カテゴリ被りを最小限に
2. 実在しそうな店名・施設名（下記リストがあれば優先）
3. 各案: タイトル・理由・雰囲気・予算目安・移動時間・終電に間に合うか
4. タクシー前提の案も1つ含めてよい（walkDistanceがタクシーでもOKの場合）
5. 全部日本語。親しみやすく、今夜すぐ決められる具体性

${buildSafetySection(input)}

${placesBrief}`;
}

function extractResponseText(data: unknown): string {
  const response = data as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  if (response.output_text?.trim()) return response.output_text.trim();
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) return part.text.trim();
    }
  }
  throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
}

function enrichOptionWithPlace(
  option: Omit<AfterPlanOption, 'id' | 'mapsUrl' | 'latitude' | 'longitude'>,
  places: NearbyPlace[],
  index: number,
): AfterPlanOption {
  const matched =
    places.find((place) =>
      option.placeName.includes(place.name.slice(0, 4)) ||
      place.name.includes(option.placeName.slice(0, 4)),
    ) ?? places[index % Math.max(places.length, 1)];

  return {
    ...option,
    id: `after-${Date.now()}-${index}`,
    mapsUrl: matched?.mapsUrl,
    latitude: matched?.latitude,
    longitude: matched?.longitude,
    placeAddress: option.placeAddress || matched?.address,
  };
}

export async function generateAfterPlanOptions(input: AfterPlanInput): Promise<AfterPlanResult> {
  if (!isOpenAiConfigured()) {
    throw new AppError(APP_MESSAGES.openAiNotConfigured, 'OPENAI_FAILED');
  }

  const placesContext = await fetchAfterPlanPlaces(input);
  const placesBrief = placesContext
    ? buildAfterPlanPlacesBrief(placesContext)
    : '周辺スポット: 未取得';

  const apiKey = getOpenAiApiKey()!;
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
          {
            role: 'system',
            content:
              'あなたは日本のナイトライフ・2軒目提案の専門家です。JSONのみ返してください。',
          },
          { role: 'user', content: buildPrompt(input, placesBrief) },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'nanisuru_after_plan',
            strict: true,
            schema: AFTER_PLAN_SCHEMA,
          },
        },
      }),
    });
  } catch (error) {
    if (isNetworkError(error)) {
      throw new AppError(APP_MESSAGES.networkError, 'NETWORK_ERROR');
    }
    throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
  }

  if (!response.ok) {
    throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
  }

  const data = await response.json();
  const parsed = JSON.parse(extractResponseText(data)) as {
    options: Array<Omit<AfterPlanOption, 'id' | 'mapsUrl' | 'latitude' | 'longitude'>>;
    safetyReminder: string;
  };

  const places = placesContext?.places ?? [];

  return {
    options: parsed.options.map((option, index) => enrichOptionWithPlace(option, places, index)),
    safetyReminder: parsed.safetyReminder.includes('余裕')
      ? parsed.safetyReminder
      : `${parsed.safetyReminder} 帰りの時間に余裕を持って移動してください。`,
    placesSource: placesContext ? 'google' : undefined,
    generatedAt: new Date().toISOString(),
  };
}

export { isOpenAiConfigured };
