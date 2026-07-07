import type { PlanInput } from './prompts';
import { flattenItineraryDays, resolveDurationConfig } from './trip-duration';
import { getCurrency } from '@/constants/currency';
import { generateOutfitPackingAdvice } from './outfit-packing-advice';
import { DEV_FALLBACK_PLAN_NOTICE } from './openai-dev-fallback';
import { formatBudgetAmount, formatBudgetDisplay } from './format-budget';
import {
  formatMinutesAsTime,
  getEarliestActivityStartMinutes,
  getLatestActivityEndMinutes,
} from './itinerary-quality';
import type { BudgetBreakdown, ItineraryDay, ItineraryItem } from '@/types/plan';

export { DEV_FALLBACK_PLAN_NOTICE };

/** Small notice shown directly on the Plan Detail screen when isFallback is true. */
export const PLAN_DETAIL_FALLBACK_NOTICE =
  'AI接続が不安定だったため、開発用プランを表示しています';

type SpotTemplate = {
  activity: string;
  category: ItineraryItem['activityCategory'];
  note: string;
  costShare: number;
};

type DayTemplate = {
  theme: string;
  spots: SpotTemplate[];
};

const DAY_SPACING_MINUTES = 150;
const DEFAULT_DAY_START_MINUTES = 10 * 60; // 10:00
const DEFAULT_LAST_ITEM_END_BUFFER_MINUTES = 60;

function buildFallbackItem(
  timeMinutes: number,
  activity: string,
  category: ItineraryItem['activityCategory'],
  reason: string,
  estimatedCost: string,
  note: string,
): ItineraryItem {
  return {
    time: formatMinutesAsTime(timeMinutes),
    activity,
    activityCategory: category,
    placeCategory: category,
    reason,
    estimatedCost,
    note,
    transportation: '—',
    travelTimeToNext: '—',
    weatherBackup: '天候に関わらず楽しめます',
  };
}

function buildDefaultDayTemplates(location: string, purpose: string, dayCount: number): DayTemplate[] {
  const arrival: DayTemplate = {
    theme: `到着・${purpose}`,
    spots: [
      { activity: `${location}到着・チェックイン`, category: '移動', note: '到着後の移動・荷物整理', costShare: 0 },
      { activity: `${location}の名物料理ランチ`, category: '食事', note: '', costShare: 0.15 },
      { activity: `${location}の市場・商店街散策`, category: '散歩', note: '', costShare: 0.05 },
      { activity: `${location}の人気エリアでディナー`, category: '食事', note: '', costShare: 0.15 },
    ],
  };
  const middle: DayTemplate = {
    theme: 'カフェ・ローカルグルメ・夜景',
    spots: [
      { activity: `${location}のカフェ`, category: 'カフェ', note: '', costShare: 0.05 },
      { activity: `${location}のローカルグルメ`, category: '食事', note: '', costShare: 0.15 },
      { activity: `${location}の文化・体験スポット`, category: '文化', note: '', costShare: 0.1 },
      { activity: `${location}の夜景スポット`, category: '夜景', note: '', costShare: 0.05 },
    ],
  };
  const last: DayTemplate = {
    theme: 'お土産・軽めランチ・帰宅',
    spots: [
      { activity: `${location}のお土産・ショッピング`, category: '買い物', note: '', costShare: 0.1 },
      { activity: `${location}で軽めランチ`, category: '食事', note: '', costShare: 0.1 },
      { activity: 'ホテルチェックアウト・移動', category: '移動', note: '出発時刻に合わせて移動', costShare: 0 },
    ],
  };

  if (dayCount <= 1) return [{ ...arrival, spots: arrival.spots.slice(0, 3) }];
  if (dayCount === 2) return [arrival, last];

  const middles = Array.from({ length: dayCount - 2 }, () => middle);
  return [arrival, ...middles, last];
}

