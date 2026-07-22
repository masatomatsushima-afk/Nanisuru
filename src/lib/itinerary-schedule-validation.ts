/**
 * Post-generation itinerary validation & schedule fixes for travel plans.
 * Runs after AI parse / fallback build — never show raw OpenAI output without passing through here.
 */

import type { ResolvedDestinationDetails } from './destination-detail-input';
import {
  buildSafeAreaMapsQuery,
  categoryForGenericKind,
  enforceDestinationScopedQuery,
  getSafeAreasForDestinationByCategory,
  normalizeDestination,
  type GenericAreaPhraseKind,
  type NormalizedDestination,
} from './destination-safety';
import {
  formatMinutesAsTime,
  getEarliestActivityStartMinutes,
  getLatestActivityEndMinutes,
  normalizePlaceName,
  parseTimeToMinutes,
} from './itinerary-quality';
import { resolveTargetItemCountForDay } from './day-availability';
import {
  buildSeoulSeedMapsQuery,
  isSeoulDestination,
  pickSeoulSeedForKind,
  seoulSeedToCandidate,
} from './seoul-spot-seeds';
import { inferKindFromItem, isAbstractItineraryItem } from './spot-specificity';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { TravelTimingSettings } from '@/types/travel-timing';

const NIGHT_VIEW_EARLIEST_MINUTES = 18 * 60 + 30;
const DEFAULT_NIGHT_SLOT_MINUTES = 19 * 60 + 30;
const MIN_ITEM_GAP_MINUTES = 45;
const PREFERRED_ITEM_GAP_MINUTES = 60;

const NIGHT_VIEW_ACTIVITY_PATTERN =
  /夜景|night\s*view|ナイトビュー|ライトアップ|イルミネーション/i;
const TOWER_VIEW_PATTERN = /タワー|tower|展望台|observation\s*deck/i;

export type ItineraryScheduleValidationOptions = {
  days: ItineraryDay[];
  rawLocation: string;
  travelTiming?: TravelTimingSettings | null;
  destinationDetails?: ResolvedDestinationDetails;
};

export type ItineraryScheduleValidationReport = {
  days: ItineraryDay[];
  fixesApplied: string[];
  issuesFound: string[];
  removedCount: number;
  replacedCount: number;
  /** Non-transit items removed by final-day cutoff / count limits. */
  itemsRemovedByFinalDayValidation: number;
  /** Per-day diagnostics for safe dev logs (no secrets). */
  dayDiagnostics: Array<{
    dayIndex: number;
    dayAvailableMinutes: number;
    targetItemCountPerDay: number;
    actualItemCountPerDay: number;
    foodItemCountPerDay: number;
    finalDayCutoffTime: string | null;
  }>;
};

function cloneDays(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day) => ({
    ...day,
    items: day.items.map((item) => ({ ...item })),
  }));
}

function isTransitItem(item: ItineraryItem): boolean {
  return item.activityCategory === '移動';
}

function normalizeMapsKey(query: string): string {
  return normalizePlaceName(query.replace(/\b(japan|korea|seoul|osaka|tokyo)\b/gi, ' '));
}

function getItemArea(item: ItineraryItem): string {
  return (item.placeAddress ?? item.placeName ?? '').trim();
}

function getItemCategoryKey(item: ItineraryItem): string {
  return (item.category ?? item.activityCategory ?? item.placeCategory ?? 'activity').trim();
}

function itemDuplicateKeys(item: ItineraryItem): string[] {
  const keys: string[] = [];
  const placeName = item.placeName?.trim();
  const mapsQuery = item.mapsQuery?.trim();
  const activity = item.activity?.trim();

  if (placeName) keys.push(`place:${normalizePlaceName(placeName)}`);
  if (mapsQuery) keys.push(`maps:${normalizeMapsKey(mapsQuery)}`);
  if (activity) keys.push(`title:${normalizePlaceName(activity)}`);

  const area = getItemArea(item);
  const category = getItemCategoryKey(item);
  if (area && category && !isTransitItem(item)) {
    keys.push(`area+cat:${normalizePlaceName(area)}|${normalizePlaceName(category)}`);
  }

  return keys;
}

