import type { PlanInput } from './prompts';
import { flattenItineraryDays, resolveDurationConfig } from './trip-duration';
import { getCurrency } from '@/constants/currency';
import { generateOutfitPackingAdvice } from './outfit-packing-advice';
import { DEV_FALLBACK_PLAN_NOTICE } from './openai-dev-fallback';
import type { BudgetBreakdown, ItineraryDay, ItineraryItem } from '@/types/plan';

export { DEV_FALLBACK_PLAN_NOTICE };

type DayTemplate = {
  theme: string;
  spots: Array<{ time: string; activity: string; category: ItineraryItem['activityCategory'] }>;
};

function buildFallbackItem(
  time: string,
  activity: string,
  category: ItineraryItem['activityCategory'],
  reason: string,
  estimatedCost: string,
): ItineraryItem {
  return {
    time,
    activity,
    activityCategory: category,
    placeCategory: category,
    reason,
    estimatedCost,
    transportation: '—',
    travelTimeToNext: '—',
    weatherBackup: '天候に関わらず楽しめます',
  };
}

function buildDefaultDayTemplates(location: string, purpose: string): DayTemplate[] {
  return [
    {
      theme: `到着・${purpose}`,
      spots: [
        { time: '11:00', activity: `${location}到着・チェックイン`, category: '移動' },
        { time: '13:00', activity: `${location}の名物料理ランチ`, category: '食事' },
        { time: '15:30', activity: `${location}の市場・商店街散策`, category: '散歩' },
        { time: '19:00', activity: `${location}の人気エリアでディナー`, category: '食事' },
      ],
    },
    {
      theme: 'カフェ・ローカルグルメ・夜景',
      spots: [
        { time: '10:00', activity: `${location}のカフェ`, category: 'カフェ' },
        { time: '12:30', activity: `${location}のローカルグルメ`, category: '食事' },
        { time: '16:00', activity: `${location}の文化・体験スポット`, category: '文化' },
        { time: '19:30', activity: `${location}の夜景スポット`, category: '夜景' },
      ],
    },
    {
      theme: 'お土産・軽めランチ・帰宅',
      spots: [
        { time: '10:00', activity: `${location}のお土産・ショッピング`, category: '買い物' },
        { time: '12:00', activity: `${location}で軽めランチ`, category: '食事' },
        { time: '14:00', activity: 'ホテルチェックアウト・移動', category: '移動' },
      ],
    },
  ];
}

function buildBudgetBreakdown(
  budget: string,
  currency: string,
  symbol: string,
  dayCount: number,
): BudgetBreakdown {
  const numeric = Number.parseInt(budget.replace(/[^\d]/g, ''), 10);
  const hasNumericBudget = Number.isFinite(numeric) && numeric > 0;
  const accommodationShare = dayCount > 1 ? Math.round((hasNumericBudget ? numeric : 100000) * 0.35) : 0;
  const foodShare = Math.round((hasNumericBudget ? numeric : 100000) * 0.3);
  const transportShare = Math.round((hasNumericBudget ? numeric : 100000) * 0.15);
  const activityShare = Math.round((hasNumericBudget ? numeric : 100000) * 0.2);
  const total = accommodationShare + foodShare + transportShare + activityShare;

  return {
    total: `${symbol}${total.toLocaleString()}（目安）`,
    accommodation: dayCount > 1 ? `${symbol}${accommodationShare.toLocaleString()}` : `${symbol}0（不要）`,
    food: `${symbol}${foodShare.toLocaleString()}`,
    transportation: `${symbol}${transportShare.toLocaleString()}`,
    activity: `${symbol}${activityShare.toLocaleString()}`,
  };
}

