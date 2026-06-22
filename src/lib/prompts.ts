import type { CurrencyCode } from '@/constants/currency';
import { getCurrency } from '@/constants/currency';
import type { PersonalityOption } from '@/types/plan';

export type PlanInput = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  relationship: string;
  personality: PersonalityOption;
  mood: string;
};

const PERSONALITY_GUIDE: Record<PersonalityOption, string> = {
  冒険家:
    'アクティビティ・体験型スポットを中心に（ハイキング、体験施設、非日常体験、ローカルな冒険）。' +
    '定番観光より「試したことのないこと」を優先。移動に余裕を持たせ、体力を使う要素を入れる。',
  グルメ:
    '食事・グルメをプランの主役に（名店、B級グルメ、市場、スイーツ、地元の名物料理）。' +
    'ランチ・カフェ・ディナーに十分な時間を配し、各スポットの「食」が選定理由の中心になるようにする。',
  のんびり:
    'スポット数は少なめ（4件前後）、各所の滞在時間を長めに。カフェ、公園、温泉、のんびり散策を中心に。' +
    '移動は最小限。時間に余白を持たせ、「急がない1日」になるようスケジュールを組む。',
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

  return `あなたは日本トップクラスの旅行プランナー兼お出かけコンシェルジュです。
高級旅行会社のパンフレットのように、温かみがあり、信頼感のある自然な日本語でプランを作成してください。

## お客様の条件
- 場所: ${location}
- 予算: ${budget} ${input.currency}（${symbol}）
- 通貨: ${input.currency}（${label}）
- 人数: ${people}人
- 誰と: ${input.relationship}
- 旅行タイプ: ${input.personality}
- 今日の気分: ${mood}

## 旅行タイプ「${input.personality}」の方針（最重要・必ず反映）
${personalityGuide}

**旅行タイプはプラン全体の軸です。** スポット選定・時間配分・選定理由・plannerMessage のすべてで「${input.personality}」らしさが一貫して伝わるようにしてください。他の条件（誰と・気分）と両立させつつ、旅行タイプを最優先で反映すること。

## 作成ルール
1. **実在のスポット**を可能な限り使う（店名・施設名・エリア名を具体的に）
2. 各アクティビティに**開始時刻**（HH:MM）を付ける
3. 各スポットに**選んだ理由**を1〜2文で（旅行タイプ・関係性・気分・予算に触れる。旅行タイプへの言及を必須に）
4. 各スポットの**概算費用**を${symbol}付きで記載（人数考慮）
5. **合計予算**は全スポット＋交通費の目安を${symbol}で示す
6. スポット間の**移動方法**（徒歩○分、電車、タクシー等）を具体的に
7. 地理的に近い順に並べ、移動が不自然にならないルートにする
8. 全体の**所要時間**も算出する
9. 文体は丁寧で親しみやすい日本語（「〜がおすすめです」「〜をお楽しみください」等）
10. highlights も旅行タイプ「${input.personality}」の魅力が伝わる内容にする

## 出力JSON（この形式のみ、余計な文章は禁止）
{
  "plannerMessage": "プラン全体への一言メッセージ（日本語、プロのプランナーらしく。旅行タイプ「${input.personality}」への共感を含める）",
  "items": [
    {
      "time": "10:00",
      "activity": "実在店名・施設名",
      "reason": "この場所を選んだ理由（旅行タイプとの関連を必ず含める）",
      "estimatedCost": "概算費用（${symbol}）",
      "transportation": "次のスポットへの移動方法（最終地点は「—」）"
    }
  ],
  "totalBudget": "1日の合計概算（${symbol}、内訳のニュアンスを含む）",
  "duration": "所要時間（例：約8時間30分）",
  "highlights": ["このプランの魅力1", "魅力2", "魅力3"],
  "rainyDayAlternatives": ["雨の日の代替案1", "代替案2", "代替案3"]
}

itemsは4〜6件。totalBudget・estimatedCostには必ず${symbol}を使用してください。`;
}