function keysOverlap(seen: Set<string>, keys: string[]): boolean {
  return keys.some((key) => seen.has(key));
}

function registerKeys(seen: Set<string>, keys: string[]): void {
  for (const key of keys) seen.add(key);
}

export function isNightViewItem(item: Pick<ItineraryItem, 'activity' | 'placeName' | 'category'>): boolean {
  const haystack = `${item.activity} ${item.placeName ?? ''} ${item.category ?? ''}`;
  if (NIGHT_VIEW_ACTIVITY_PATTERN.test(haystack)) return true;
  if (TOWER_VIEW_PATTERN.test(haystack) && /夜景|night/i.test(haystack)) return true;
  return false;
}

export function isTowerDaytimeViewItem(item: ItineraryItem): boolean {
  const haystack = `${item.activity} ${item.placeName ?? ''}`;
  return TOWER_VIEW_PATTERN.test(haystack) && !NIGHT_VIEW_ACTIVITY_PATTERN.test(haystack);
}

const MIN_MEAL_GAP_MINUTES = 150; // 2.5 hours between heavy meals
const MAX_FOOD_PER_DAY = 3;
const MAX_CAFE_PER_DAY = 2;

function maxItemsForDay(
  dayIndex: number,
  totalDays: number,
  travelTiming?: TravelTimingSettings | null,
): number {
  const { targetItemCount } = resolveTargetItemCountForDay({ dayIndex, totalDays, travelTiming });
  // target 0 (e.g. midday airport departure) still allows a single light item before transit.
  return Math.max(targetItemCount, targetItemCount === 0 ? 1 : targetItemCount);
}

function getDepartureArrivalTargetMinutes(
  timing: TravelTimingSettings,
  arrivalPoint?: string,
): number | null {
  const departure = timing.departureTime?.trim()
    ? parseTimeToMinutes(timing.departureTime)
    : null;
  if (departure == null) return null;

  const detail = `${arrivalPoint ?? ''} ${timing.departurePlaceDetail ?? ''}`;
  const internationalHint = /国際|international|仁川|成田|ICN|NRT|HND|GMP/i.test(detail);

  let bufferMinutes = 120;
  if (timing.departurePlace === '空港' || internationalHint) {
    bufferMinutes = 180;
  } else if (timing.departurePlace === '駅') {
    bufferMinutes = 120;
  }

  return Math.max(6 * 60, departure - bufferMinutes);
}

