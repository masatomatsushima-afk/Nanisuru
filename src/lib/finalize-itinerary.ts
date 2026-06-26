import type { BudgetScopeSettings } from '@/types/budget-scope';
import { BUDGET_BREAKDOWN_KEY_LABELS } from '@/types/budget-scope';
import type { CompanionOption, ItineraryDay, PlanDetails } from '@/types/plan';
import type { OutfitStyleMode } from '@/types/outfit-advice';
import type { PlanCreationType } from '@/types/plan-creation';
import type { NearbyPlacesContext } from '@/types/nearby-places';
import type { TransportGuidanceContext } from '@/types/transport-guidance';
import type { WeatherForecast } from '@/types/plan';

import { getBreakdownKeysForScope } from './budget-scope';
import {
  buildQualityImprovementInstruction,
  QUALITY_SCORE_THRESHOLD,
  runItineraryQualityCheck,
  type ItineraryQualityEngineReport,
} from './itinerary-quality-engine';
import {
  dedupeItineraryPlaces,
  findDuplicatePlaces,
  formatMinutesAsTime,
  getEarliestActivityStartMinutes,
  getLatestActivityEndMinutes,
  parseTimeToMinutes,
} from './itinerary-quality';
import { generateOutfitPackingAdvice } from './outfit-packing-advice';
import { logPlanGenerationStep } from './plan-generation-log';
import { recommendTransport } from './transport-guidance';

export type FinalizablePlan = {
  days: ItineraryDay[];
  details: PlanDetails;
};

export type FinalItineraryValidationReport = ItineraryQualityEngineReport & {
  fixesApplied: string[];
};

const THEME_BY_DAY_INDEX = [
  '到着・軽めの街歩き',
  '王道観光',
  '自然・絶景',
  '買い物・カフェ',
  'ツアー・現地体験',
  '帰国前の軽い予定',
];

function shiftDayItemTimes(day: ItineraryDay, deltaMinutes: number): ItineraryDay {
  if (deltaMinutes === 0) return day;

  return {
    ...day,
    items: day.items.map((item) => {
      const minutes = parseTimeToMinutes(item.time);
      if (minutes == null) return item;
      return {
        ...item,
        time: formatMinutesAsTime(minutes + deltaMinutes),
      };
    }),
  };
}

export function applyArrivalDepartureTimeFixes(
  days: ItineraryDay[],
  travelTiming?: TransportGuidanceContext['travelTiming'],
): { days: ItineraryDay[]; fixes: string[] } {
  if (days.length === 0 || !travelTiming) return { days, fixes: [] };

  const fixes: string[] = [];
  let nextDays = days.map((day) => ({
    ...day,
    items: day.items.map((item) => ({ ...item })),
  }));

  const earliest = getEarliestActivityStartMinutes(travelTiming);
  const firstDay = nextDays[0];
  const firstItem = firstDay.items.find((item) => item.activityCategory !== '移動');
  const firstTime = firstItem ? parseTimeToMinutes(firstItem.time) : null;

  if (earliest != null && firstTime != null && firstTime < earliest) {
    const delta = earliest - firstTime;
    nextDays[0] = shiftDayItemTimes(firstDay, delta);
    fixes.push(
      `1日目を到着後（${formatMinutesAsTime(earliest)}）に合わせて${delta}分シフトしました`,
    );
  }

  const latest = getLatestActivityEndMinutes(travelTiming);
  const lastDay = nextDays[nextDays.length - 1];
  const lastItem = [...lastDay.items].reverse().find((item) => item.activityCategory !== '移動');
  const lastTime = lastItem ? parseTimeToMinutes(lastItem.time) : null;

  if (latest != null && lastTime != null && lastTime > latest) {
    const delta = latest - lastTime;
    nextDays[nextDays.length - 1] = shiftDayItemTimes(lastDay, delta);
    fixes.push(
      `最終日を出発前（${formatMinutesAsTime(latest)}）に合わせて${delta}分シフトしました`,
    );
  }

  return { days: nextDays, fixes };
}

export function applyDefaultDayThemes(
  days: ItineraryDay[],
  dayCount: number,
): { days: ItineraryDay[]; fixes: string[] } {
  if (dayCount <= 1) return { days, fixes: [] };

  const fixes: string[] = [];
  const nextDays = days.map((day, index) => {
    if (day.theme?.trim()) return day;
    const theme = THEME_BY_DAY_INDEX[index] ?? `Day ${day.dayNumber} の探索`;
    fixes.push(`${day.label}にテーマ「${theme}」を補完しました`);
    return { ...day, theme };
  });

  return { days: nextDays, fixes };
}

