import type { CurrencyCode } from '@/constants/currency';
import { getCurrency } from '@/constants/currency';
import type { CompanionOption, PersonalityOption, TripDurationOption } from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';
import type { SpontaneousContext } from '@/types/imafima';

import { buildImaHimaPromptSection, resolveMoodPreferences } from './imafima';
import { TRIP_DURATION_CONFIG } from './trip-duration';
import type { WeatherForecast } from './weather';
import { formatTripDateLabel } from './weather';
import { buildUserMemoryPromptSection } from './user-memory';
import type { UserPreferences } from '@/types/user-memory';

export type PlanInput = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  tripDate: string;
  mood: string;
  weather?: WeatherForecast;
  userPreferences?: UserPreferences;
  avoidActivities?: string[];
  spontaneous?: SpontaneousContext;
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
  const itemsMin = input.spontaneous?.itemsMin ?? durationConfig.itemsMin;
  const itemsMax = input.spontaneous?.itemsMax ?? durationConfig.itemsMax;
  const isMultiDay = durationConfig.dayCount > 1 && !input.spontaneous;
  const dayLabel =
    input.spontaneous?.dayLabel ??
    (input.tripDuration === '半日' ? '半日プラン' : '1日目');

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
          "transportation": "次のスポットへの移動",
          "reservationUrl": "予約URL（不要なら空文字）",
          "websiteUrl": "公式サイトURL（不明なら空文字）",
          "travelTimeToNext": "約15分（徒歩）"
        }
      ]
    }
  ]`
    : `"days": [
    {
      "dayNumber": 1,
      "label": "${dayLabel}",
      "theme": "プランのテーマ（例：グルメと散策）",
      "items": [
        {
          "time": "10:00",
          "activity": "実在店名・施設名",
          "reason": "選んだ理由",
          "estimatedCost": "概算（${symbol}）",
          "transportation": "—",
          "reservationUrl": "予約URL（不要なら空文字）",
          "websiteUrl": "公式サイトURL（不明なら空文字）",
          "travelTimeToNext": "約12分（電車）"
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
    : `- days配列は1件（${input.spontaneous ? input.spontaneous.availableTime : input.tripDuration}）
- itemsは${itemsMin}〜${itemsMax}件
- 合計予算は${input.spontaneous || input.tripDuration === '半日' ? 'この時間帯' : '1日'}の概算`;

  const accommodationRule = isMultiDay
    ? '- **宿泊費**: 泊数・人数・エリア相場に合わせて配分（旅行タイプ「' + input.personality + '」も反映）'
    : '- **宿泊費**: 半日・日帰りのため「¥0（不要）」と記載';

  const budgetOptimizationSection = `
## 予算の最適配分（必須）
お客様の予算「${budget} ${input.currency}」をもとに、budgetBreakdown でカテゴリ別の概算を作成してください。
人数${people}人・期間「${input.tripDuration}」・旅行タイプ「${input.personality}」を考慮し、無理のない配分にすること。

- **total（合計予算）**: 旅行全体の概算合計（${symbol}付き）。お客様予算を超えないよう調整
${accommodationRule}
- **food（食事）**: ランチ・カフェ・ディナー等の食事費合計
- **transportation（交通費）**: 電車・バス・タクシー・新幹線等の移動費合計
- **activity（アクティビティ）**: 入場料・体験・お土産・その他娯楽費合計

各カテゴリの合計が total におおむね一致するよう配分してください。totalBudget は budgetBreakdown.total と同じ値にしてください。`;

  const tripDateLabel = formatTripDateLabel(input.tripDate);

  const weatherSection = input.weather
    ? `

## 天気予報（${input.weather.locationName}・必ず反映）
${input.weather.summary}

${isMultiDay ? '日別予報:' : '当日予報:'}
${input.weather.days
  .map((day) => {
    const guidance = day.preferIndoor
      ? ' → **屋内アクティビティ優先**'
      : day.preferOutdoor
        ? ' → **屋外アクティビティ優先**'
        : '';
    return `- ${day.label}: ${day.condition}（${day.summary}）${guidance}`;
  })
  .join('\n')}

### 天気に基づくスポット選定（最重要）
${
  input.weather.hasRainExpected
    ? `- **雨の予報あり**: 美術館、ショッピングモール、カフェ、水族館、屋内展望など**屋内施設を優先**してください
- 屋外スポットを選ぶ場合は、短時間の移動・雨具不要な場所に限定すること
- 各スポットの選定理由に「天候（雨）への配慮」を必ず記載`
    : ''
}
${
  input.weather.isMostlySunny
    ? `- **晴れの予報**: 公園、散策、テラス席、屋外体験、展望スポットなど**屋外アクティビティを積極的に**組み込んでください
- 各スポットの選定理由に「天候（晴れ）を活かせる」旨を記載`
    : ''
}
${
  !input.weather.hasRainExpected && !input.weather.isMostlySunny
    ? `- 曇りや天候変化の可能性あり。**屋内・屋外をバランスよく**組み合わせ、柔軟に楽しめるプランにすること`
    : ''
}
${isMultiDay ? '- **複数日の場合、日ごとの天気予報に合わせて**その日の items を調整すること（雨の日は屋内、晴れの日は屋外）' : ''}
- plannerMessage に天候への一言（例：「晴れの予報なので屋外も楽しめます」等）を含めること
- rainyDayAlternatives には、雨の日でも楽しめる具体的な代替スポットを記載すること`
    : '';

  const userMemorySection = input.userPreferences
    ? buildUserMemoryPromptSection(input.userPreferences)
    : '';

  const spontaneousSection = input.spontaneous
    ? buildImaHimaPromptSection(
        input.spontaneous,
        resolveMoodPreferences(input.spontaneous.moodLabel),
      )
    : '';

  const conciergeSection = `

## コンシェルジュモード（必須・各 items に設定）
各スポットの items に、予約・アクセス情報を必ず含めてください。

- **reservationUrl**: レストラン・体験施設・美術館等の**直接予約URL**（食べログ予約、公式予約ページ、チケット購入ページ等）。予約不要なスポット（公園・散策等）は**空文字**
- **websiteUrl**: 施設・店舗の**公式サイトURL**。不明・存在しない場合は**空文字**（架空URLは禁止）
- **travelTimeToNext**: 次のスポットまでの**目安移動時間**（例：約15分（徒歩800m）、約8分（地下鉄））。移動手段も含める。各日の**最終 item** は「—」
- transportation には移動手段の説明、travelTimeToNext には時間の目安を記載（両方セットで使う）
- URLは https:// で始まる有効な形式のみ。確信がない場合は空文字にすること`;

  return `あなたは日本トップクラスの旅行プランナー兼お出かけコンシェルジュです。
高級旅行会社のパンフレットのように、温かみがあり、信頼感のある自然な日本語でプランを作成してください。
${input.spontaneous ? '\n**⚡ 今暇モード**: ユーザーは今すぐ出かけたい。近場・今すぐ行けるスポットを最優先に。' : ''}

## お客様の条件
- 場所: ${location}
- 出発日: ${tripDateLabel}（${input.tripDate}）
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
5. **budgetBreakdown** で宿泊・食事・交通・アクティビティのカテゴリ別概算を${symbol}付きで記載
6. **合計予算（totalBudget）**は budgetBreakdown.total と一致させる
7. スポット間の**移動方法**を具体的に（最終地点は「—」）
8. 地理的に近い順に並べ、移動が不自然にならないルートにする
9. duration には期間全体の所要時間・日数を日本語で記載
10. 文体は丁寧で親しみやすい日本語
${budgetOptimizationSection}${weatherSection}${userMemorySection}${spontaneousSection}${conciergeSection}

## 出力JSON（この形式のみ、余計な文章は禁止）
{
  "plannerMessage": "プラン全体への一言（期間「${input.tripDuration}」と旅行タイプへの共感を含める）",
  ${daysJsonExample},
  "budgetBreakdown": {
    "total": "合計概算（${symbol}）",
    "accommodation": "宿泊費概算（${symbol}）",
    "food": "食事費概算（${symbol}）",
    "transportation": "交通費概算（${symbol}）",
    "activity": "アクティビティ費概算（${symbol}）"
  },
  "totalBudget": "合計概算（budgetBreakdown.total と同じ）",
  "duration": "期間・所要時間（例：${input.tripDuration}・約8時間 / ${input.tripDuration}）",
  "highlights": ["魅力1", "魅力2", "魅力3"],
  "rainyDayAlternatives": ["雨の日の代替案1", "代替案2", "代替案3"]${aiAdviceJson}
}

totalBudget・budgetBreakdown・estimatedCostには必ず${symbol}を使用してください。${dateAdviceSection}${variationSection}`;
}