function buildReplacementItem(
  kind: GenericAreaPhraseKind,
  normalized: NormalizedDestination,
  seen: Set<string>,
  seedCursor: { value: number },
): ItineraryItem | null {
  if (isSeoulDestination(normalized)) {
    for (let attempt = 0; attempt < SEOUL_SEED_ATTEMPTS; attempt += 1) {
      const seed = pickSeoulSeedForKind(kind, seedCursor.value, seen);
      seedCursor.value += 1;
      if (!seed) break;
      const keys = [`place:${normalizePlaceName(seed.placeName)}`, `title:${normalizePlaceName(seed.activity)}`];
      if (keysOverlap(seen, keys)) continue;
      const mapsQuery = buildSeoulSeedMapsQuery(seed, normalized);
      registerKeys(seen, keys);
      registerKeys(seen, [`maps:${normalizeMapsKey(mapsQuery)}`]);
      return {
        time: '12:00',
        activity: seed.activity,
        activityCategory: seed.category === 'food' ? '食事' : seed.category === 'cafe' ? 'カフェ' : '体験',
        placeName: seed.placeName,
        placeAddress: seed.area,
        mapsQuery,
        socialQuery: mapsQuery,
        isSpecificPlace: true,
        category: seed.category,
        popularityType: seed.popularityType,
        confidence: 'high',
        source: 'seed',
        spotCandidates: [seoulSeedToCandidate(seed, mapsQuery)],
        placeId: null,
      };
    }
  }

  const category = categoryForGenericKind(kind);
  const areas = getSafeAreasForDestinationByCategory(normalized, category);
  for (const area of areas) {
    const keys = [`place:${normalizePlaceName(area.label)}`, `area+cat:${normalizePlaceName(area.label)}|${category}`];
    if (keysOverlap(seen, keys)) continue;
    const mapsQuery = buildSafeAreaMapsQuery(area, normalized);
    registerKeys(seen, keys);
    registerKeys(seen, [`maps:${normalizeMapsKey(mapsQuery)}`]);
    const activity =
      kind === 'night'
        ? `${area.label}で夜景を楽しむ`
        : kind === 'shopping'
          ? `${area.label}でショッピング`
          : kind === 'cafe'
            ? `${area.label}のカフェで休憩`
            : `${area.label}周辺を散策`;
    return {
      time: '12:00',
      activity,
      activityCategory: kind === 'night' ? '夜景' : '体験',
      placeName: area.label,
      placeAddress: area.label,
      mapsQuery,
      socialQuery: mapsQuery,
      isSpecificPlace: true,
      category: area.category,
      popularityType: area.popularityType,
      confidence: 'high',
      source: 'seed',
      placeId: null,
    };
  }

  return null;
}

const SEOUL_SEED_ATTEMPTS = 12;

function relabelDaytimeTowerView(item: ItineraryItem): ItineraryItem {
  const place = item.placeName?.trim() || item.activity.split(/で|の/)[0]?.trim() || '展望台';
  const activity = `${place}から景色を見る`;
  return {
    ...item,
    activity,
    note: item.note ?? '日中は展望・景色を楽しむ時間帯です',
  };
}

function relabelNightView(item: ItineraryItem): ItineraryItem {
  return {
    ...item,
    time: formatMinutesAsTime(DEFAULT_NIGHT_SLOT_MINUTES),
    activity: item.activity.includes('夜景')
      ? item.activity
      : `${item.placeName ?? item.activity.split(/で|の/)[0] ?? 'スポット'}で夜景`,
    activityCategory: item.activityCategory ?? '夜景',
    category: item.category ?? 'nightlife',
  };
}

function applyDayItemCountLimits(
  days: ItineraryDay[],
  fixes: string[],
  travelTiming?: TravelTimingSettings | null,
): ItineraryDay[] {
  const totalDays = days.length;
  return days.map((day, dayIndex) => {
    const maxItems = maxItemsForDay(dayIndex, totalDays, travelTiming);
    const transit = day.items.filter(isTransitItem);
    const activities = day.items.filter((item) => !isTransitItem(item));
    if (activities.length <= maxItems) return day;

    fixes.push(`${day.label}の件数を${maxItems}件に整理しました`);
    const kept = activities.slice(0, maxItems);
    return { ...day, items: [...kept, ...transit].sort((a, b) => {
      const am = parseTimeToMinutes(a.time) ?? 0;
      const bm = parseTimeToMinutes(b.time) ?? 0;
      return am - bm;
    }) };
  });
}

