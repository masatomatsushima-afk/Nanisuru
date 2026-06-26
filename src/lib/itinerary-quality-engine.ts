import type { BudgetScopeSettings } from '@/types/budget-scope';
import { BUDGET_BREAKDOWN_KEY_LABELS, BUDGET_SCOPE_META } from '@/types/budget-scope';
import type { CompanionOption, ItineraryDay, ItineraryItem, PlanDetails, WeatherForecast } from '@/types/plan';
import type { OutfitPackingAdvice, OutfitStyleMode } from '@/types/outfit-advice';
import type { PlanCreationType } from '@/types/plan-creation';
import type { TransportGuidanceContext } from '@/types/transport-guidance';
import type { TravelTimingSettings } from '@/types/travel-timing';

import {
  analyzeDayBalance,
  analyzeItineraryBalance,
  MAX_FOOD_RATIO,
  type ItineraryBalanceReport,
} from './itinerary-balance';
import {
  analyzeAreaDistribution,
  checkArrivalDepartureConstraints,
  countActivityCategories,
  findDuplicatePlaces,
  normalizePlaceName,
  parseTimeToMinutes,
  type DuplicatePlaceMatch,
} from './itinerary-quality';
import { getBreakdownKeysForScope } from './budget-scope';
import { recommendTransport } from './transport-guidance';

export const QUALITY_SCORE_THRESHOLD = 75;
export { MAX_FOOD_RATIO } from './itinerary-balance';
const LOG_PREFIX = '[Nanisuru QualityCheck]';

export type MovementWarning = {
  dayNumber: number;
  fromActivity: string;
  toActivity: string;
  issue: string;
  recommendedMode: string;
  recommendationText: string;
};

export type ItineraryQualityEngineReport = {
  score: number;
  isAcceptable: boolean;
  duplicatePlaces: DuplicatePlaceMatch[];
  foodRatio: number;
  dayFoodReports: Array<{ dayNumber: number; report: ItineraryBalanceReport }>;
  categoryCounts: Record<string, number>;
  movementWarnings: MovementWarning[];
  humanRhythmIssues: string[];
  areaIssues: string[];
  themeIssues: string[];
  arrivalDepartureWarnings: string[];
  budgetScopeWarnings: string[];
  outfitAdviceIssues: string[];
  varietyIssues: string[];
  failedDayNumbers: number[];
  issues: string[];
};

export type QualityCheckOptions = {
  days: ItineraryDay[];
  details: PlanDetails;
  dayCount: number;
  gourmetTour: boolean;
  travelTiming?: TravelTimingSettings | null;
  budgetScope?: BudgetScopeSettings;
  transportContext: TransportGuidanceContext;
  weather?: WeatherForecast;
  longTripThemesRequired?: boolean;
};

const INTENSE_CATEGORIES = new Set(['体験', '買い物', '文化']);
const LIGHT_CATEGORIES = new Set(['カフェ', '散歩', '休憩', '移動']);
const LONG_TRIP_THEME_GUIDES = [
  '到着・軽めの街歩き',
  '王道観光',
  '自然・絶景',
  '買い物・カフェ',
  'ツアー・現地体験',
  '帰国前の軽い予定',
];

function logQualityCheck(payload: Record<string, unknown>): void {
  if (__DEV__) {
    console.log(LOG_PREFIX, payload);
  }
}

function computeTripFoodRatio(days: ItineraryDay[]): number {
  let foodLike = 0;
  let total = 0;

  for (const day of days) {
    for (const item of day.items) {
      if (item.activityCategory === '移動') continue;
      total += 1;
      if (item.activityCategory === '食事' || item.activityCategory === 'カフェ') {
        foodLike += 1;
      }
    }
  }

  return total > 0 ? foodLike / total : 0;
}

