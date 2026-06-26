import type { NearbyPlace } from '@/types/nearby-places';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { TravelTimingPlaceType, TravelTimingSettings } from '@/types/travel-timing';

import { analyzeItineraryBalance, isGourmetTourIntent } from './itinerary-balance';
import { logPlanGenerationStep } from './plan-generation-log';

export function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(the|a|an|de|la|le|les|du|des)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizePlaceName(name: string): string[] {
  return normalizePlaceName(name)
    .split(' ')
    .filter((token) => token.length > 2);
}

export function areLikelyDuplicatePlaces(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return false;

  const normalizedA = normalizePlaceName(left);
  const normalizedB = normalizePlaceName(right);
  if (normalizedA === normalizedB) return true;

  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    const shorter = normalizedA.length <= normalizedB.length ? normalizedA : normalizedB;
    if (shorter.length >= 5) return true;
  }

  const tokensA = tokenizePlaceName(left);
  const tokensB = tokenizePlaceName(right);
  const overlap = tokensA.filter((token) => tokensB.includes(token));
  if (overlap.length >= 2) return true;

  const significantOverlap = overlap.filter((token) => token.length >= 5);
  if (significantOverlap.length >= 1) return true;

  return false;
}

export type DuplicatePlaceMatch = {
  activity: string;
  dayNumber: number;
  duplicateOf: string;
  duplicateDayNumber: number;
};

export function findDuplicatePlaces(days: ItineraryDay[]): DuplicatePlaceMatch[] {
  const seen: Array<{ activity: string; dayNumber: number }> = [];
  const duplicates: DuplicatePlaceMatch[] = [];

  for (const day of days) {
    for (const item of day.items) {
      const activity = item.activity.trim();
      if (!activity || item.activityCategory === '移動') continue;

      const existing = seen.find((entry) => areLikelyDuplicatePlaces(entry.activity, activity));
      if (existing) {
        duplicates.push({
          activity,
          dayNumber: day.dayNumber,
          duplicateOf: existing.activity,
          duplicateDayNumber: existing.dayNumber,
        });
      } else {
        seen.push({ activity, dayNumber: day.dayNumber });
      }
    }
  }

  return duplicates;
}

function inferReplacementCategory(item: ItineraryItem): string {
  return item.activityCategory?.trim() || item.placeCategory?.trim() || '体験';
}