function applyDuplicateFixes(
  days: ItineraryDay[],
  normalized: NormalizedDestination,
  fixes: string[],
  issues: string[],
): { days: ItineraryDay[]; removedCount: number; replacedCount: number } {
  const seen = new Set<string>();
  let removedCount = 0;
  let replacedCount = 0;
  const seedCursor = { value: 0 };

  const nextDays = days.map((day) => ({ ...day, items: [...day.items] }));

  for (const day of nextDays) {
    const nextItems: ItineraryItem[] = [];

    for (const item of day.items) {
      if (isTransitItem(item)) {
        nextItems.push(item);
        continue;
      }

      const keys = itemDuplicateKeys(item);
      if (!keysOverlap(seen, keys)) {
        registerKeys(seen, keys);
        nextItems.push(item);
        continue;
      }

      issues.push(`重複: ${item.activity}`);
      const kind = inferKindFromItem(item);
      const replacement = buildReplacementItem(kind, normalized, seen, seedCursor);
      if (replacement) {
        replacement.time = item.time;
        replacement.estimatedCost = item.estimatedCost;
        replacement.reason = `${item.reason ?? ''} 重複を避けるため別スポットに差し替えました。`.trim();
        nextItems.push(replacement);
        replacedCount += 1;
        fixes.push(`「${item.activity}」を「${replacement.activity}」に差し替え`);
      } else {
        removedCount += 1;
        fixes.push(`重複のため「${item.activity}」を削除`);
      }
    }

    day.items = nextItems;
  }

  return { days: nextDays, removedCount, replacedCount };
}

function applyNightViewRules(days: ItineraryDay[], fixes: string[], issues: string[]): ItineraryDay[] {
  return days.map((day) => {
    const items = day.items.map((item) => {
      if (isTransitItem(item)) return item;

      const minutes = parseTimeToMinutes(item.time);
      if (minutes == null) return item;

      if (isNightViewItem(item) && minutes < NIGHT_VIEW_EARLIEST_MINUTES) {
        issues.push(`夜景が早すぎます: ${item.time} ${item.activity}`);
        fixes.push(`「${item.activity}」を${formatMinutesAsTime(DEFAULT_NIGHT_SLOT_MINUTES)}以降の夜景枠に移動`);
        return relabelNightView(item);
      }

      if (isTowerDaytimeViewItem(item) && minutes < NIGHT_VIEW_EARLIEST_MINUTES && /夜景/.test(item.activity)) {
        fixes.push(`「${item.activity}」を日中の展望に変更`);
        return relabelDaytimeTowerView(item);
      }

      return item;
    });

    return { ...day, items: sortItemsByTime(items) };
  });
}

function sortItemsByTime(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const am = parseTimeToMinutes(a.time) ?? 0;
    const bm = parseTimeToMinutes(b.time) ?? 0;
    return am - bm;
  });
}

function applyFinalDayDepartureRules(
  days: ItineraryDay[],
  timing: TravelTimingSettings | null | undefined,
  arrivalPoint: string | undefined,
  baseArea: string | undefined,
  accommodation: string | undefined,
  fixes: string[],
  issues: string[],
): { days: ItineraryDay[]; itemsRemoved: number; cutoffMinutes: number | null } {
  if (days.length === 0 || !timing?.departureTime?.trim()) {
    return { days, itemsRemoved: 0, cutoffMinutes: null };
  }

  const airportArrivalTarget = getDepartureArrivalTargetMinutes(timing, arrivalPoint);
  const latestEnd = getLatestActivityEndMinutes(timing);
  const cutoff = airportArrivalTarget ?? latestEnd;
  if (cutoff == null) return { days, itemsRemoved: 0, cutoffMinutes: null };

  const lastIndex = days.length - 1;
  const lastDay = days[lastIndex];
  const hub = accommodation || baseArea || '宿泊先';
  const departurePlace = timing.departurePlace === '駅' ? '駅' : '空港';
  const { targetItemCount } = resolveTargetItemCountForDay({
    dayIndex: lastIndex,
    totalDays: days.length,
    travelTiming: timing,
  });
  // Available-minutes based cap — never the old hard-coded "max 2" that collapsed evening
  // departures to a single 17:00 survivor. target 0 (midday flight) still allows 1 light item.
  const maxNonTransit = Math.max(1, targetItemCount);

  const kept: ItineraryItem[] = [];
  let nonTransitCount = 0;
  let itemsRemoved = 0;

  for (const item of sortItemsByTime(lastDay.items)) {
    const minutes = parseTimeToMinutes(item.time);
    if (minutes == null) {
      kept.push(item);
      continue;
    }

    if (isTransitItem(item)) {
      kept.push(item);
      continue;
    }

    if (minutes >= cutoff) {
      issues.push(`最終日の出発前に間に合わない予定: ${item.time} ${item.activity}`);
      fixes.push(`最終日「${item.activity}」を削除（${formatMinutesAsTime(cutoff)}以降は${departurePlace}移動優先）`);
      itemsRemoved += 1;
      continue;
    }

    if (nonTransitCount >= maxNonTransit) {
      fixes.push(`最終日の件数超過のため「${item.activity}」を削除（上限${maxNonTransit}件）`);
      itemsRemoved += 1;
      continue;
    }

    nonTransitCount += 1;
    kept.push(item);
  }

  const hasTransit = kept.some(isTransitItem);
  if (!hasTransit) {
    kept.push({
      time: formatMinutesAsTime(Math.max(6 * 60, cutoff - 30)),
      activity: `${hub}を出発`,
      activityCategory: '移動',
      note: `${departurePlace}へ向かいます`,
      isSpecificPlace: false,
      confidence: 'low',
    });
    kept.push({
      time: formatMinutesAsTime(cutoff),
      activity: `${departurePlace}到着目安`,
      activityCategory: '移動',
      note: `出発 ${timing.departureTime} に合わせた到着目安`,
      isSpecificPlace: false,
      confidence: 'low',
    });
    fixes.push(`最終日に${hub}→${departurePlace}の移動を追加`);
  }

  const nextDays = [...days];
  nextDays[lastIndex] = {
    ...lastDay,
    theme: lastDay.theme?.trim() || '出発・移動',
    items: sortItemsByTime(kept),
  };
  return { days: nextDays, itemsRemoved, cutoffMinutes: cutoff };
}

