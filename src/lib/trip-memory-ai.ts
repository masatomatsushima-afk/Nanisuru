import { APP_MESSAGES, AppError, isNetworkError } from '@/lib/app-errors';
import { getOpenAiApiKey, isOpenAiConfigured } from '@/lib/env';
import { updateTripMemoryAiSummary } from '@/lib/trip-memories';
import type { TripMemoryAiSummary, TripMemoryMedia, TripMemoryWithMedia } from '@/types/trip-memory';

function extractResponseText(data: unknown): string {
  const response = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (response.output_text?.trim()) return response.output_text.trim();

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text.trim();
      }
    }
  }

  throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
}

function buildMediaContext(media: TripMemoryMedia[]): string {
  if (media.length === 0) return '（まだ写真・動画・メモはありません）';

  return media
    .map((item, index) => {
      const slot =
        item.itineraryItemTime && item.itineraryItemActivity
          ? `${item.itineraryItemTime} ${item.itineraryItemActivity}`
          : item.timelineTime || '時間未設定';
      const place = item.placeName ? ` @ ${item.placeName}` : '';
      const typeLabel = item.mediaType === 'note' ? 'メモ' : item.mediaType === 'video' ? '動画' : '写真';
      const content = item.caption || (item.mediaType === 'note' ? '' : typeLabel);
      return `${index + 1}. [${typeLabel}] ${slot}${place}: ${content}`;
    })
    .join('\n');
}

function parseAiSummary(raw: string): TripMemoryAiSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError('AIまとめの解析に失敗しました', 'OPENAI_FAILED');
  }

  const data = parsed as Partial<TripMemoryAiSummary> & { highlights?: string[] };
  const highlights = data.highlights ?? [];

  if (!data.memoryTitle || !data.oneLineSummary || highlights.length < 3) {
    throw new AppError('AIまとめの形式が不正です', 'OPENAI_FAILED');
  }

  return {
    memoryTitle: data.memoryTitle,
    oneLineSummary: data.oneLineSummary,
    highlights: [highlights[0]!, highlights[1]!, highlights[2]!],
    emotionalNote: data.emotionalNote ?? '',
    nextTimeTips: data.nextTimeTips ?? '',
  };
}

export async function generateTripMemoryAiSummary(
  memory: TripMemoryWithMedia,
): Promise<TripMemoryAiSummary> {
  if (!isOpenAiConfigured()) {
    throw new AppError(APP_MESSAGES.openAiNotConfigured, 'OPENAI_FAILED');
  }

  const apiKey = getOpenAiApiKey()!;
  const mediaContext = buildMediaContext(memory.media);

  const prompt = `あなたは旅の思い出をやさしくまとめるアシスタントです。
以下の旅の情報とメディア・メモから、日本語で思い出まとめを作成してください。

【旅タイトル】${memory.title}
【行き先】${memory.destination}
【日程】${memory.dateLabel}
【期間】${memory.durationLabel}
【同行】${memory.companion}

【記録された思い出】
${mediaContext}

JSONのみで返してください:
{
  "memoryTitle": "今日の思い出タイトル（20字以内、感情が伝わる）",
  "oneLineSummary": "旅の一言まとめ（40字以内）",
  "highlights": ["ハイライト1", "ハイライト2", "ハイライト3"],
  "emotionalNote": "感情メモ（2〜3文、温かみのある文体）",
  "nextTimeTips": "次回に活かすこと（1〜2文）"
}`;

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
            content: 'あなたは旅の思い出をまとめる日本語ライターです。JSONのみ返してください。',
          },
          { role: 'user', content: prompt },
        ],
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
  const summary = parseAiSummary(extractResponseText(data));
  await updateTripMemoryAiSummary(memory.id, summary);
  return summary;
}