function pickReplacementPlace(
  item: ItineraryItem,
  usedNames: Set<string>,
  places: NearbyPlace[],
): NearbyPlace | null {
  const current = item.activity.trim();
  const category = inferReplacementCategory(item).toLowerCase();

  const candidates = places.filter((place) => {
    if (usedNames.has(normalizePlaceName(place.name))) return false;
    if (areLikelyDuplicatePlaces(place.name, current)) return false;
    return [...usedNames].every((used) => !areLikelyDuplicatePlaces(place.name, used));
  });

  if (candidates.length === 0) return null;

  const scored = candidates
    .map((place) => {
      let score = 0;
      const label = place.categoryLabel.toLowerCase();
      if (category.includes('食') && (label.includes('レストラン') || label.includes('カフェ'))) {
        score += 3;
      } else if (category.includes('カフェ') && label.includes('カフェ')) {
        score += 3;
      } else if (category.includes('散歩') && (label.includes('公園') || label.includes('観光'))) {
        score += 3;
      } else if (category.includes('文化') && (label.includes('美術') || label.includes('博物'))) {
        score += 3;
      } else if (category.includes('買い物') && label.includes('ショップ')) {
        score += 3;
      } else if (category.includes('体験') && label.includes('観光')) {
        score += 2;
      } else {
        score += 1;
      }
      if (place.rating != null) score += place.rating / 10;
      return { place, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.place ?? null;
}

export function dedupeItineraryPlaces(
  days: ItineraryDay[],
  places: NearbyPlace[] = [],
): { days: ItineraryDay[]; replacedCount: number } {
  const usedNames = new Set<string>();
  let replacedCount = 0;

  const nextDays = days.map((day) => ({
    ...day,
    items: day.items.map((item) => ({ ...item })),
  }));

  for (const day of nextDays) {
    for (let index = 0; index < day.items.length; index += 1) {
      const item = day.items[index];
      const activity = item.activity.trim();
      if (!activity || item.activityCategory === '移動') continue;

      const normalized = normalizePlaceName(activity);
      const duplicate = [...usedNames].some((used) => areLikelyDuplicatePlaces(used, activity));

      if (!duplicate) {
        usedNames.add(normalized);
        continue;
      }

      const replacement = pickReplacementPlace(item, usedNames, places);
      if (replacement) {
        day.items[index] = {
          ...item,
          activity: replacement.name,
          placeAddress: replacement.address || item.placeAddress,
          placeCategory: replacement.categoryLabel || item.placeCategory,
          websiteUrl: replacement.mapsUrl || item.websiteUrl,
          reason: `${item.reason ?? ''} 同じスポットの重複を避けるため、近隣の別スポットに差し替えました。`.trim(),
        };
        usedNames.add(normalizePlaceName(replacement.name));
        replacedCount += 1;
      } else {
        usedNames.add(normalized);
      }
    }
  }

  return { days: nextDays, replacedCount };
}

export function parseTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatMinutesAsTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function departureBufferMinutes(place?: TravelTimingPlaceType): number {
  switch (place) {
    case '空港':
      return 180;
    case '駅':
      return 60;
    case 'ホテル':
      return 30;
    default:
      return 90;
  }
}

export function getEarliestActivityStartMinutes(timing?: TravelTimingSettings | null): number | null {
  if (!timing?.arrivalTime?.trim()) return null;

  const arrival = parseTimeToMinutes(timing.arrivalTime);
  if (arrival == null) return null;

  const checkIn = timing.hotelCheckInTime?.trim()
    ? parseTimeToMinutes(timing.hotelCheckInTime)
    : parseTimeToMinutes('15:00');

  const readyAfterArrival = arrival + 90;
  const readyAfterCheckIn =
    checkIn != null && arrival <= checkIn ? checkIn + 60 : readyAfterArrival;

  return Math.max(readyAfterArrival, readyAfterCheckIn);
}

export function getLatestActivityEndMinutes(timing?: TravelTimingSettings | null): number | null {
  if (!timing?.departureTime?.trim()) return null;

  const departure = parseTimeToMinutes(timing.departureTime);
  if (departure == null) return null;

  return departure - departureBufferMinutes(timing.departurePlace);
}

export function checkArrivalDepartureConstraints(
  days: ItineraryDay[],
  timing?: TravelTimingSettings | null,
): string[] {
  if (!timing || days.length === 0) return [];

  const issues: string[] = [];
  const earliestStart = getEarliestActivityStartMinutes(timing);
  const latestEnd = getLatestActivityEndMinutes(timing);

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  if (earliestStart != null && firstDay.items.length > 0) {
    const firstItem = firstDay.items.find((item) => item.activityCategory !== '移動');
    const firstTime = firstItem ? parseTimeToMinutes(firstItem.time) : null;
    if (firstTime != null && firstTime < earliestStart) {
      issues.push(
        `1日目の開始が早すぎます（到着 ${timing.arrivalTime} 以降・${formatMinutesAsTime(earliestStart)} 頃からが現実的）`,
      );
    }
  }

  if (latestEnd != null && lastDay.items.length > 0) {
    const lastItems = [...lastDay.items].reverse();
    const lastItem = lastItems.find((item) => item.activityCategory !== '移動');
    const lastTime = lastItem ? parseTimeToMinutes(lastItem.time) : null;
    if (lastTime != null && lastTime > latestEnd) {
      issues.push(
        `最終日の予定が出発 ${timing.departureTime} に間に合いません（${formatMinutesAsTime(latestEnd)} までに終える必要あり）`,
      );
    }
  }

  if (timing.dailyStartTime?.trim()) {
    const dailyStart = parseTimeToMinutes(timing.dailyStartTime);
    if (dailyStart != null) {
      for (const day of days.slice(1, -1)) {
        const first = day.items.find((item) => item.activityCategory !== '移動');
        const firstTime = first ? parseTimeToMinutes(first.time) : null;
        if (firstTime != null && firstTime < dailyStart - 30) {
          issues.push(`${day.label}の開始が早すぎます（${timing.dailyStartTime} 頃から）`);
          break;
        }
      }
    }
  }

  return issues;
}

export function analyzeAreaDistribution(days: ItineraryDay[]): Record<number, string[]> {
  const distribution: Record<number, string[]> = {};

  for (const day of days) {
    const areas = new Set<string>();
    for (const item of day.items) {
      const source = item.placeAddress?.trim() || item.activity.trim();
      const tokens = tokenizePlaceName(source);
      const district = tokens.slice(-2).join(' ') || tokens[0];
      if (district) areas.add(district);
    }
    distribution[day.dayNumber] = [...areas];
  }

  return distribution;
}

export function countActivityCategories(days: ItineraryDay[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const day of days) {
    for (const item of day.items) {
      const category = item.activityCategory?.trim() || '未分類';
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  return counts;
}

export type ItineraryQualityReport = {
  isValid: boolean;
  duplicatePlaces: DuplicatePlaceMatch[];
  categoryCounts: Record<string, number>;
  areaDistribution: Record<number, string[]>;
  balanceIssues: string[];
  arrivalDepartureIssues: string[];
  diversityIssues: string[];
  issues: string[];
};

export function validateItineraryQuality(
  days: ItineraryDay[],
  options: {
    travelTiming?: TravelTimingSettings | null;
    dayCount: number;
    gourmetTour?: boolean;
  },
): ItineraryQualityReport {
  const duplicatePlaces = findDuplicatePlaces(days);
  const categoryCounts = countActivityCategories(days);
  const areaDistribution = analyzeAreaDistribution(days);
  const balanceReport = analyzeItineraryBalance(days);
  const arrivalDepartureIssues = checkArrivalDepartureConstraints(days, options.travelTiming);

  const diversityIssues: string[] = [];
  if (options.dayCount >= 3) {
    const themes = days.map((day) => day.theme.trim()).filter(Boolean);
    const uniqueThemes = new Set(themes.map((theme) => normalizePlaceName(theme)));
    if (uniqueThemes.size < Math.min(days.length, 3)) {
      diversityIssues.push('日ごとのテーマが似すぎています');
    }
  }

  const foodCount = (categoryCounts['食事'] ?? 0) + (categoryCounts['カフェ'] ?? 0);
  const experienceCount =
    (categoryCounts['体験'] ?? 0) +
    (categoryCounts['景色'] ?? 0) +
    (categoryCounts['文化'] ?? 0) +
    (categoryCounts['散歩'] ?? 0);

  if (!options.gourmetTour && options.dayCount >= 2 && foodCount > experienceCount) {
    diversityIssues.push('食事・カフェが体験系より多く、バラエティが不足しています');
  }

  const issues = [
    ...duplicatePlaces.map(
      (dup) =>
        `重複スポット: Day ${dup.dayNumber}「${dup.activity}」≈ Day ${dup.duplicateDayNumber}「${dup.duplicateOf}」`,
    ),
    ...(options.gourmetTour ? [] : balanceReport.issues),
    ...diversityIssues,
    ...arrivalDepartureIssues,
  ];

  return {
    isValid: issues.length === 0,
    duplicatePlaces,
    categoryCounts,
    areaDistribution,
    balanceIssues: balanceReport.issues,
    arrivalDepartureIssues,
    diversityIssues,
    issues,
  };
}

const MULTI_DAY_THEME_GUIDES: Record<number, string[]> = {
  6: [
    'Day 1: 到着・軽めの街歩き',
    'Day 2: 王道観光',
    'Day 3: 自然・絶景',
    'Day 4: ショッピング・カフェ',
    'Day 5: 現地体験・ツアー',
    'Day 6: 帰国前の軽い予定',
  ],
  5: [
    'Day 1: 到着・軽めの街歩き',
    'Day 2: 王道観光',
    'Day 3: 自然・絶景',
    'Day 4: ショッピング・カフェ',
    'Day 5: 帰国前の軽い予定',
  ],
  4: ['Day 1: 到着・街歩き', 'Day 2: 王道観光', 'Day 3: 自然・体験', 'Day 4: 帰国前の軽い予定'],
  3: ['Day 1: 到着・街歩き', 'Day 2: 王道観光', 'Day 3: 自然・体験・帰路'],
  2: ['Day 1: 到着・街歩き', 'Day 2: 王道観光・帰路'],
};

export function buildItineraryDiversityPromptSection(dayCount: number): string {
  if (dayCount <= 1) return '';

  const guide =
    MULTI_DAY_THEME_GUIDES[Math.min(dayCount, 6)] ??
    MULTI_DAY_THEME_GUIDES[6]?.slice(0, dayCount) ??
    [];

  return `
## 複数日プランの多様性（必須）
- **同じスポット名を旅全体で2回以上使わない**（ユーザーが明示的に希望した場合のみ例外）
- 各日は**異なるエリア・異なるテーマ**にする（同じ商店街ばかりにしない）
- 同じ日の中では地理的に近いスポットをグループ化し、**日をまたいで遠距離移動を増やさない**
- 各日に食事・散歩・体験・景色・文化・買い物・休憩を**バランスよく**混ぜる（グルメ旅希望時を除く）
- 長距離移動は必要な場合のみ。無理な詰め込みは禁止

### 日ごとのテーマ例（${dayCount}日）
${guide.map((line) => `- ${line}`).join('\n')}

各 day の theme フィールドに、その日のテーマを日本語で記載してください。
`.trim();
}

export function buildTravelTimingPromptSection(
  timing: TravelTimingSettings | undefined,
  dayCount: number,
): string {
  if (!timing || !hasTravelTimingConstraints(timing)) return '';

  const earliest = getEarliestActivityStartMinutes(timing);
  const latest = getLatestActivityEndMinutes(timing);

  const arrivalLine = timing.arrivalTime
    ? `- 到着: ${timing.arrivalTime}${timing.arrivalPlace ? `（${timing.arrivalPlace}${timing.arrivalPlaceDetail ? ` · ${timing.arrivalPlaceDetail}` : ''}）` : ''}`
    : '';
  const departureLine = timing.departureTime
    ? `- 出発: ${timing.departureTime}${timing.departurePlace ? `（${timing.departurePlace}${timing.departurePlaceDetail ? ` · ${timing.departurePlaceDetail}` : ''}）` : ''}`
    : '';

  return `
## 到着・出発時間（必須遵守）
${arrivalLine}
${departureLine}
${timing.hotelCheckInTime ? `- ホテルチェックイン: ${timing.hotelCheckInTime}` : ''}
${timing.dailyStartTime ? `- 1日の行動開始目安: ${timing.dailyStartTime}` : ''}
${timing.dailyEndTime ? `- 1日の行動終了目安: ${timing.dailyEndTime}` : ''}

### Day 1（到着日）
${earliest != null ? `- **${formatMinutesAsTime(earliest)} より前に観光・食事を入れない**（到着後の移動・荷物・チェックインの余裕）` : '- 到着後は軽めの街歩き・食事・休憩中心に'}
- 到着直後の詰め込み禁止。人間が疲れないペースに

### 最終日（${dayCount}日目）
${latest != null ? `- **最後のアクティビティは ${formatMinutesAsTime(latest)} までに終える**（出発場所へ向かう時間を確保）` : '- 帰路に間に合うよう軽めの予定に'}
${timing.departurePlace === '空港' ? '- 空港出発の場合: 国際線は3時間前、国内線は2時間前を目安に空港到着' : ''}
${timing.departurePlace === '駅' ? '- 電車・新幹線の場合: 出発30〜60分前に駅到着を想定' : ''}
`.trim();
}

function hasTravelTimingConstraints(timing: TravelTimingSettings): boolean {
  return Boolean(
    timing.arrivalTime?.trim() ||
      timing.departureTime?.trim() ||
      timing.hotelCheckInTime?.trim() ||
      timing.dailyStartTime?.trim() ||
      timing.dailyEndTime?.trim(),
  );
}

export function buildTourSuggestionPromptSection(dayCount: number, location: string): string {
  if (dayCount < 3) return '';

  return `
## ツアー・現地体験の提案（必須 · tourSuggestions）
${dayCount}日以上の旅行では、tourSuggestions に **1〜3件** のオプション提案を含めてください。
- 例: 「この日はグレートバリアリーフの日帰りツアーを入れると満足度が高いです」
- 例: 「${location} のフードツアーは予約が必要な可能性があります」
- needsBooking が true の場合は「ツアー予約が必要な可能性があります」と description に触れる
- 実際の itinerary に組み込むかは任意（提案として記載）
`.trim();
}

export function buildItineraryQualityFixInstruction(report: ItineraryQualityReport): string {
  return `
## プラン品質修正（必須）
前回生成したプランに以下の問題がありました。**旅全体を作り直し**、問題を解消してください。

${report.issues.map((issue) => `- ${issue}`).join('\n')}

修正方針:
- 同じスポット名の重複を完全に排除
- 日ごとに異なるエリア・テーマを設定
- 食事偏重を避け、散歩・体験・景色・文化・買い物・休憩を増やす
- 到着・出発時間を守り、1日目は軽く、最終日は帰路に間に合うように
- 実在スポットリストがある場合は、リスト内の**未使用スポット**を優先
`.trim();
}

export function logItineraryQualityReport(report: ItineraryQualityReport): void {
  logPlanGenerationStep('itinerary_quality', {
    isValid: report.isValid,
    duplicateCount: report.duplicatePlaces.length,
    duplicatePlaces: report.duplicatePlaces,
    categoryCounts: report.categoryCounts,
    areaDistribution: report.areaDistribution,
    arrivalDepartureIssues: report.arrivalDepartureIssues,
    issues: report.issues,
  });
}

export function shouldAttemptQualityFix(
  report: ItineraryQualityReport,
  options: { gourmetTour: boolean },
): boolean {
  if (report.isValid) return false;
  if (report.duplicatePlaces.length > 0) return true;
  if (report.arrivalDepartureIssues.length > 0) return true;
  if (!options.gourmetTour && report.balanceIssues.length > 0) return true;
  if (report.diversityIssues.length > 0) return true;
  return false;
}

export { isGourmetTourIntent };