function isFoodItem(item: ItineraryItem): boolean {
  return item.category === 'food' || item.activityCategory === '食事';
}

function isCafeItem(item: ItineraryItem): boolean {
  return item.category === 'cafe' || item.activityCategory === 'カフェ';
}

/**
 * Caps heavy meals / cafes per day and enforces a minimum gap between consecutive food items.
 * Config-agnostic (applies to every trip) — prevents the "eat all day" failure mode without a
 * gourmet-specific if.
 */
function applyMealPacingRules(days: ItineraryDay[], fixes: string[]): ItineraryDay[] {
  return days.map((day) => {
    const sorted = sortItemsByTime(day.items);
    const kept: ItineraryItem[] = [];
    let foodCount = 0;
    let cafeCount = 0;
    let lastFoodMinutes: number | null = null;

    for (const item of sorted) {
      if (isTransitItem(item)) {
        kept.push(item);
        continue;
      }

      const minutes = parseTimeToMinutes(item.time);
      const food = isFoodItem(item);
      const cafe = isCafeItem(item);

      if (food && foodCount >= MAX_FOOD_PER_DAY) {
        fixes.push(`${day.label}の食事上限超過のため「${item.activity}」を削除`);
        continue;
      }
      if (cafe && cafeCount >= MAX_CAFE_PER_DAY) {
        fixes.push(`${day.label}のカフェ上限超過のため「${item.activity}」を削除`);
        continue;
      }
      if (
        food &&
        lastFoodMinutes != null &&
        minutes != null &&
        minutes - lastFoodMinutes < MIN_MEAL_GAP_MINUTES
      ) {
        fixes.push(
          `${day.label}の食事間隔不足のため「${item.activity}」を削除（前回食事から${MIN_MEAL_GAP_MINUTES}分未満）`,
        );
        continue;
      }

      if (food) {
        foodCount += 1;
        if (minutes != null) lastFoodMinutes = minutes;
      }
      if (cafe) cafeCount += 1;
      kept.push(item);
    }

    return { ...day, items: kept };
  });
}

