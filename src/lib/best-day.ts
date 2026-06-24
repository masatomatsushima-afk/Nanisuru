import type {
  BestDayContext,
  BestDayMoodOption,
  BestDayMoodPreferences,
  BestDayTimeConfig,
  BestDayTimeOption,
} from '@/types/best-day';
import type { CompanionOption, PersonalityOption, TripDurationOption } from '@/types/plan';
import { APP_MESSAGES } from '@/lib/app-errors';

export const BEST_DAY_TIME_CONFIG: Record<BestDayTimeOption, BestDayTimeConfig> = {
  '2時間': {
    tripDuration: '半日',
    itemsMin: 2,
    itemsMax: 3,
    dayLabel: '最高の2時間',
    guide: '2時間で完結する、密度の高い「最高のひととき」。移動最小・満足度最大。',
  },
  '3時間': {
    tripDuration: '半日',
    itemsMin: 3,
    itemsMax: 3,
    dayLabel: '最高の3時間',
    guide: '3時間の黄金ルート。食事・体験・余韻のバランスを完璧に。',
  },
  半日: {
    tripDuration: '半日',
    itemsMin: 3,
    itemsMax: 4,
    dayLabel: '最高の半日',
    guide: '半日（4〜5時間）の理想形。テンポよく、疲れすぎない最高の流れ。',
  },
  '1日': {
    tripDuration: '1日',
    itemsMin: 4,
    itemsMax: 6,
    dayLabel: '最高の1日',
    guide: '朝から夜まで、1日をフルに使った「人生最高級」のプラン。クライマックス必須。',
  },
};

export function buildBestDayContext(
  mood: BestDayMoodOption,
  availableTime: BestDayTimeOption,
  people: string,
  moodDescription: string,
): BestDayContext {
  const config = BEST_DAY_TIME_CONFIG[availableTime];
  return {
    mood,
    availableTime,
    people,
    itemsMin: config.itemsMin,
    itemsMax: config.itemsMax,
    timeGuide: config.guide,
    dayLabel: config.dayLabel,
    moodDescription,
  };
}

export function getBestDayTripDuration(time: BestDayTimeOption): TripDurationOption {
  return BEST_DAY_TIME_CONFIG[time].tripDuration;
}

export function resolveBestDayPreferences(
  mood: BestDayMoodOption,
  people: string,
): BestDayMoodPreferences {
  const map: Record<
    BestDayMoodOption,
    { personality: PersonalityOption; companion: CompanionOption; moodDescription: string; forcePeople?: string }
  > = {
    癒されたい: {
      personality: 'のんびり',
      companion: '一人',
      moodDescription: '心身を休める、穏やかで贅沢な時間',
    },
    冒険したい: {
      personality: '冒険家',
      companion: '友達',
      moodDescription: '非日常・体験・ワクワクする発見',
    },
    美味しいものを食べたい: {
      personality: 'グルメ',
      companion: '友達',
      moodDescription: '食の感動、名店・隠れ家・ご当地',
    },
    恋人と過ごしたい: {
      personality: '映え重視',
      companion: 'カップル',
      moodDescription: 'ロマンチック、特別感、二人だけの時間',
      forcePeople: '2',
    },
    一人で過ごしたい: {
      personality: '穴場好き',
      companion: '一人',
      moodDescription: '自分だけの時間、静かな発見',
      forcePeople: '1',
    },
    学びたい: {
      personality: '穴場好き',
      companion: '一人',
      moodDescription: '文化・歴史・新しい知識との出会い',
    },
    AIに任せる: {
      personality: 'のんびり',
      companion: resolveCompanionFromPeople(people),
      moodDescription: 'AIコンシェルジュが最適なスタイルを判断',
    },
  };

  const prefs = map[mood];
  const count = parseInt(people, 10) || 1;
  let companion = prefs.companion;
  if (mood === 'AIに任せる') {
    companion = resolveCompanionFromPeople(people);
  } else if (count >= 3 && mood !== '恋人と過ごしたい' && mood !== '一人で過ごしたい') {
    companion = '家族';
  } else if (count === 2 && mood !== '一人で過ごしたい' && mood !== '恋人と過ごしたい') {
    companion = '友達';
  }

  return {
    personality: prefs.personality,
    companion,
    moodDescription: prefs.moodDescription,
    effectivePeople: prefs.forcePeople ?? people,
  };
}

