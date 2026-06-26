import {
  applyQuickDateOption,
  createDefaultTripSchedule,
} from '@/lib/trip-schedule';
import type { CompanionOption, PersonalityOption } from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import {
  TRAVEL_INTENT_COMPANION_HINT,
  TRAVEL_INTENT_PERSONALITY,
  type PlanCreationType,
  type TravelIntentOption,
} from '@/types/plan-creation';
import type { TripScheduleEditorValue } from '@/types/trip-schedule';

import { formatCombinedMood } from './custom-preferences';

export function showsMoodQuestion(planType: PlanCreationType): boolean {
  return planType === '今日のお出かけ' || planType === 'デートプラン';
}

export function showsTravelIntentQuestion(planType: PlanCreationType): boolean {
  return planType === '旅行プラン' || planType === '週末プラン';
}

export function showsPersonalityQuestion(planType: PlanCreationType): boolean {
  return planType === 'AIに任せる';
}

export function isCompactSchedule(planType: PlanCreationType): boolean {
  return planType === '今日のお出かけ' || planType === 'デートプラン';
}

export function formatCombinedTravelIntent(
  selected: TravelIntentOption | '',
  customTravelIntent?: string,
): string {
  const chip = selected.trim();
  const custom = customTravelIntent?.trim() ?? '';

  if (chip && custom) {
    return `${chip}（自由入力: ${custom}）`;
  }
  if (custom) return custom;
  if (chip) return chip;
  return '';
}

export function resolvePersonalityForPlan(input: {
  planType: PlanCreationType;
  personality: PersonalityOption | null;
  travelIntent: TravelIntentOption | '';
}): PersonalityOption {
  if (input.personality) return input.personality;
  if (input.travelIntent && input.travelIntent in TRAVEL_INTENT_PERSONALITY) {
    return TRAVEL_INTENT_PERSONALITY[input.travelIntent as TravelIntentOption];
  }
  return 'のんびり';
}

export function resolveCompanionHint(
  travelIntent: TravelIntentOption | '',
): CompanionOption | null {
  if (!travelIntent || !(travelIntent in TRAVEL_INTENT_COMPANION_HINT)) return null;
  return TRAVEL_INTENT_COMPANION_HINT[travelIntent as TravelIntentOption] ?? null;
}

export function applyPlanTypeDefaults(
  planType: PlanCreationType,
  schedule: TripScheduleEditorValue,
): TripScheduleEditorValue {
  switch (planType) {
    case '今日のお出かけ':
    case 'デートプラン':
      return applyQuickDateOption({ ...schedule, durationPreset: '1日' }, '今日');
    case '週末プラン':
      return applyQuickDateOption({ ...schedule, durationPreset: '1泊2日' }, '週末');
    case '旅行プラン':
      return schedule.departureDate
        ? schedule
        : createDefaultTripSchedule();
    case 'AIに任せる':
    default:
      return schedule;
  }
}

export function canGeneratePlan(input: {
  planType: PlanCreationType;
  companion: CompanionOption | null;
  personality: PersonalityOption | null;
  mood: string;
  travelIntent: TravelIntentOption | '';
  customPreferences: PlanCustomPreferences;
}): boolean {
  if (!input.companion) return false;

  if (input.planType === 'AIに任せる') {
    return true;
  }

  if (showsMoodQuestion(input.planType)) {
    return Boolean(formatCombinedMood(input.mood, input.customPreferences.customMood));
  }

  if (showsTravelIntentQuestion(input.planType)) {
    return Boolean(
      formatCombinedTravelIntent(input.travelIntent, input.customPreferences.customTravelIntent),
    );
  }

  return Boolean(input.personality);
}

export function getGenerateHelperText(input: {
  planType: PlanCreationType;
  companion: CompanionOption | null;
  personality: PersonalityOption | null;
  mood: string;
  travelIntent: TravelIntentOption | '';
  customPreferences: PlanCustomPreferences;
}): string | null {
  if (canGeneratePlan(input)) return null;

  if (!input.companion) {
    if (showsMoodQuestion(input.planType)) {
      return '同行者・気分を選んでからプランを生成してください';
    }
    if (showsTravelIntentQuestion(input.planType)) {
      return '同行者・旅行の目的を選んでからプランを生成してください';
    }
    return '同行者を選んでからプランを生成してください';
  }

  if (showsMoodQuestion(input.planType)) {
    return '気分ボタンを選ぶか、「その他の気分を入力」に記入してください';
  }

  if (showsTravelIntentQuestion(input.planType)) {
    return '旅行の目的を選ぶか、「その他を入力」に記入してください';
  }

  if (input.planType === 'AIに任せる') {
    return '同行者を選んでからプランを生成してください';
  }

  return '旅行タイプを選んでからプランを生成してください';
}

export function buildPlanCreationPromptSection(input: {
  planType: PlanCreationType;
  mood: string;
  travelIntent: string;
  customPreferences?: PlanCustomPreferences;
}): string {
  const moodLabel = formatCombinedMood(input.mood, input.customPreferences?.customMood) || '未指定';
  const travelIntentLabel =
    formatCombinedTravelIntent(
      input.travelIntent as TravelIntentOption | '',
      input.customPreferences?.customTravelIntent,
    ) || '未指定';

  if (input.planType === '今日のお出かけ') {
    return `

## プラン種別: 今日のお出かけ（★最優先の設計方針★）
- **今日・近場**のお出かけプラン。移動は少なく、**今の気分**を最優先に設計する
- 優先順位: ①気分（${moodLabel}） ②現在地・エリア ③利用可能な時間 ④予算 ⑤同行者
- 食事中心にせず、散歩・景色・休憩・体験の**人間的なリズム**を入れる
- 「今日という1日の物語」として、感情的に満たされる流れにすること`;
  }

  if (input.planType === 'デートプラン') {
    return `

## プラン種別: デートプラン（★最優先の設計方針★）
- **カップル・デート**向け。レストランだけの日にしない
- 優先順位: ①気分（${moodLabel}） ②二人の時間・会話 ③ロマンチックな体験 ④予算 ⑤移動の少なさ
- 散歩・景色・写真・休憩・文化体験を挟み、**会話が自然に続く**流れに
- ランチ1・ディナー1・カフェ1程度に抑え、感情的に特別な1日にすること`;
  }

  if (input.planType === '旅行プラン' || input.planType === '週末プラン') {
    return `

## プラン種別: ${input.planType}（★最優先の設計方針★）
- **旅行プラン**。「今日の気分」ではなく**旅行の目的**（${travelIntentLabel}）を軸に設計する
- 優先順位: ①旅行の目的 ②目的地・エリア ③出発日〜帰宅日・期間 ④同行者 ⑤予算 ⑥行きたい場所 ⑦避けたいこと
- 日ごとにテーマを変え、観光・食事・休息・体験の**バランス**を取る
- 効率だけの詰め込みにせず、「旅のストーリー」として感情的に満たされる日程にすること`;
  }

  return `

## プラン種別: AIにおまかせ
- ユーザーは詳細を任せた。**場所・予算・同行者**からバランスの良いプランを自律的に設計する
- 近場の1日〜短期旅行のどちらも自然に。食事偏重を避け、人間的なリズムを入れる
- 感情的に満たされ、現実的に無理のない「物語のある1日（または旅）」にすること`;
}