function validateHumanRhythm(
  days: ItineraryDay[],
  travelTiming?: TravelTimingSettings | null,
): { issues: string[]; failedDayNumbers: number[] } {
  const issues: string[] = [];
  const failedDayNumbers = new Set<number>();
  const totalDays = days.length;

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex];
    const items = day.items.filter((item) => item.activityCategory !== '移動');
    if (items.length === 0) continue;

    const isFirstDay = dayIndex === 0;
    const isLastDay = dayIndex === totalDays - 1;
    const first = items[0];
    const last = items[items.length - 1];

    if (isFirstDay && travelTiming?.arrivalTime?.trim()) {
      const firstCategory = first.activityCategory ?? '';
      if (INTENSE_CATEGORIES.has(firstCategory)) {
        issues.push(`${day.label}: 到着日の最初がハードなアクティビティ（${firstCategory}）になっています`);
        failedDayNumbers.add(day.dayNumber);
      }
    } else if (isFirstDay && items.length >= 3) {
      const firstCategory = first.activityCategory ?? '';
      if (!LIGHT_CATEGORIES.has(firstCategory) && firstCategory !== '景色') {
        issues.push(`${day.label}: 1日目は軽めのスタート（カフェ・散歩・休憩）が理想です`);
        failedDayNumbers.add(day.dayNumber);
      }
    }

    if (isLastDay && last.activityCategory && INTENSE_CATEGORIES.has(last.activityCategory)) {
      issues.push(`${day.label}: 最終日の締めが負担の大きいアクティビティです`);
      failedDayNumbers.add(day.dayNumber);
    }

    let consecutiveIntense = 0;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const category = item.activityCategory ?? '';
      const isIntense = INTENSE_CATEGORIES.has(category) || category === '食事';

      if (isIntense) {
        consecutiveIntense += 1;
        if (consecutiveIntense >= 3) {
          issues.push(`${day.label}: 負担の大きい予定が3つ以上連続しています（バッファ・休憩を追加）`);
          failedDayNumbers.add(day.dayNumber);
          break;
        }
      } else if (category === '休憩' || category === '散歩') {
        consecutiveIntense = 0;
      }

      if (i < items.length - 1) {
        const next = items[i + 1];
        const fromMin = parseTimeToMinutes(item.time);
        const toMin = parseTimeToMinutes(next.time);
        if (fromMin != null && toMin != null && toMin - fromMin < 15 && isIntense) {
          issues.push(
            `${day.label}: 「${item.activity}」→「${next.activity}」の間隔が15分未満で、移動・休憩が不足しています`,
          );
          failedDayNumbers.add(day.dayNumber);
        }
      }
    }

    const hasRestOrBuffer = items.some(
      (item) =>
        item.activityCategory === '休憩' ||
        item.activityCategory === '散歩' ||
        /休憩|バッファ|余裕|ゆっくり/i.test(item.reason ?? ''),
    );
    if (items.length >= 5 && !hasRestOrBuffer) {
      issues.push(`${day.label}: 休憩・バッファ時間が不足しています`);
      failedDayNumbers.add(day.dayNumber);
    }
  }

  return { issues, failedDayNumbers: [...failedDayNumbers] };
}

function validateAreaLogic(days: ItineraryDay[]): string[] {
  const issues: string[] = [];
  const distribution = analyzeAreaDistribution(days);
  const dayAreaSets = days.map((day) => {
    const areas = distribution[day.dayNumber] ?? [];
    return new Set(areas.map((area) => normalizePlaceName(area)));
  });

  for (const day of days) {
    const areas = distribution[day.dayNumber] ?? [];
    if (areas.length >= 5) {
      issues.push(`${day.label}: 同日内のエリアが広すぎます（${areas.length}エリア）`);
    }
  }

  for (let i = 0; i < dayAreaSets.length; i += 1) {
    for (let j = i + 1; j < dayAreaSets.length; j += 1) {
      const overlap = [...dayAreaSets[i]].filter((area) => dayAreaSets[j].has(area));
      if (overlap.length >= 2 && days.length >= 3) {
        issues.push(
          `${days[i].label}と${days[j].label}で同じエリアが重複しています（日ごとにエリアを変えてください）`,
        );
      }
    }
  }

  return issues;
}

function validateLongTripThemes(days: ItineraryDay[], dayCount: number): string[] {
  if (dayCount <= 3) return [];

  const issues: string[] = [];
  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    if (!day.theme?.trim()) {
      issues.push(`${day.label}: 長期旅行では日ごとのテーマが必須です`);
      continue;
    }
    const suggested = LONG_TRIP_THEME_GUIDES[index] ?? LONG_TRIP_THEME_GUIDES.at(-1);
    if (suggested && day.theme.trim().length < 4) {
      issues.push(`${day.label}: テーマ「${day.theme}」が不明確です（例: ${suggested}）`);
    }
  }

  const themes = days.map((day) => normalizePlaceName(day.theme ?? ''));
  const unique = new Set(themes.filter(Boolean));
  if (unique.size < Math.min(days.length - 1, 3)) {
    issues.push('長期旅行で日ごとのテーマのバラエティが不足しています');
  }

  return issues;
}

