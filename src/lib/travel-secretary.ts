import { buildSecretaryTripBrief, getActiveTrip } from '@/lib/active-trip';
import { getOpenAiApiKey, isOpenAiConfigured } from '@/lib/env';
import { buildNearbyPlacesBrief } from '@/lib/nearby-places';
import { buildTravelMemoryPromptSection, getTravelMemories } from '@/lib/travel-memory';
import { getUserPreferences } from '@/lib/user-memory';
import type { NearbyPlacesContext } from '@/types/nearby-places';
import type { ActiveTripContext, SecretaryMessage } from '@/types/travel-secretary';

function buildPreferencesSection(
  prefs: Awaited<ReturnType<typeof getUserPreferences>>,
): string {
  if (!prefs.hasData) {
    return 'ユーザーの過去の好み: 記録なし（今回のプラン情報を優先）';
  }

  const lines: string[] = [];
  if (prefs.favoriteTravelStyle) lines.push(`好みの旅行タイプ: ${prefs.favoriteTravelStyle}`);
  if (prefs.budgetPreference) lines.push(`予算の傾向: ${prefs.budgetPreference}`);
  if (prefs.preferredTripDuration) lines.push(`好みの期間: ${prefs.preferredTripDuration}`);
  if (prefs.favoriteActivities.length > 0) {
    lines.push(`よく選ぶスポット: ${prefs.favoriteActivities.slice(0, 5).join('、')}`);
  }

  return `ユーザーの過去の好み:\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

export function buildSecretarySystemPrompt(
  activeTrip: ActiveTripContext | null,
  nearbyPlaces: NearbyPlacesContext | null = null,
): string {
  const tripSection = activeTrip
    ? buildSecretaryTripBrief(activeTrip)
    : `=== 現在の旅行プラン ===
アクティブなプランはまだありません。ホームでプランを生成すると、目的地・予算・期間・同行者・行程を自動で把握し、より具体的なアドバイスが可能です。`;

  const nearbySection = nearbyPlaces
    ? `\n\n${buildNearbyPlacesBrief(nearbyPlaces)}`
    : '';

  return `あなたは「AI旅行秘書」— Nanisuru の専属旅行コンシェルジュです。
ユーザーは**既に旅行プランを作成済み**です。あなたはそのプランを**すべて把握している**前提で話してください。

## 最重要ルール
- 目的地・予算・旅行期間・旅行スタイル・同行者・行程は**すべて下記に記載済み**
- ユーザーに「どこへ行きますか？」「予算は？」「誰と？」など**基本情報を再確認してはいけない**
- 回答は**現在の行程を具体的に参照**する（「14時の○○の代わりに△△」など）
- 現在地・周辺スポット情報がある場合は、**距離・徒歩時間付き**で具体的に提案する
- プラン未設定の場合のみ、一般的な旅行アドバイスを提供する

## 役割
- 天候変化（雨など）への即時対応と代替プラン提案
- 予算の見直し・節約アドバイス
- 近くのおすすめスポット提案（Google Places の周辺検索結果を活用）
- 行程の変更・組み替え
- 子供連れ・家族向けへの調整
- 旅行中の不安や疑問への回答

## 回答スタイル
- **日本語**で、丁寧だが親しみやすいトーン（です・ます調）
- 箇条書きや番号付きで**すぐ実行できる**提案にする
- 具体的なスポット名・移動手段・概算費用を含める
- 既存行程を尊重しつつ変更案を示す
- 1回の回答は**300字以内を目安**（長すぎない）
- 絵文字は控えめ（0〜2個まで）

${tripSection}${nearbySection}

## 利用可能な情報
- 上記の現在プラン（目的地・予算・期間・スタイル・同行者・全行程）
- 現在地と周辺スポット（取得済みの場合）
- ユーザーの過去の好み（下記）
- 会話履歴

プラン変更を提案する際は、「今の○○の代わりに△△」のように**何をどう変えるか**を明確にしてください。`;
}

async function buildEnrichedSystemPrompt(
  activeTrip: ActiveTripContext | null,
  nearbyPlaces: NearbyPlacesContext | null,
): Promise<string> {
  const [prefs, travelMemories] = await Promise.all([
    getUserPreferences(),
    getTravelMemories(),
  ]);
  const base = buildSecretarySystemPrompt(activeTrip, nearbyPlaces);
  const travelMemorySection = travelMemories.length
    ? `\n\n${buildTravelMemoryPromptSection(travelMemories)}`
    : '';
  return `${base}${travelMemorySection}\n\n${buildPreferencesSection(prefs)}`;
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
    return response.output_text.trim();
  }

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text.trim();
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

export async function sendSecretaryMessage(params: {
  userMessage: string;
  history: SecretaryMessage[];
  nearbyPlaces?: NearbyPlacesContext | null;
}): Promise<string> {
  if (!isOpenAiConfigured()) {
    throw new Error(
      'OpenAI APIキーが設定されていません。\n.env に EXPO_PUBLIC_OPENAI_API_KEY を追加してください。',
    );
  }

  const activeTrip = await getActiveTrip();
  const apiKey = getOpenAiApiKey()!;
  const systemPrompt = await buildEnrichedSystemPrompt(activeTrip, params.nearbyPlaces ?? null);

  const recentHistory = params.history.slice(-10).map((message) => ({
    role: message.role,
    content: message.content,
  }));

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
        ...recentHistory,
        { role: 'user', content: params.userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(parseApiError(response.status, errorBody));
  }

  const data = await response.json();
  return extractResponseText(data);
}

export { isOpenAiConfigured };