export function enrichTransportHints(
  days: ItineraryDay[],
  context: TransportGuidanceContext,
): { days: ItineraryDay[]; fixes: string[] } {
  const fixes: string[] = [];
  const totalDays = days.length;

  const nextDays = days.map((day) => ({
    ...day,
    items: day.items.map((item) => ({ ...item })),
  }));

  for (let dayIndex = 0; dayIndex < nextDays.length; dayIndex += 1) {
    const day = nextDays[dayIndex];
    const activityItems = day.items.filter((item) => item.activityCategory !== '移動');

    for (let index = 0; index < activityItems.length - 1; index += 1) {
      const fromItem = activityItems[index];
      const toItem = activityItems[index + 1];
      const recommendation = recommendTransport({
        fromItem,
        toItem,
        context,
        dayIndex,
        totalDays,
        itemIndex: index,
      });

      const dayItemIndex = day.items.indexOf(fromItem);
      if (dayItemIndex < 0) continue;

      const needsHint =
        !fromItem.transportation?.trim() ||
        (recommendation.estimatedMinutes != null &&
          recommendation.estimatedMinutes >= 25 &&
          /徒歩/i.test(fromItem.transportation ?? ''));

      if (!needsHint) continue;

      const minutesLabel =
        recommendation.estimatedMinutes != null
          ? `約${recommendation.estimatedMinutes}分 · `
          : '';

      day.items[dayItemIndex] = {
        ...fromItem,
        transportation: `${minutesLabel}${recommendation.recommendationText}`,
        travelTimeToNext:
          fromItem.travelTimeToNext ??
          (recommendation.estimatedMinutes != null
            ? `約${recommendation.estimatedMinutes}分`
            : undefined),
      };

      fixes.push(
        `Day ${day.dayNumber}「${fromItem.activity}」→「${toItem.activity}」の移動を補完（${recommendation.recommendedMode}）`,
      );
    }
  }

  return { days: nextDays, fixes };
}

export function alignBudgetBreakdownToScope(
  details: PlanDetails,
  budgetScope?: BudgetScopeSettings,
): { details: PlanDetails; fixes: string[] } {
  if (!budgetScope?.includedItems.length || !details.budgetBreakdown) {
    return { details, fixes: [] };
  }

  const fixes: string[] = [];
  const allowedKeys = new Set(getBreakdownKeysForScope(budgetScope));
  const breakdown = { ...details.budgetBreakdown };

  for (const key of Object.keys(BUDGET_BREAKDOWN_KEY_LABELS) as Array<
    keyof typeof BUDGET_BREAKDOWN_KEY_LABELS
  >) {
    if (allowedKeys.has(key)) continue;
    const value = breakdown[key as keyof typeof breakdown];
    if (typeof value === 'string' && value.trim()) {
      delete (breakdown as Record<string, unknown>)[key];
      fixes.push(`予算内訳からスコープ外の「${BUDGET_BREAKDOWN_KEY_LABELS[key]}」を除外しました`);
    }
  }

  if (budgetScope.flightsBooked && breakdown.flight?.trim()) {
    delete breakdown.flight;
    fixes.push('予約済みの飛行機代を予算内訳から除外しました');
  }

  if (budgetScope.hotelsBooked && breakdown.accommodation?.trim()) {
    delete breakdown.accommodation;
    fixes.push('予約済みの宿泊費を予算内訳から除外しました');
  }

  return {
    details: { ...details, budgetBreakdown: breakdown },
    fixes,
  };
}

function applyLocalFixes(
  plan: FinalizablePlan,
  options: FinalizeItineraryOptions,
): { plan: FinalizablePlan; fixesApplied: string[] } {
  let nextPlan = plan;
  const fixesApplied: string[] = [];

  const deduped = dedupeItineraryPlaces(nextPlan.days, options.realPlaces?.places ?? []);
  if (deduped.replacedCount > 0) {
    nextPlan = { ...nextPlan, days: deduped.days };
    fixesApplied.push(`重複スポット${deduped.replacedCount}件を別スポットに差し替え`);
  }

  const arrivalFix = applyArrivalDepartureTimeFixes(nextPlan.days, options.travelTiming);
  if (arrivalFix.fixes.length > 0) {
    nextPlan = { ...nextPlan, days: arrivalFix.days };
    fixesApplied.push(...arrivalFix.fixes);
  }

  const themeFix = applyDefaultDayThemes(nextPlan.days, options.dayCount);
  if (themeFix.fixes.length > 0) {
    nextPlan = { ...nextPlan, days: themeFix.days };
    fixesApplied.push(...themeFix.fixes);
  }

  const transportFix = enrichTransportHints(nextPlan.days, options.transportContext);
  if (transportFix.fixes.length > 0) {
    nextPlan = { ...nextPlan, days: transportFix.days };
    fixesApplied.push(...transportFix.fixes);
  }

  const budgetFix = alignBudgetBreakdownToScope(nextPlan.details, options.budgetScope);
  if (budgetFix.fixes.length > 0) {
    nextPlan = { ...nextPlan, details: budgetFix.details };
    fixesApplied.push(...budgetFix.fixes);
  }

  return { plan: nextPlan, fixesApplied };
}

