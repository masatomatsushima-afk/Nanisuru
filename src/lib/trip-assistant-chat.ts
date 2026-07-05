import { sendSecretaryMessage } from '@/lib/travel-secretary';
import type { TripAssistantContext } from '@/types/trip-assistant';
import type { SecretaryMessage } from '@/types/travel-secretary';

function buildAssistantBrief(context: TripAssistantContext): string {
  const sections = [context.extendedBrief];

  sections.push(`
## 旅行秘書モード（重要）
- 上記の保存済みプラン・行程をもとに回答してください
- 具体的な行程変更を提案する場合は、**どの予定を何に変えるか**を明示してください（例：「14時の〇〇公園 → △△美術館」）
- 変更案は**提案のみ** — プランを自動で上書きしないでください
- 雨・予算・夜の予定変更などは、既存行程の近く・同時間帯の代替を優先してください
- 全く無関係な新プランの再生成は避けてください
- 予算質問では概算内訳とリスクカテゴリを示してください
- 持ち物や一般アドバイスのみの場合は、行程変更を提案しないでください
- ユーザー好み:\n${context.userPreferences}
`);

  if (context.weatherContext) {
    sections.push(`\n## 天候コンテキスト\n${context.weatherContext}`);
  }

  return sections.join('\n');
}

export async function sendTripAssistantMessage(params: {
  userMessage: string;
  history: SecretaryMessage[];
  context: TripAssistantContext;
}): Promise<string> {
  console.log('[TripAssistant] user message', params.userMessage);

  const response = await sendSecretaryMessage({
    userMessage: params.userMessage,
    history: params.history,
    tripContext: params.context.tripContext,
    folderBrief: buildAssistantBrief(params.context),
  });

  console.log('[TripAssistant] AI response', response);
  return response;
}
