import {
  buildTargetFromIntent,
  detectItineraryEditIntent,
  isLikelyItineraryEditMessage,
} from '@/lib/itinerary-edit-intent';
import { previewPartialItineraryEdit } from '@/lib/itinerary-partial-edit';
import { parseTimeToMinutes } from '@/lib/itinerary-quality';
import type { ItineraryDay } from '@/types/plan';
import type { DetectedItineraryEditIntent } from '@/lib/itinerary-edit-intent';
import type { TripAssistantAction, TripAssistantContext } from '@/types/trip-assistant';

const CONCRETE_CHANGE_PATTERN =
  /変更|差し替|代わりに|に変更|から.*(?:へ|に)|(?:→|⇒)|(?:公園|カフェ|博物館|美術館|レストラン|スポット|ショッピング|モール).*(?:に|へ)/;

const ADVICE_ONLY_PATTERN =
  /^(?:傘|日傘|レイン|防水|持っ|忘れず|安心|注意|気をつけ|チェック|確認)/;

const ACTION_TRIGGER_USER_PATTERN =
  /雨|屋内|室内|夜だけ|夜の|ナイト|予算|カフェ|グルメ|移動|楽に|抑え|変更|替え|差し替|追加/;

function hasConcreteChangeLanguage(text: string): boolean {
  return CONCRETE_CHANGE_PATTERN.test(text);
}

export function isAdviceOnlyResponse(userMessage: string, assistantResponse: string): boolean {
  const trimmed = assistantResponse.trim();
  if (!trimmed) return true;

  if (shouldTryBuildAssistantAction(userMessage, assistantResponse)) {
    return false;
  }

  if (hasConcreteChangeLanguage(trimmed)) {
    return false;
  }

  if (ADVICE_ONLY_PATTERN.test(trimmed) && trimmed.length < 120) {
    return true;
  }

  return !isLikelyItineraryEditMessage(userMessage);
}

export function shouldTryBuildAssistantAction(
  userMessage: string,
  assistantResponse: string,
): boolean {
  if (isLikelyItineraryEditMessage(userMessage)) return true;
  if (ACTION_TRIGGER_USER_PATTERN.test(userMessage) && hasConcreteChangeLanguage(assistantResponse)) {
    return true;
  }
  if (hasConcreteChangeLanguage(assistantResponse) && /おすすめ|提案|変更/.test(assistantResponse)) {
    return true;
  }
  return false;
}

function parseEmbeddedActionJson(response: string): Partial<TripAssistantAction> | null {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    if (parsed.type !== 'itinerary_update') return null;
    return parsed as Partial<TripAssistantAction>;
  } catch {
    return null;
  }
}

function inferIntentFromContext(
  userMessage: string,
  assistantResponse: string,
  days: ItineraryDay[],
): DetectedItineraryEditIntent | null {
  const combined = `${userMessage}\n${assistantResponse}`;
  const fromCombined = detectItineraryEditIntent(combined, days);
  if (fromCombined && fromCombined.confidence !== 'low') return fromCombined;

  const fromUser = detectItineraryEditIntent(userMessage, days);
  if (fromUser && fromUser.confidence !== 'low') return fromUser;

  const fromResponse = detectItineraryEditIntent(assistantResponse, days);
  if (fromResponse) return fromResponse;

  if (/雨|屋内|室内/.test(combined)) {
    return inferSlotIntent(days, 'afternoon');
  }
  if (/夜だけ|夜の|ナイト|ディナー/.test(userMessage)) {
    return inferSlotIntent(days, 'night');
  }

  return fromCombined;
}

function inferSlotIntent(
  days: ItineraryDay[],
  slot: 'afternoon' | 'night',
): DetectedItineraryEditIntent | null {
  const dayIndex = 0;
  const day = days[dayIndex];
  if (!day) return null;

  let bestIndex = -1;
  let bestScore = 0;

  for (let itemIndex = 0; itemIndex < day.items.length; itemIndex += 1) {
    const item = day.items[itemIndex];
    if (item.activityCategory === '移動') continue;
    const minutes = parseTimeToMinutes(item.time);
    if (minutes == null) continue;

    let score = 0;
    if (slot === 'afternoon' && minutes >= 12 * 60 && minutes < 17 * 60) score = 3;
    if (slot === 'night' && minutes >= 18 * 60) score = 3;
    if (slot === 'afternoon' && item.activityCategory !== '食事') score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = itemIndex;
    }
  }

  if (bestIndex < 0) {
    const fallback = day.items.findIndex((item) => item.activityCategory !== '移動');
    bestIndex = fallback >= 0 ? fallback : 0;
  }

  return {
    dayIndex,
    itemIndex: bestIndex,
    editRequest: slot === 'night' ? '夜の予定を変更' : '午後の予定を雨対応に変更',
    action: 'change_place',
    confidence: 'medium',
  };
}

export async function detectTripAssistantAction(params: {
  userMessage: string;
  assistantResponse: string;
  context: TripAssistantContext;
}): Promise<TripAssistantAction | null> {
  const { userMessage, assistantResponse, context } = params;
  const plan = context.latestPlan;

  if (!plan?.days?.length) return null;
  if (isAdviceOnlyResponse(userMessage, assistantResponse)) return null;
  if (!shouldTryBuildAssistantAction(userMessage, assistantResponse)) return null;

  const embedded = parseEmbeddedActionJson(assistantResponse);
  const intent = inferIntentFromContext(userMessage, assistantResponse, plan.days);
  if (!intent) return null;

  const target = buildTargetFromIntent(plan.days, intent);
  if (!target) return null;

  const editRequest = `${userMessage.trim()}\n\n秘書の提案:\n${assistantResponse.trim()}`;

  try {
    const preview = await previewPartialItineraryEdit({
      payload: plan,
      target,
      action: 'change_place',
      userRequest: editRequest,
    });

    const beforeItem = preview.preview.beforeItem;
    const afterItem = preview.preview.afterItem;

    if (!beforeItem || !afterItem) return null;
    if (beforeItem.activity === afterItem.activity && beforeItem.time === afterItem.time) {
      return null;
    }

    const movementNote = [preview.preview.movementFromPrev, preview.preview.movementToNext]
      .filter(Boolean)
      .join('\n');

    const action: TripAssistantAction = {
      type: 'itinerary_update',
      title: embedded?.title?.trim() || preview.preview.summary.slice(0, 80) || '行程の変更案',
      targetDayIndex: target.dayIndex,
      targetItemIndex: target.itemIndex,
      beforeItem,
      afterItem,
      reason: embedded?.reason?.trim() || preview.preview.reason || preview.preview.summary,
      budgetImpact: embedded?.budgetImpact?.trim() || preview.preview.budgetImpact,
      movementNote: embedded?.movementNote?.trim() || movementNote || undefined,
      editProposal: preview,
      target,
      editRequest: userMessage.trim(),
    };

    console.log('[TripAssistantAction] detected action', {
      type: action.type,
      title: action.title,
      targetDayIndex: action.targetDayIndex,
      targetItemIndex: action.targetItemIndex,
      beforeItem: action.beforeItem.activity,
      afterItem: action.afterItem.activity,
      reason: action.reason,
      budgetImpact: action.budgetImpact,
      movementNote: action.movementNote,
    });

    return action;
  } catch {
    return null;
  }
}
