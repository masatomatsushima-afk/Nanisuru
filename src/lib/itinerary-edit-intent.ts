import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { ItineraryEditAction, ItineraryEditTarget } from '@/types/itinerary-edit';
import { parseTimeToMinutes } from '@/lib/itinerary-quality';

export type DetectedItineraryEditIntent = {
  dayIndex: number;
  itemIndex: number;
  editRequest: string;
  action: ItineraryEditAction;
  confidence: 'high' | 'medium' | 'low';
};

const DAY_PATTERN = /(\d+)\s*日目/;
const DELETE_PATTERN = /削除|なくして|外して|取り除/;
const REORDER_PATTERN = /順番|入れ替|前に移|後に移|先に|後ろに/;
const ADD_BEFORE_PATTERN = /前に(?:追加|入れ|寄|立ち寄)/;
const ADD_AFTER_PATTERN = /後に(?:追加|入れ|寄|立ち寄)|(?:の)?後で|から行きたい|寄ってから/;
const TIME_PATTERN = /時間|時刻|(?:\d{1,2})\s*時/;
const CAFE_PATTERN = /カフェ|喫茶/;
const BEACH_PATTERN = /ビーチ|海|海水浴/;
const NIGHT_PATTERN = /夜景|ナイト/;
const RAIN_PATTERN = /雨|屋内|室内/;
const BUDGET_PATTERN = /予算|安く|節約|コスパ/;
const DATE_PATTERN = /デート|恋人|カップル/;
const LESS_MOVE_PATTERN = /移動|近い|近場|歩ける/;

function detectDayIndex(message: string, days: ItineraryDay[]): number | null {
  const match = message.match(DAY_PATTERN);
  if (match) {
    const dayNumber = parseInt(match[1], 10);
    const index = days.findIndex((day) => day.dayNumber === dayNumber);
    if (index >= 0) return index;
    if (dayNumber >= 1 && dayNumber <= days.length) return dayNumber - 1;
  }
  return null;
}

function detectMealSlot(message: string): 'morning' | 'lunch' | 'dinner' | 'night' | null {
  if (/朝|モーニング|朝食|ブレックファスト/.test(message)) return 'morning';
  if (/昼|ランチ|午前中|午後/.test(message)) return 'lunch';
  if (/ディナー|夕食|夜ごはん|晩ごはん|夕方/.test(message)) return 'dinner';
  if (/夜|ナイト|夜景/.test(message)) return 'night';
  return null;
}

function scoreItemForSlot(item: ItineraryItem, slot: ReturnType<typeof detectMealSlot>): number {
  const minutes = parseTimeToMinutes(item.time);
  if (minutes == null || !slot) return 0;

  if (slot === 'morning' && minutes >= 7 * 60 && minutes < 11 * 60) return 3;
  if (slot === 'lunch' && minutes >= 11 * 60 && minutes < 15 * 60) return 3;
  if (slot === 'dinner' && minutes >= 17 * 60 && minutes < 21 * 60) return 3;
  if (slot === 'night' && minutes >= 18 * 60) return 2;

  if (slot === 'lunch' && item.activityCategory === '食事') return 2;
  if (slot === 'dinner' && item.activityCategory === '食事') return 2;
  if (slot === 'morning' && item.activityCategory === 'カフェ') return 2;

  return 0;
}

function findItemByActivityKeyword(
  days: ItineraryDay[],
  dayIndex: number | null,
  message: string,
): { dayIndex: number; itemIndex: number } | null {
  const searchDays =
    dayIndex != null ? [{ day: days[dayIndex], dayIndex }] : days.map((day, index) => ({ day, dayIndex: index }));

  for (const { day, dayIndex: dIdx } of searchDays) {
    for (let itemIndex = 0; itemIndex < day.items.length; itemIndex += 1) {
      const activity = day.items[itemIndex].activity;
      if (activity.length >= 2 && message.includes(activity.slice(0, Math.min(6, activity.length)))) {
        return { dayIndex: dIdx, itemIndex };
      }
    }
  }
  return null;
}

function findItemByMealSlot(days: ItineraryDay[], dayIndex: number, slot: ReturnType<typeof detectMealSlot>): number {
  const day = days[dayIndex];
  if (!day || !slot) return -1;

  let bestIndex = -1;
  let bestScore = 0;

  for (let itemIndex = 0; itemIndex < day.items.length; itemIndex += 1) {
    const item = day.items[itemIndex];
    if (item.activityCategory === '移動') continue;
    const score = scoreItemForSlot(item, slot);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = itemIndex;
    }
  }

  return bestIndex;
}

function detectAction(message: string): ItineraryEditAction {
  if (DELETE_PATTERN.test(message)) return 'delete';
  if (REORDER_PATTERN.test(message)) return 'reorder';
  if (ADD_BEFORE_PATTERN.test(message)) return 'add_before';
  if (ADD_AFTER_PATTERN.test(message)) return 'add_after';
  if (TIME_PATTERN.test(message)) return 'change_time';
  return 'ai_consult';
}

function buildEditRequestFromMessage(message: string): string {
  return message.trim();
}

export function detectItineraryEditIntent(
  message: string,
  days: ItineraryDay[],
): DetectedItineraryEditIntent | null {
  const trimmed = message.trim();
  if (!trimmed || days.length === 0) return null;

  const changeSignals =
    /変え|変更|替え|入れ替|追加|削除|寄|近い|屋内|雨|カフェ|ビーチ|夜景|焼肉|移動|順番|時間|プラン/.test(
      trimmed,
    );
  if (!changeSignals) return null;

  const dayIndex = detectDayIndex(trimmed, days) ?? 0;
  const mealSlot = detectMealSlot(trimmed);
  const keywordMatch = findItemByActivityKeyword(days, detectDayIndex(trimmed, days), trimmed);

  let itemIndex = keywordMatch?.itemIndex ?? -1;
  if (keywordMatch) {
    return {
      dayIndex: keywordMatch.dayIndex,
      itemIndex: keywordMatch.itemIndex,
      editRequest: buildEditRequestFromMessage(trimmed),
      action: detectAction(trimmed),
      confidence: 'high',
    };
  }

  if (mealSlot) {
    itemIndex = findItemByMealSlot(days, dayIndex, mealSlot);
  }

  if (itemIndex < 0) {
    const day = days[dayIndex];
    const nonMove = day.items.findIndex((item) => item.activityCategory !== '移動');
    itemIndex = nonMove >= 0 ? nonMove : 0;
  }

  return {
    dayIndex,
    itemIndex,
    editRequest: buildEditRequestFromMessage(trimmed),
    action: detectAction(trimmed),
    confidence: mealSlot || detectDayIndex(trimmed, days) != null ? 'medium' : 'low',
  };
}

export function buildTargetFromIntent(
  days: ItineraryDay[],
  intent: DetectedItineraryEditIntent,
): ItineraryEditTarget | null {
  const day = days[intent.dayIndex];
  const item = day?.items[intent.itemIndex];
  if (!day || !item) return null;

  return {
    dayIndex: intent.dayIndex,
    itemIndex: intent.itemIndex,
    dayNumber: day.dayNumber,
    item,
  };
}

export function isLikelyItineraryEditMessage(message: string): boolean {
  return /変え|変更|替え|入れ替|追加|削除|寄|近い|屋内|雨|カフェ|ビーチ|夜景|焼肉|移動|順番|時間|プラン.*(変|修正)|日目.*(変|追加|削除)/.test(
    message.trim(),
  );
}