function runQualityCheck(
  plan: FinalizablePlan,
  options: FinalizeItineraryOptions,
): ItineraryQualityEngineReport {
  return runItineraryQualityCheck({
    days: plan.days,
    details: plan.details,
    dayCount: options.dayCount,
    gourmetTour: options.gourmetTour,
    travelTiming: options.travelTiming,
    budgetScope: options.budgetScope,
    transportContext: options.transportContext,
    weather: options.weather ?? plan.details.weather,
  });
}

function ensureOutfitAdvice(
  plan: FinalizablePlan,
  options: FinalizeItineraryOptions,
  report: ItineraryQualityEngineReport,
): { plan: FinalizablePlan; fixes: string[] } {
  if (report.outfitAdviceIssues.length === 0) return { plan, fixes: [] };

  const styleMode =
    options.outfitStyleMode === 'AIに任せる' &&
    report.outfitAdviceIssues.some((issue) => issue.includes('雨'))
      ? '雨対策重視'
      : options.outfitStyleMode;

  const outfitAdvice = generateOutfitPackingAdvice({
    days: plan.days,
    weather: plan.details.weather ?? options.weather,
    location: options.location,
    planType: options.planCreationType,
    companion: options.companion ?? '一人',
    outfitStyleMode: styleMode,
    dayCount: options.dayCount,
    tripDate: options.tripDate,
  });

  return {
    plan: {
      ...plan,
      details: { ...plan.details, outfitAdvice },
    },
    fixes: ['服装・持ち物アドバイスを天気・行程に合わせて再生成しました'],
  };
}

export type FinalizeItineraryOptions = {
  plan: FinalizablePlan;
  realPlaces?: NearbyPlacesContext;
  travelTiming?: TransportGuidanceContext['travelTiming'];
  dayCount: number;
  gourmetTour: boolean;
  budgetScope?: BudgetScopeSettings;
  location: string;
  companion?: CompanionOption;
  outfitStyleMode?: OutfitStyleMode;
  planCreationType?: PlanCreationType;
  tripDate?: string;
  weather?: WeatherForecast;
  transportContext: TransportGuidanceContext;
  allowAiPartialFix?: boolean;
  onPartialRegenerate?: (
    instruction: string,
    basePlan: FinalizablePlan,
  ) => Promise<FinalizablePlan>;
  onRegenerateDays?: (
    dayNumbers: number[],
    instruction: string,
    basePlan: FinalizablePlan,
  ) => Promise<FinalizablePlan>;
};

export async function finalizeItineraryBeforeDisplay(
  options: FinalizeItineraryOptions,
): Promise<{ plan: FinalizablePlan; report: FinalItineraryValidationReport }> {
  let plan = options.plan;
  const allFixes: string[] = [];

  const initialFix = applyLocalFixes(plan, options);
  plan = initialFix.plan;
  allFixes.push(...initialFix.fixesApplied);

  let report = runQualityCheck(plan, options);

  const tryImprove = async (attempt: 'partial' | 'days') => {
    if (report.isAcceptable || !options.onPartialRegenerate) return;

    const previousFailedDays = report.failedDayNumbers;

    if (attempt === 'days' && options.onRegenerateDays && previousFailedDays.length > 0) {
      const instruction = buildQualityImprovementInstruction(report, {
        targetDayNumbers: previousFailedDays,
      });
      logPlanGenerationStep('quality_regen_days', {
        score: report.score,
        days: previousFailedDays,
      });
      plan = await options.onRegenerateDays(previousFailedDays, instruction, plan);
    } else {
      const instruction = buildQualityImprovementInstruction(report);
      logPlanGenerationStep('quality_regen_partial', {
        score: report.score,
        issueCount: report.issues.length,
      });
      plan = await options.onPartialRegenerate(instruction, plan);
    }

    const regenFix = applyLocalFixes(plan, options);
    plan = regenFix.plan;
    allFixes.push(...regenFix.fixesApplied);
    allFixes.push(
      attempt === 'days'
        ? `問題のある Day ${previousFailedDays.join(', ')} を部分再生成しました`
        : '品質スコア改善のため部分再生成しました',
    );
    report = runQualityCheck(plan, options);
  };

  if (
    options.allowAiPartialFix !== false &&
    !report.isAcceptable &&
    options.onPartialRegenerate
  ) {
    await tryImprove('partial');

    if (!report.isAcceptable && options.onRegenerateDays && report.failedDayNumbers.length > 0) {
      await tryImprove('days');
    }
  }

  const outfitFix = ensureOutfitAdvice(plan, options, report);
  if (outfitFix.fixes.length > 0) {
    plan = outfitFix.plan;
    allFixes.push(...outfitFix.fixes);
    report = runQualityCheck(plan, options);
  }

  if (allFixes.length > 0) {
    logPlanGenerationStep('quality_fixes_applied', { fixesApplied: allFixes });
  }

  if (!report.isAcceptable) {
    logPlanGenerationStep('quality_below_threshold', {
      score: report.score,
      threshold: QUALITY_SCORE_THRESHOLD,
      issues: report.issues,
    });
  }

  return {
    plan,
    report: { ...report, fixesApplied: allFixes },
  };
}

export { findDuplicatePlaces, QUALITY_SCORE_THRESHOLD };