/** Safe sample plan for dev when OpenAI times out after retries. */
export function buildDevFallbackTravelPlan(input: PlanInput) {
  const location = input.location.trim() || '韓国';
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const { symbol } = getCurrency(input.currency);
  const people = input.people.trim() || '2';
  const budget = input.budget.trim() || '80000';
  const companion = input.companion;
  const purpose =
    input.travelPurpose?.trim() ||
    input.customPreferences?.customTravelIntent?.trim() ||
    input.mood?.trim() ||
    'グルメ';
  const durationLabel = input.durationLabel ?? durationConfig.label;
  const title = `${location}${durationLabel}・${companion}・${purpose}向けのテストプラン`;

  const templates = buildDefaultDayTemplates(location, purpose);
  const dayCount = Math.max(1, durationConfig.dayCount);

  const days: ItineraryDay[] = Array.from({ length: dayCount }, (_, index) => {
    const template = templates[index] ?? templates[templates.length - 1];
    const dayNumber = index + 1;
    return {
      dayNumber,
      label: `${dayNumber}日目`,
      theme: template.theme,
      items: template.spots.map((spot) =>
        buildFallbackItem(
          spot.time,
          spot.activity,
          spot.category,
          `${companion}との${purpose}に合うテスト用スポット（${location}）。UI確認用のサンプルです。`,
          `${symbol}—`,
        ),
      ),
    };
  });

  const budgetBreakdown = buildBudgetBreakdown(budget, input.currency, symbol, dayCount);
  const weatherOrSeasonNote =
    input.weather?.summary?.trim() ||
    input.weather?.seasonalContext?.guidance ||
    `${location}の季節に合わせ、屋内・屋外をバランスよく組んでいます（テスト用）。`;

  const outfitAdvice = generateOutfitPackingAdvice({
    days,
    weather: input.weather,
    location,
    planType: input.planCreationType ?? input.planType,
    companion: input.companion,
    outfitStyleMode: input.outfitStyleMode,
    dayCount,
    tripDate: input.tripDate,
  });

  const tips = [
    `${location}では移動カードを事前準備すると便利です`,
    '人気店は事前予約または早めの時間帯がおすすめ',
    'テスト用プランのため、本番AI応答後は自動的に置き換わります',
  ];

  return {
    days,
    items: flattenItineraryDays(days),
    details: {
      plannerMessage: `${title}\n${DEV_FALLBACK_PLAN_NOTICE}`,
      totalBudget: budgetBreakdown.total,
      budgetBreakdown,
      duration: durationLabel,
      tripDuration: input.tripDuration,
      tripDate: input.tripDate,
      tripEndDate: input.tripEndDate,
      customDuration: input.customDuration,
      weather: input.weather,
      outfitAdvice,
      highlights: [
        title,
        `Day 1: 到着・${purpose} / Day 2: カフェ・ローカルグルメ・夜景 / Day 3: お土産・帰宅`,
        ...tips.slice(0, 2),
      ],
      rainyDayAlternatives: [
        `${location}の屋内カフェ`,
        `${location}のショッピングモール`,
        `${location}の美術館・ギャラリー`,
      ],
      conciergeAnalysis: {
        userPreferences: `${companion}・${purpose}向けのテスト用プランです。`,
        weather: weatherOrSeasonNote,
        budget: `予算 ${budget} ${input.currency}（${people}人）を目安にしています。`,
        tripDuration: durationLabel,
        travelStyle: input.personality,
        overallStrategy: '開発環境向けのフォールバック行程です。UI確認用に日別の流れを用意しています。',
      },
    },
    devFallbackNotice: DEV_FALLBACK_PLAN_NOTICE,
  };
}

export function parseDevFallbackTravelPlanFromApiResponse(
  data: unknown,
  input: PlanInput,
): ReturnType<typeof buildDevFallbackTravelPlan> | null {
  if (
    !data ||
    typeof data !== 'object' ||
    (data as { nanisuru_dev_fallback?: boolean }).nanisuru_dev_fallback !== true
  ) {
    return null;
  }

  const notice =
    typeof (data as { devFallbackNotice?: unknown }).devFallbackNotice === 'string'
      ? (data as { devFallbackNotice: string }).devFallbackNotice
      : DEV_FALLBACK_PLAN_NOTICE;

  return {
    ...buildDevFallbackTravelPlan(input),
    devFallbackNotice: notice,
  };
}