/** Evenly spaced start times for a day, honoring an optional earliest/latest bound. */
function buildDaySlotMinutes(params: {
  spotCount: number;
  isFirstDay: boolean;
  isLastDay: boolean;
  earliestStartMinutes: number | null;
  latestEndMinutes: number | null;
}): number[] {
  const { spotCount, isFirstDay, isLastDay, earliestStartMinutes, latestEndMinutes } = params;

  if (isLastDay && latestEndMinutes != null) {
    const lastItemStart = Math.max(
      8 * 60,
      latestEndMinutes - DEFAULT_LAST_ITEM_END_BUFFER_MINUTES,
    );
    const firstItemStart = Math.max(8 * 60, lastItemStart - (spotCount - 1) * DAY_SPACING_MINUTES);
    return Array.from({ length: spotCount }, (_, i) =>
      Math.min(lastItemStart, firstItemStart + i * DAY_SPACING_MINUTES),
    );
  }

  const startMinutes =
    isFirstDay && earliestStartMinutes != null ? earliestStartMinutes : DEFAULT_DAY_START_MINUTES;
  return Array.from({ length: spotCount }, (_, i) => startMinutes + i * DAY_SPACING_MINUTES);
}

function buildBudgetBreakdown(
  budgetAmount: number,
  symbol: string,
  dayCount: number,
): BudgetBreakdown {
  const base = budgetAmount > 0 ? budgetAmount : 100000;
  const accommodationShare = dayCount > 1 ? Math.round(base * 0.35) : 0;
  const foodShare = Math.round(base * 0.3);
  const transportShare = Math.round(base * 0.15);
  const activityShare = Math.round(base * 0.2);
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
  const companion = input.companion;
  const purpose =
    input.travelPurpose?.trim() ||
    input.customPreferences?.customTravelIntent?.trim() ||
    input.mood?.trim() ||
    'グルメ';
  const durationLabel = input.durationLabel ?? durationConfig.label;
  const title = `${location}${durationLabel}${purpose}旅行`;

  const dayCount = Math.max(1, durationConfig.dayCount);
  const templates = buildDefaultDayTemplates(location, purpose, dayCount);
  const timing = input.travelTiming;
  const earliestStartMinutes = getEarliestActivityStartMinutes(timing);
  const latestEndMinutes = getLatestActivityEndMinutes(timing);

  const budgetAmount = formatBudgetAmount(input.budget);
  const budgetDisplay = formatBudgetDisplay(budgetAmount, input.currency);

  const days: ItineraryDay[] = templates.map((template, index) => {
    const dayNumber = index + 1;
    const isFirstDay = index === 0;
    const isLastDay = index === templates.length - 1;
    const slots = buildDaySlotMinutes({
      spotCount: template.spots.length,
      isFirstDay,
      isLastDay,
      earliestStartMinutes,
      latestEndMinutes,
    });

    const items = template.spots.map((spot, spotIndex) =>
      buildFallbackItem(
        slots[spotIndex],
        spot.activity,
        spot.category,
        `${companion}との${purpose}に合うテスト用スポット（${location}）。UI確認用のサンプルです。`,
        spot.costShare > 0 ? `${symbol}${Math.round(budgetAmount * spot.costShare || 10000).toLocaleString()}` : `${symbol}0`,
        spot.note,
      ),
    );

    const timeWindow = `${formatMinutesAsTime(slots[0])}〜${formatMinutesAsTime(
      slots[slots.length - 1] + 60,
    )}`;

    return {
      dayNumber,
      label: `${dayNumber}日目`,
      theme: template.theme,
      timeWindow,
      items,
    };
  });

  const budgetBreakdown = buildBudgetBreakdown(budgetAmount, symbol, dayCount);
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

  const summary = `${location}${durationLabel}の${purpose}旅行プランです（${companion}・${people}人・予算${budgetDisplay}目安）。`;

  const tips = [
    `${location}では移動カードを事前準備すると便利です`,
    '人気店は事前予約または早めの時間帯がおすすめ',
    'テスト用プランのため、本番AI応答後は自動的に置き換わります',
  ];

  return {
    days,
    items: flattenItineraryDays(days),
    details: {
      plannerMessage: summary,
      planTitle: title,
      summary,
      isFallback: true,
      totalBudget: budgetDisplay,
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
        days.map((day) => `${day.label}: ${day.theme}`).join(' / '),
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
        budget: `予算 ${budgetDisplay}（${people}人）を目安にしています。`,
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