function validateMovement(
  days: ItineraryDay[],
  context: TransportGuidanceContext,
): MovementWarning[] {
  const warnings: MovementWarning[] = [];
  const totalDays = days.length;

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex];
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

      const fromMinutes = parseTimeToMinutes(fromItem.time);
      const toMinutes = parseTimeToMinutes(toItem.time);
      const gapMinutes =
        fromMinutes != null && toMinutes != null ? toMinutes - fromMinutes : null;

      const transportMatch = fromItem.transportation?.match(/(\d+)\s*分/);
      const statedMinutes =
        recommendation.estimatedMinutes ??
        (transportMatch ? Number.parseInt(transportMatch[1], 10) : null);

      if (gapMinutes != null && gapMinutes > 0 && gapMinutes < 10 && statedMinutes != null && statedMinutes > 25) {
        warnings.push({
          dayNumber: day.dayNumber,
          fromActivity: fromItem.activity,
          toActivity: toItem.activity,
          issue: `移動${statedMinutes}分に対して予定間隔が${gapMinutes}分しかありません`,
          recommendedMode: recommendation.recommendedMode,
          recommendationText: recommendation.recommendationText,
        });
      }

      if (
        (statedMinutes != null && statedMinutes >= 35 && recommendation.recommendedMode === 'walking') ||
        (gapMinutes != null && gapMinutes >= 40 && !fromItem.transportation?.trim())
      ) {
        warnings.push({
          dayNumber: day.dayNumber,
          fromActivity: fromItem.activity,
          toActivity: toItem.activity,
          issue: '長距離移動なのに徒歩中心・交通情報不足です',
          recommendedMode: recommendation.recommendedMode,
          recommendationText: recommendation.recommendationText,
        });
      }

      if (/徒歩|walk/i.test(fromItem.transportation ?? '') && statedMinutes != null && statedMinutes >= 30) {
        warnings.push({
          dayNumber: day.dayNumber,
          fromActivity: fromItem.activity,
          toActivity: toItem.activity,
          issue: '30分以上の移動を徒歩のみで記載しています',
          recommendedMode: recommendation.recommendedMode,
          recommendationText: recommendation.recommendationText,
        });
      }
    }
  }

  return warnings;
}

function validateBudgetScope(
  details: PlanDetails,
  budgetScope?: BudgetScopeSettings,
): string[] {
  if (!budgetScope || !details.budgetBreakdown) return [];

  const issues: string[] = [];
  const breakdown = details.budgetBreakdown;
  const allowedKeys = new Set(getBreakdownKeysForScope(budgetScope));

  for (const [key, label] of Object.entries(BUDGET_BREAKDOWN_KEY_LABELS)) {
    const amount = breakdown[key as keyof typeof breakdown];
    if (typeof amount === 'string' && amount.trim() && !allowedKeys.has(key as keyof typeof BUDGET_BREAKDOWN_KEY_LABELS)) {
      issues.push(`予算内訳にスコープ外の「${label}」が含まれています`);
    }
  }

  if (budgetScope.flightsBooked && breakdown.flight?.trim()) {
    issues.push('飛行機は予約済みですが、内訳に飛行機代が含まれています');
  }

  if (budgetScope.hotelsBooked && breakdown.accommodation?.trim()) {
    issues.push('宿泊は予約済みですが、内訳に宿泊費が含まれています');
  }

  for (const item of budgetScope.includedItems) {
    const meta = BUDGET_SCOPE_META[item];
    const amount = breakdown[meta.breakdownKey];
    if (!amount?.trim() && !budgetScope.alreadyPaidItems.includes(item)) {
      issues.push(`予算スコープに含まれる「${item}」の内訳がありません`);
    }
  }

  return issues;
}

function validateOutfitConsistency(
  advice: OutfitPackingAdvice | undefined,
  days: ItineraryDay[],
  weather?: WeatherForecast,
): string[] {
  if (!advice) return ['服装アドバイスが生成されていません'];

  const issues: string[] = [];
  const text = [
    ...advice.outfit,
    ...advice.footwear,
    ...advice.items,
    ...advice.cautions,
    ...(advice.dateOutfitTips ?? []),
    ...(advice.travelPackingAdvice ?? []),
  ]
    .join(' ')
    .toLowerCase();

  const hasRain =
    weather?.hasRainExpected ||
    weather?.days.some((day) => day.category === 'rainy' || day.precipitationProbability >= 45);
  const hasCold = weather?.days.some((day) => day.temperatureMin <= 8);
  const hasWind = weather?.days.some((day) => /風|wind/i.test(day.condition));
  const hasOutdoor = days.some((day) =>
    day.items.some((item) => ['散歩', '景色', '体験'].includes(item.activityCategory ?? '')),
  );

  if (hasRain && !/雨|傘|レイン|防水|ウインド/i.test(text)) {
    issues.push('雨の予報があるのに、服装アドバイスに雨対策が含まれていません');
  }
  if (hasCold && !/寒|温|レイヤ|コート|ダウン|上着|防寒/i.test(text)) {
    issues.push('低温の予報があるのに、防寒アドバイスが不足しています');
  }
  if (hasWind && !/風|ウィンド|羽織/i.test(text)) {
    issues.push('風の予報があるのに、風対策のアドバイスが不足しています');
  }
  if (hasOutdoor && advice.footwear.length === 0) {
    issues.push('屋外アクティビティがあるのに、靴のアドバイスがありません');
  }
  if (advice.outfit.length === 0) {
    issues.push('服装の具体的提案がありません');
  }

  return issues;
}

