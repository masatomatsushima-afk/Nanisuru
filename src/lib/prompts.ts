import type { CurrencyCode } from '@/constants/currency';
import { getCurrency } from '@/constants/currency';
import type { CompanionOption, PersonalityOption, TripDurationOption } from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';

import { TRIP_DURATION_CONFIG } from './trip-duration';

export type PlanInput = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  mood: string;
  avoidActivities?: string[];
};

const PERSONALITY_GUIDE: Record<PersonalityOption, string> = {
  冒険家:
    'アクティビティ・体験型スポットを中心に（ハイキング、体験施設、非日常体験、ローカルな冒険）。' +
    '定番観光より「試したことのないこと」を優先。移動に余裕を持たせ、体力を使う要素を入れる。',
  グルメ:
    '食事・グルメをプランの主役に（名店、B級グルメ、市場、スイーツ、地元の名物料理）。' +
    'ランチ・カフェ・ディナーに十分な時間を配し、各スポットの「食」が選定理由の中心になるようにする。',
  のんびり:
    'スポット数は少なめ、各所の滞在時間を長めに。カフェ、公園、温泉、のんびり散策を中心に。' +
    '移動は最小限。時間に余白を持たせ、「急がない」ペースで組む。',
  映え重視:
    '写真映えするスポットを最優先（絶景、おしゃれカフェ、ネオン街、フォトスポット、デザイン性の高い施設）。' +
    '各スポットの選定理由に「映えるポイント」を必ず含める。光の条件（夕方の黄金時間など）も考慮する。',
  穴場好き:
    'メジャー観光地・行列店は避け、地元民向けの店、路地裏、小さなギャラリー、知る人ぞ知る名所を選ぶ。' +
    '「観光客が少ない」「地元の人が通う」理由を各スポットで説明する。',
};