function applyFirstDayArrivalRules(
  days: ItineraryDay[],
  timing: TravelTimingSettings | null | undefined,
  fixes: string[],
): ItineraryDay[] {
  if (days.length === 0) return days;

  const earliest = getEarliestActivityStartMinutes(timing);
  if (earliest == null) {
    const firstDay = days[0];
    if (!firstDay.theme?.trim()) {
      return [{ ...firstDay, theme: '到着・拠点周辺' }, ...days.slice(1)];
    }
    return days;
  }

  const firstDay = days[0];
  const shifted = firstDay.items.map((item) => {
    if (isTransitItem(item)) return item;
    const minutes = parseTimeToMinutes(item.time);
    if (minutes == null || minutes >= earliest) return item;
    fixes.push(`1日目「${item.activity}」を到着後（${formatMinutesAsTime(earliest)}）に調整`);
    return { ...item, time: formatMinutesAsTime(earliest) };
  });

  const nextFirst: ItineraryDay = {
    ...firstDay,
    theme: firstDay.theme?.trim() || '到着・拠点周辺',
    items: sortItemsByTime(shifted),
  };

  return [nextFirst, ...days.slice(1)];
}

function applyMinimumTravelGaps(days: ItineraryDay[], fixes: string[]): ItineraryDay[] {
  return days.map((day) => {
    const items = sortItemsByTime(day.items.filter((item) => item.activity?.trim()));
    if (items.length < 2) return { ...day, items };

    let prevEnd = parseTimeToMinutes(items[0].time) ?? 9 * 60;
    const rescheduled: ItineraryItem[] = [{ ...items[0] }];

    for (let i = 1; i < items.length; i += 1) {
      const item = { ...items[i] };
      const current = parseTimeToMinutes(item.time);
      const minStart = prevEnd + MIN_ITEM_GAP_MINUTES;
      if (current != null && current < minStart) {
        item.time = formatMinutesAsTime(minStart);
        fixes.push(`${day.label}の移動バッファのため「${item.activity}」を${item.time}に調整`);
      } else if (current == null) {
        item.time = formatMinutesAsTime(minStart);
      }
      const start = parseTimeToMinutes(item.time) ?? minStart;
      prevEnd = start + PREFERRED_ITEM_GAP_MINUTES;
      rescheduled.push(item);
    }

    return { ...day, items: rescheduled };
  });
}

function applyDayThemes(days: ItineraryDay[]): ItineraryDay[] {
  const total = days.length;
  return days.map((day, index) => {
    if (day.theme?.trim()) return day;
    if (total <= 1) return { ...day, theme: '日帰りプラン' };
    if (index === 0) return { ...day, theme: '到着・拠点周辺' };
    if (index === total - 1) return { ...day, theme: '出発・移動' };
    if (index === 1) return { ...day, theme: 'メイン観光' };
    return { ...day, theme: 'カフェ・買い物・散策' };
  });
}

function stripInvalidMapsItems(
  days: ItineraryDay[],
  normalized: NormalizedDestination,
  fixes: string[],
  issues: string[],
): ItineraryDay[] {
  return days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      let next = { ...item };
      if (!next.mapsQuery?.trim()) {
        issues.push(`mapsQuery欠落: ${item.activity}`);
        next.mapsQuery = enforceDestinationScopedQuery(item.activity, normalized);
        next.socialQuery = next.socialQuery ?? next.mapsQuery;
        fixes.push(`「${item.activity}」にmapsQueryを補完`);
      } else {
        const scoped = enforceDestinationScopedQuery(next.mapsQuery, normalized);
        if (scoped !== next.mapsQuery) {
          next.mapsQuery = scoped;
          next.socialQuery = next.socialQuery ?? scoped;
          fixes.push(`「${item.activity}」のmapsQueryを目的地付きに修正`);
        }
      }

      if (isAbstractItineraryItem(next)) {
        issues.push(`抽象item: ${next.activity}`);
        next.isSpecificPlace = false;
        next.confidence = 'low';
      }

      if (next.isSpecificPlace === false) {
        next.placeId = null;
      }

      return next;
    }),
  }));
}