function validateCategoryVariety(
  categoryCounts: Record<string, number>,
  dayCount: number,
  gourmetTour: boolean,
): string[] {
  if (gourmetTour || dayCount <= 1) return [];

  const nonFood = ['散歩', '体験', '景色', '文化', '買い物', '休憩', '夜景'];
  const present = nonFood.filter((cat) => (categoryCounts[cat] ?? 0) > 0);

  if (present.length < 3) {
    return ['カテゴリのバラエティが不足しています（散歩・体験・景色・文化・買い物などを追加）'];
  }

  return [];
}

function computeQualityScore(input: {
  duplicateCount: number;
  foodRatio: number;
  gourmetTour: boolean;
  dayFoodIssues: number;
  humanRhythmCount: number;
  arrivalDepartureCount: number;
  movementCount: number;
  themeCount: number;
  areaCount: number;
  budgetCount: number;
  outfitCount: number;
  varietyCount: number;
  balanceIssueCount: number;
}): number {
  let score = 100;

  score -= Math.min(input.duplicateCount * 15, 30);
  if (!input.gourmetTour && input.foodRatio > MAX_FOOD_RATIO) {
    score -= Math.round((input.foodRatio - MAX_FOOD_RATIO) * 100);
  }
  score -= input.dayFoodIssues * 5;
  score -= Math.min(input.humanRhythmCount * 4, 16);
  score -= input.arrivalDepartureCount * 8;
  score -= Math.min(input.movementCount * 3, 15);
  score -= input.themeCount * 4;
  score -= input.areaCount * 3;
  score -= input.budgetCount * 4;
  score -= input.outfitCount * 4;
  score -= input.varietyCount * 8;
  score -= Math.min(input.balanceIssueCount * 3, 12);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function runItineraryQualityCheck(options: QualityCheckOptions): ItineraryQualityEngineReport {
  const { days, details, dayCount, gourmetTour } = options;

  const duplicatePlaces = findDuplicatePlaces(days);
  const categoryCounts = countActivityCategories(days);
  const foodRatio = computeTripFoodRatio(days);
  const balanceReport = analyzeItineraryBalance(days);
  const dayFoodReports = days.map((day) => ({
    dayNumber: day.dayNumber,
    report: analyzeDayBalance(day.items),
  }));

  const arrivalDepartureWarnings = checkArrivalDepartureConstraints(days, options.travelTiming);
  const { issues: humanRhythmIssues, failedDayNumbers: rhythmFailedDays } = validateHumanRhythm(
    days,
    options.travelTiming,
  );
  const areaIssues = validateAreaLogic(days);
  const themeIssues = [
    ...validateLongTripThemes(days, dayCount),
    ...(dayCount >= 2
      ? days
          .filter((day) => !day.theme?.trim())
          .map((day) => `${day.label}にテーマが設定されていません`)
      : []),
  ];
  const movementWarnings = validateMovement(days, options.transportContext);
  const budgetScopeWarnings = validateBudgetScope(details, options.budgetScope);
  const outfitAdviceIssues = validateOutfitConsistency(
    details.outfitAdvice,
    days,
    options.weather ?? details.weather,
  );
  const varietyIssues = validateCategoryVariety(categoryCounts, dayCount, gourmetTour);

  const dayFoodIssueCount = dayFoodReports.reduce(
    (sum, entry) => sum + entry.report.issues.length,
    0,
  );

  const issues = [
    ...duplicatePlaces.map(
      (dup) =>
        `重複スポット: Day ${dup.dayNumber}「${dup.activity}」≈ Day ${dup.duplicateDayNumber}「${dup.duplicateOf}」`,
    ),
    ...(!gourmetTour && foodRatio > MAX_FOOD_RATIO
      ? [`食事・カフェ比率が${Math.round(foodRatio * 100)}%です（${Math.round(MAX_FOOD_RATIO * 100)}%以下が理想）`]
      : []),
    ...(gourmetTour ? [] : balanceReport.issues),
    ...dayFoodReports.flatMap((entry) =>
      entry.report.issues.map((issue) => `Day ${entry.dayNumber}: ${issue}`),
    ),
    ...humanRhythmIssues,
    ...areaIssues,
    ...themeIssues,
    ...arrivalDepartureWarnings,
    ...movementWarnings.map(
      (w) => `移動: Day ${w.dayNumber}「${w.fromActivity}」→「${w.toActivity}」— ${w.issue}`,
    ),
    ...budgetScopeWarnings,
    ...outfitAdviceIssues,
    ...varietyIssues,
  ];

  const failedDayNumbers = [
    ...new Set([
      ...rhythmFailedDays,
      ...duplicatePlaces.map((d) => d.dayNumber),
      ...movementWarnings.map((w) => w.dayNumber),
      ...dayFoodReports.filter((e) => e.report.isTooFoodHeavy).map((e) => e.dayNumber),
    ]),
  ].sort((a, b) => a - b);

  const score = computeQualityScore({
    duplicateCount: duplicatePlaces.length,
    foodRatio,
    gourmetTour,
    dayFoodIssues: dayFoodIssueCount,
    humanRhythmCount: humanRhythmIssues.length,
    arrivalDepartureCount: arrivalDepartureWarnings.length,
    movementCount: movementWarnings.length,
    themeCount: themeIssues.length,
    areaCount: areaIssues.length,
    budgetCount: budgetScopeWarnings.length,
    outfitCount: outfitAdviceIssues.length,
    varietyCount: varietyIssues.length,
    balanceIssueCount: balanceReport.issues.length,
  });

  const report: ItineraryQualityEngineReport = {
    score,
    isAcceptable: score >= QUALITY_SCORE_THRESHOLD,
    duplicatePlaces,
    foodRatio,
    dayFoodReports,
    categoryCounts,
    movementWarnings,
    humanRhythmIssues,
    areaIssues,
    themeIssues,
    arrivalDepartureWarnings,
    budgetScopeWarnings,
    outfitAdviceIssues,
    varietyIssues,
    failedDayNumbers,
    issues,
  };

  logQualityCheck({
    duplicatePlaces: report.duplicatePlaces,
    foodRatio: report.foodRatio,
    categoryCounts: report.categoryCounts,
    movementWarnings: report.movementWarnings,
    arrivalDepartureWarnings: report.arrivalDepartureWarnings,
    budgetScopeWarnings: report.budgetScopeWarnings,
    humanRhythmIssues: report.humanRhythmIssues,
    themeIssues: report.themeIssues,
    outfitAdviceIssues: report.outfitAdviceIssues,
    finalQualityScore: report.score,
    isAcceptable: report.isAcceptable,
    failedDayNumbers: report.failedDayNumbers,
  });

  return report;
}

export function buildQualityImprovementInstruction(
  report: ItineraryQualityEngineReport,
  options?: { targetDayNumbers?: number[] },
): string {
  const targetDays = options?.targetDayNumbers?.length
    ? options.targetDayNumbers
    : report.failedDayNumbers;

  const dayHint =
    targetDays.length > 0
      ? `\n\n**修正対象の日**: Day ${targetDays.join(', Day ')} のみ。他の日は維持してください。`
      : '';

  return `
## 行程品質改善（部分修正 · 必須）
品質スコア: ${report.score}/100（目標 ${QUALITY_SCORE_THRESHOLD} 以上）

${report.issues.map((issue) => `- ${issue}`).join('\n')}

修正方針:
- 同じスポットの重複を完全に排除し、別の実在スポットに差し替え
- 食事・カフェは全体の40%以下、各日ランチ1・ディナー1・カフェ1まで
- 散歩・景色・体験・文化・買い物・休憩を追加し、人間が無理なく回れるリズムに
- 1日目は到着・チェックイン後の軽いスタート、最終日は出発に間に合う柔らかい締め
- 長距離移動は電車・バス・タクシーを transportation に明記
- 各 day の theme を日本語で明確に（長期旅行は日ごとに異なるテーマ）
- 同日内は近いエリア、日をまたぐとエリアを変える
${dayHint}
`.trim();
}

export type { DuplicatePlaceMatch, ItineraryBalanceReport };