function resolveCompanionFromPeople(people: string): CompanionOption {
  const count = parseInt(people, 10) || 1;
  if (count <= 1) return '一人';
  if (count === 2) return '友達';
  return '家族';
}

export function buildBestDayPromptSection(context: BestDayContext): string {
  return `

## 🔥 最高の1日モード（プレミアム・コンシェルジュ）
ユーザーは**計画したくない**。あなたは**専属のAIコンシェルジュ**として、感情に寄り添い、条件の中で**可能な限り最高の1日**を設計してください。
行程リストではなく、**「あなただけの特別な1日」**として語りかけてください。

### 入力条件
- 気分: **${context.mood}**（${context.moodDescription}）
- 空き時間: **${context.availableTime}**
- 人数: **${context.people}人**

### 旅行メモリー（最重要）
ユーザーの**旅行メモリー**（食の好み・スタイル・予算感など）が提供されている場合、**最優先で反映**してください。
メモリーに触れた場合は、conciergeAnalysis.userPreferences または overallStrategy で「あなたの好みを踏まえて」と伝えること。

### 必須出力（UIにそのまま表示 — 役割を混同しないこと）

#### 🎭 今日のテーマ → days[0].theme
- **1行**、詩的でワクワクするテーマ名（例:「映画みたいな休日」「路地裏の美学と、黄昏の一杯」）
- 引用符「」は付けなくてよい（UIが装飾します）

#### ✨ このプランを選んだ理由 → conciergeAnalysis.overallStrategy
- **2〜4文**、温かく説得力のある日本語
- 気分・予算・時間・人数・（あれば）旅行メモリーを踏まえ、**なぜこの組み合わせが「最高」なのか**
- 例:「あなたの気分と予算に合わせて、リラックスと発見を両立する1日を設計しました。」
- 具体的なスポット名は控えめに、**体験の価値・感情**を伝える

#### 🤖 AIコンシェルジュから一言 → plannerMessage
- **1〜2文のみ**、親友のように寄り添う**パーソナルな一言**
- 例:「今日はスマホを見る時間を減らし、目の前の景色を楽しんでください。」
- overallStrategy とは**別物**。こちらは短く、感情的に

#### ⭐ 今日のハイライト → highlights
- **3〜5件**、短い日本語フレーズ（例:「夕日が綺麗なスポット」「隠れ家カフェ」「特別なディナー」）
- この1日で**絶対に外せない瞬間**

#### 📅 タイムライン → days[0].items
- スポット数: **${context.itemsMin}〜${context.itemsMax}** 件
- 各 item: 時刻・activity（実在スポット名）・reason・estimatedCost・transportation
- テーマに沿った**物語としての流れ**

#### 💰 予算内訳 → budgetBreakdown + totalBudget
- 入力予算内の現実的な配分

### 設計方針
${context.timeGuide}
- days配列は1件。label は「${context.dayLabel}」
- conciergeAnalysis の全項目を丁寧に記載
- ユーザーが「プロに任せて正解だった」と**感情적으로**感じるプレミアム体験に`;
}

export const BEST_DAY_LOADING_STEPS = [
  { icon: '📍', label: APP_MESSAGES.loadingSearchingPlaces },
  { icon: '🔥', label: 'あなたの気分を読み取っています…' },
  { icon: '💾', label: '旅行メモリーを反映しています…' },
  { icon: '🤖', label: APP_MESSAGES.loadingAiPlanning },
  { icon: '✨', label: '最高の1日が完成' },
] as const;

export const BEST_DAY_LOADING_STEPS_NO_MEMORY = [
  { icon: '📍', label: APP_MESSAGES.loadingSearchingPlaces },
  { icon: '🔥', label: 'あなたの気分を読み取っています…' },
  { icon: '🤖', label: APP_MESSAGES.loadingAiPlanning },
  { icon: '🗺', label: APP_MESSAGES.loadingPreparingRoute },
  { icon: '✨', label: '最高の1日が完成' },
] as const;

export async function runBestDayLoadingAnimation(
  onStep: (step: number) => void,
  hasTravelMemory = false,
): Promise<void> {
  const steps = hasTravelMemory ? BEST_DAY_LOADING_STEPS : BEST_DAY_LOADING_STEPS_NO_MEMORY;
  for (let i = 0; i < steps.length; i++) {
    onStep(i);
    await new Promise((resolve) => setTimeout(resolve, 850));
  }
}