export function buildConciergePrompt(input: PlanInput): string {
  const location = input.location.trim() || '未指定';
  const budget = input.budget.trim() || '未指定';
  const people = input.people.trim() || '未指定';
  const mood = input.mood.trim() || '未指定';
  const { symbol, label } = getCurrency(input.currency);
  const personalityGuide = PERSONALITY_GUIDE[input.personality];
  const includeAiAdvice = isDateRelatedCompanion(input.companion);
  const durationConfig = TRIP_DURATION_CONFIG[input.tripDuration];
  const isMultiDay = durationConfig.dayCount > 1;

  const dateAdviceSection = includeAiAdvice
    ? `

## デート向けAIアドバイス（必須・すべて日本語）
「${input.companion}」同士のお出かけ向けに、上記プランのスポット内容を踏まえて aiAdvice を作成してください。
- **conversationTips（会話のヒント）**: 3〜4件。自然に会話が続く具体的なヒント。プランの場所・体験に触れること。
- **recommendedTopics（おすすめの話題）**: 3〜4件。その日のプランや相手との関係性に合った話題。
- **topicsToAvoid（避けた方がいい話題）**: 2〜3件。${input.companion === '初デート' ? '初デートで盛り上がりにくい・距離が縮まらない' : 'カップルのデートで雰囲気を損なう'}話題。

トーンは温かく、押し付けがましくない日本語にしてください。`
    : '';

  const aiAdviceJson = includeAiAdvice
    ? `,
  "aiAdvice": {
    "conversationTips": ["会話のヒント1", "ヒント2", "ヒント3"],
    "recommendedTopics": ["おすすめの話題1", "話題2", "話題3"],
    "topicsToAvoid": ["避けた方がいい話題1", "話題2"]
  }`
    : '';

  const variationSection =
    input.avoidActivities && input.avoidActivities.length > 0
      ? `

## 別プラン提案（最重要）
お客様にはすでに以下のスポットを含むプランを提案済みです。**これらの店名・施設名・スポットは一切使わないでください。** 同じ条件（場所・予算・期間・誰と・旅行タイプ・気分）を維持しつつ、全く異なるルート・体験の新しいプランを作成してください。

前回提案済み（使用禁止）:
${input.avoidActivities.map((name) => `- ${name}`).join('\n')}

- 上記と同名・同系統の店舗も避け、別エリアや別ジャンルも積極的に検討すること
- 旅行タイプ「${input.personality}」の方針は維持し、前回とは違う魅力が伝わるプランにすること`
      : '';

  const daysJsonExample = isMultiDay
    ? `"days": [
    {
      "dayNumber": 1,
      "label": "1日目",
      "theme": "到着・市内散策",
      "items": [
        {
          "time": "10:00",
          "activity": "実在店名・施設名",
          "reason": "選んだ理由",
          "estimatedCost": "概算（${symbol}）",
          "transportation": "次のスポットへの移動"
        }
      ]
    }
  ]`
    : `"days": [
    {
      "dayNumber": 1,
      "label": "${input.tripDuration === '半日' ? '半日プラン' : '1日目'}",
      "theme": "プランのテーマ（例：グルメと散策）",
      "items": [
        {
          "time": "10:00",
          "activity": "実在店名・施設名",
          "reason": "選んだ理由",
          "estimatedCost": "概算（${symbol}）",
          "transportation": "—"
        }
      ]
    }
  ]`;

  const durationRules = isMultiDay
    ? `- **days配列は必ず${durationConfig.dayCount}件**（${input.tripDuration}）
- 各日は独立した itinerary を持つ（label: "1日目"〜"${durationConfig.dayCount}日目"）
- 各日の theme にその日のコンセプトを日本語で記載
- 各日の items は${durationConfig.itemsMin}〜${durationConfig.itemsMax}件
- 日を跨ぐ移動（新幹線・宿泊等）も該当日の items / transportation に含める
- 合計予算は旅行全体（宿泊・交通・食事・体験）の概算`
    : `- days配列は1件（${input.tripDuration}）
- itemsは${durationConfig.itemsMin}〜${durationConfig.itemsMax}件
- 合計予算は${input.tripDuration === '半日' ? '半日' : '1日'}の概算`;

  return `あなたは日本トップクラスの旅行プランナー兼お出かけコンシェルジュです。
高級旅行会社のパンフレットのように、温かみがあり、信頼感のある自然な日本語でプランを作成してください。

## お客様の条件
- 場所: ${location}
- 期間: ${input.tripDuration}
- 予算: ${budget} ${input.currency}（${symbol}）※${isMultiDay ? '旅行全体' : 'この期間'}の目安
- 通貨: ${input.currency}（${label}）
- 人数: ${people}人
- 誰と: ${input.companion}
- 旅行タイプ: ${input.personality}
- 今日の気分: ${mood}

## 期間「${input.tripDuration}」の方針
${durationConfig.guide}

${durationRules}

## 旅行タイプ「${input.personality}」の方針（最重要・必ず反映）
${personalityGuide}

**旅行タイプはプラン全体の軸です。** 各日・各スポットの選定理由・plannerMessage で「${input.personality}」らしさが一貫して伝わるようにしてください。

## 作成ルール
1. **実在のスポット**を可能な限り使う（店名・施設名・エリア名を具体的に）
2. 各アクティビティに**開始時刻**（HH:MM）を付ける
3. 各スポットに**選んだ理由**を1〜2文で（旅行タイプ・関係性・気分・予算・期間に触れる）
4. 各スポットの**概算費用**を${symbol}付きで記載（人数考慮）
5. **合計予算**は${isMultiDay ? '旅行全体' : '期間全体'}の概算を${symbol}で示す
6. スポット間の**移動方法**を具体的に（最終地点は「—」）
7. 地理的に近い順に並べ、移動が不自然にならないルートにする
8. duration には期間全体の所要時間・日数を日本語で記載
9. 文体は丁寧で親しみやすい日本語

## 出力JSON（この形式のみ、余計な文章は禁止）
{
  "plannerMessage": "プラン全体への一言（期間「${input.tripDuration}」と旅行タイプへの共感を含める）",
  ${daysJsonExample},
  "totalBudget": "合計概算（${symbol}）",
  "duration": "期間・所要時間（例：${input.tripDuration}・約8時間 / ${input.tripDuration}）",
  "highlights": ["魅力1", "魅力2", "魅力3"],
  "rainyDayAlternatives": ["雨の日の代替案1", "代替案2", "代替案3"]${aiAdviceJson}
}

totalBudget・estimatedCostには必ず${symbol}を使用してください。${dateAdviceSection}${variationSection}`;
}