/** Main post-generation validator — dedupe, schedule, night view, departure, gaps. */
export function validateAndFixItinerarySchedule(
  options: ItineraryScheduleValidationOptions,
): ItineraryScheduleValidationReport {
  const normalized = normalizeDestination(options.rawLocation);
  const fixesApplied: string[] = [];
  const issuesFound: string[] = [];

  let days = cloneDays(options.days);
  days = applyDayThemes(days);
  days = applyDayItemCountLimits(days, fixesApplied, options.travelTiming);

  const dedupeResult = applyDuplicateFixes(days, normalized, fixesApplied, issuesFound);
  days = dedupeResult.days;

  days = applyNightViewRules(days, fixesApplied, issuesFound);
  days = applyFirstDayArrivalRules(days, options.travelTiming, fixesApplied);
  const finalDayResult = applyFinalDayDepartureRules(
    days,
    options.travelTiming,
    options.destinationDetails?.arrivalPoint,
    options.destinationDetails?.baseArea,
    options.destinationDetails?.accommodation,
    fixesApplied,
    issuesFound,
  );
  days = finalDayResult.days;
  days = applyMealPacingRules(days, fixesApplied);
  days = applyMinimumTravelGaps(days, fixesApplied);
  days = stripInvalidMapsItems(days, normalized, fixesApplied, issuesFound);

  const dayDiagnostics = days.map((day, dayIndex) => {
    const { availableMinutes, targetItemCount } = resolveTargetItemCountForDay({
      dayIndex,
      totalDays: days.length,
      travelTiming: options.travelTiming,
    });
    const nonTransit = day.items.filter((item) => !isTransitItem(item));
    return {
      dayIndex,
      dayAvailableMinutes: availableMinutes,
      targetItemCountPerDay: targetItemCount,
      actualItemCountPerDay: nonTransit.length,
      foodItemCountPerDay: nonTransit.filter((item) => isFoodItem(item) || isCafeItem(item)).length,
      finalDayCutoffTime:
        dayIndex === days.length - 1 && finalDayResult.cutoffMinutes != null
          ? formatMinutesAsTime(finalDayResult.cutoffMinutes)
          : null,
    };
  });

  return {
    days,
    fixesApplied,
    issuesFound,
    removedCount: dedupeResult.removedCount,
    replacedCount: dedupeResult.replacedCount,
    itemsRemovedByFinalDayValidation: finalDayResult.itemsRemoved,
    dayDiagnostics,
  };
}

export function collectItineraryScheduleIssues(
  days: ItineraryDay[],
  travelTiming?: TravelTimingSettings | null,
): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const day of days) {
    for (const item of day.items) {
      if (isTransitItem(item)) continue;
      const keys = itemDuplicateKeys(item);
      if (keysOverlap(seen, keys)) {
        issues.push(`duplicate:${item.activity}`);
      }
      registerKeys(seen, keys);

      const minutes = parseTimeToMinutes(item.time);
      if (minutes != null && isNightViewItem(item) && minutes < NIGHT_VIEW_EARLIEST_MINUTES) {
        issues.push(`night_too_early:${item.activity}`);
      }
      if (!item.mapsQuery?.trim()) issues.push(`missing_maps:${item.activity}`);
      if (isAbstractItineraryItem(item)) issues.push(`abstract:${item.activity}`);
      if (item.isSpecificPlace === false && item.placeId) {
        issues.push(`directions_mismatch:${item.activity}`);
      }
    }
  }

  if (travelTiming?.departureTime) {
    const cutoff = getDepartureArrivalTargetMinutes(travelTiming);
    const lastDay = days[days.length - 1];
    if (cutoff != null && lastDay) {
      for (const item of lastDay.items) {
        if (isTransitItem(item)) continue;
        const minutes = parseTimeToMinutes(item.time);
        if (minutes != null && minutes >= cutoff) {
          issues.push(`final_day_late:${item.activity}`);
        }
      }
    }
  }

  return issues;
}
