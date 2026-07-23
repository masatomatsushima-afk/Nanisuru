import { APP_MESSAGES, AppError, isNetworkError } from '@/lib/app-errors';
import { getOpenAiApiKey, isOpenAiConfigured } from '@/lib/env';
import { ITINERARY_ACTIVITY_CATEGORIES } from '@/lib/itinerary-balance';
import {
  dedupeItineraryPlaces,
  findDuplicatePlaces,
  formatMinutesAsTime,
  parseTimeToMinutes,
} from '@/lib/itinerary-quality';
import { runItineraryQualityCheck } from '@/lib/itinerary-quality-engine';
import {
  REPLACEMENT_NO_CANDIDATES_MESSAGE,
  applyReplacementCandidateToItem,
  buildReplacementPreferenceSignalDrafts,
  fetchReplacementPlaceCandidates,
  type ItineraryReplacementCandidateView,
  type ReplacementSearchDiagnostics,
} from '@/lib/itinerary-replacement-search';
import { flattenItineraryDays } from '@/lib/trip-duration';
import type {
  ItineraryEditAction,
  ItineraryEditPreview,
  ItineraryEditTarget,
  ItinerarySingleEditPresetId,
  PartialItineraryEditResult,
} from '@/types/itinerary-edit';
import type { ItineraryDay, ItineraryItem, PlanDetails } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type { TransportGuidanceContext } from '@/types/transport-guidance';

const ITINERARY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    time: { type: 'string' },
    activity: { type: 'string' },
    activityCategory: { type: 'string', enum: [...ITINERARY_ACTIVITY_CATEGORIES] },
    placeCategory: { type: 'string' },
    reason: { type: 'string' },
    estimatedCost: { type: 'string' },
    transportation: { type: 'string' },
    reservationUrl: { type: 'string' },
    websiteUrl: { type: 'string' },
    travelTimeToNext: { type: 'string' },
    weatherBackup: { type: 'string' },
  },
  required: [
    'time',
    'activity',
    'activityCategory',
    'placeCategory',
    'reason',
    'estimatedCost',
    'transportation',
    'reservationUrl',
    'websiteUrl',
    'travelTimeToNext',
    'weatherBackup',
  ],
  additionalProperties: false,
} as const;

const PARTIAL_DAY_SCHEMA = {
  type: 'object',
  properties: {
    updatedDay: {
      type: 'object',
      properties: {
        dayNumber: { type: 'number' },
        label: { type: 'string' },
        theme: { type: 'string' },
        items: {
          type: 'array',
          items: ITINERARY_ITEM_SCHEMA,
          minItems: 2,
          maxItems: 12,
        },
      },
      required: ['dayNumber', 'label', 'theme', 'items'],
      additionalProperties: false,
    },
    changeSummary: { type: 'string' },
    totalBudget: { type: 'string' },
  },
  required: ['updatedDay', 'changeSummary'],
  additionalProperties: false,
} as const;

function cloneDays(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day) => ({
    ...day,
    items: day.items.map((item) => ({ ...item })),
  }));
}

function buildTransportContext(payload: SavedTripPayload): TransportGuidanceContext {
  return {
    location: payload.location,
    weather: payload.details.weather,
    travelTiming: payload.details.travelTiming,
    companion: payload.companion,
    budget: payload.budget,
  };
}

function applyLocalDelete(day: ItineraryDay, itemIndex: number): ItineraryDay {
  const items = day.items.filter((_, index) => index !== itemIndex);
  return { ...day, items };
}

function applyLocalReorder(day: ItineraryDay, itemIndex: number, direction: 'up' | 'down'): ItineraryDay {
  const items = [...day.items];
  const swapIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
  if (swapIndex < 0 || swapIndex >= items.length) return day;
  [items[itemIndex], items[swapIndex]] = [items[swapIndex], items[itemIndex]];
  return { ...day, items };
}

function applyLocalTimeChange(day: ItineraryDay, itemIndex: number, newTime: string): ItineraryDay {
  return {
    ...day,
    items: day.items.map((item, index) => (index === itemIndex ? { ...item, time: newTime } : item)),
  };
}

function sortDayByTime(day: ItineraryDay): ItineraryDay {
  const items = [...day.items].sort((a, b) => {
    const aMin = parseTimeToMinutes(a.time) ?? 0;
    const bMin = parseTimeToMinutes(b.time) ?? 0;
    return aMin - bMin;
  });
  return { ...day, items };
}

function postProcessDays(
  days: ItineraryDay[],
  details: PlanDetails,
  payload: SavedTripPayload,
): { days: ItineraryDay[]; details: PlanDetails } {
  const deduped = dedupeItineraryPlaces(days);
  let nextDays = deduped.days.map((day) => sortDayByTime(day));
  const transportContext = buildTransportContext(payload);

  runItineraryQualityCheck({
    days: nextDays,
    details,
    dayCount: nextDays.length,
    gourmetTour: false,
    travelTiming: payload.details.travelTiming,
    budgetScope: payload.details.budgetScope,
    transportContext,
    weather: payload.details.weather,
  });

  const duplicates = findDuplicatePlaces(nextDays);
  if (duplicates.length > 0 && __DEV__) {
    console.log('[Nanisuru PartialEdit] duplicate places remain:', duplicates.length);
  }

  return { days: nextDays, details };
}

function mergeUpdatedDay(days: ItineraryDay[], dayIndex: number, updatedDay: ItineraryDay): ItineraryDay[] {
  return days.map((day, index) => (index === dayIndex ? updatedDay : day));
}

function buildPreview(
  beforeDay: ItineraryDay,
  afterDay: ItineraryDay,
  target: ItineraryEditTarget,
  summary: string,
): ItineraryEditPreview {
  const afterItem =
    afterDay.items[target.itemIndex] ??
    afterDay.items.find((item) => item.activity !== target.item.activity) ??
    null;

  const prevItem = target.itemIndex > 0 ? afterDay.items[target.itemIndex - 1] : null;
  const nextItem = afterDay.items[target.itemIndex + 1];

  const movementFromPrev = prevItem
    ? prevItem.transportation || prevItem.travelTimeToNext || undefined
    : undefined;
  const movementToNext = afterItem
    ? afterItem.transportation || afterItem.travelTimeToNext || undefined
    : undefined;

  let budgetImpact: string | undefined;
  if (afterItem?.estimatedCost && target.item.estimatedCost) {
    if (afterItem.estimatedCost === target.item.estimatedCost) {
      budgetImpact = `概算 ${afterItem.estimatedCost}（変更なし）`;
    } else {
      budgetImpact = `${target.item.estimatedCost} → ${afterItem.estimatedCost}`;
    }
  } else if (afterItem?.estimatedCost) {
    budgetImpact = `概算 ${afterItem.estimatedCost}`;
  }

  return {
    beforeDay,
    afterDay,
    beforeItem: target.item,
    afterItem,
    summary,
    reason: afterItem?.reason ?? summary,
    movementFromPrev,
    movementToNext,
    budgetImpact,
  };
}

function buildPartialEditInstruction(params: {
  payload: SavedTripPayload;
  target: ItineraryEditTarget;
  action: ItineraryEditAction;
  userRequest: string;
  variationNote?: string;
}): string {
  const { payload, target, action, userRequest } = params;
  const day = payload.days[target.dayIndex];
  const actionGuide: Record<ItineraryEditAction, string> = {
    change_place: '指定した予定を別の場所・スポットに差し替える',
    add_before: '指定した予定の直前に新しい予定を1件追加する',
    add_after: '指定した予定の直後に新しい予定を1件追加する',
    delete: '指定した予定を削除し、前後の移動時間を調整する',
    change_time: '指定した予定の時間帯を変更し、前後の予定時刻も自然に調整する',
    reorder: '指定した予定の順番を入れ替え、移動時間と時刻を再調整する',
    ai_consult: 'ユーザーの要望に沿って指定した予定またはその前後のみを変更する',
  };

  return `あなたは旅行プランの**1件だけ**を編集するアシスタントです。
**重要**: 行程全体を再生成せず、Day ${day.dayNumber}（${day.label}）の指定予定**1件のみ**を差し替えてください。他の日・他の予定は絶対に変更しないでください。

## 旅行概要（維持）
- 目的地: ${payload.location}
- 予算: ${payload.budget} ${payload.currency}
- 人数: ${payload.people}人
- 同行者: ${payload.companion}
- 旅行スタイル: ${payload.personality}
- 気分/目的: ${payload.mood}

## 編集対象（この1件のみ）
- 日: ${day.label}（${day.theme}）
- 対象予定: ${target.item.time} ${target.item.activity}（${target.item.activityCategory ?? '未分類'}）
- 編集種別: ${actionGuide[action]}

## ユーザーの要望
${userRequest.trim() || actionGuide[action]}

${params.variationNote ? `\n## 別案\n${params.variationNote}` : ''}

## 返却内容（updatedDay 内）
- 差し替え後の item（replacement item）
- reason（選定理由）
- 必要なら前後 item の transportation / travelTimeToNext（移動メモ）
- weatherBackup（天候変化時の代替）

## 修正ルール
1. **指定した1件のみ**差し替え。それ以外の予定・時刻・順番は維持
2. 前の item → 新 item、新 item → 次の item の移動が自然になるよう transportation / travelTimeToNext を調整
3. 目的地・日程・予算・同行者・旅行目的は変更しない
4. 周辺スケジュールに馴染む時間帯・カテゴリバランスを保つ
5. 同じ店・スポットの重複を避ける
6. 実在しそうな具体的な店名・施設名を使う
7. changeSummary に変更理由を日本語1〜2文で記載

## 現在の Day ${day.dayNumber} の行程
${JSON.stringify(day, null, 2)}`;
}

function extractResponseText(data: unknown): string {
  const response = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (response.output_text?.trim()) return response.output_text.trim();
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) return part.text.trim();
    }
  }
  throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
}

async function fetchPartialDayFromAi(instruction: string): Promise<{
  updatedDay: ItineraryDay;
  changeSummary: string;
  totalBudget?: string;
}> {
  if (!isOpenAiConfigured()) {
    throw new AppError(APP_MESSAGES.openAiNotConfigured, 'OPENAI_FAILED');
  }

  const apiKey = getOpenAiApiKey()!;
  let response: Response;

  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content:
              'あなたは日本語の旅行プラン編集アシスタントです。指定された1日分の行程のみをJSONで返してください。',
          },
          { role: 'user', content: instruction },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'nanisuru_partial_day_edit',
            strict: true,
            schema: PARTIAL_DAY_SCHEMA,
          },
        },
      }),
    });
  } catch (error) {
    if (isNetworkError(error)) {
      throw new AppError(APP_MESSAGES.networkError, 'NETWORK_ERROR');
    }
    throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
  }

  if (!response.ok) {
    throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
  }

  const data = await response.json();
  const parsed = JSON.parse(extractResponseText(data)) as {
    updatedDay: ItineraryDay;
    changeSummary: string;
    totalBudget?: string;
  };

  return parsed;
}

function logReplacementDiagnostics(diagnostics: ReplacementSearchDiagnostics): void {
  if (!__DEV__) return;
  console.log('[ItineraryEdit] replacement diagnostics', {
    replacementRequestType: diagnostics.replacementRequestType,
    originalPlaceIdPresent: diagnostics.originalPlaceIdPresent,
    replacementSearchIntent: diagnostics.replacementSearchIntent,
    candidateCount: diagnostics.candidateCount,
    uniqueCandidateCount: diagnostics.uniqueCandidateCount,
    openAiUsed: diagnostics.openAiUsed,
    fallbackType: diagnostics.fallbackType,
    selectedReplacementPlaceIdPresent: diagnostics.selectedReplacementPlaceIdPresent,
    replacementApplied: diagnostics.replacementApplied,
  });
}

function replaceSingleItemInDay(
  day: ItineraryDay,
  itemIndex: number,
  nextItem: ItineraryItem,
): ItineraryDay {
  return {
    ...day,
    items: day.items.map((item, index) => (index === itemIndex ? nextItem : item)),
  };
}

/**
 * Rebuild a preview result around a user-picked Google Places candidate.
 * Only the targeted item changes; dayIndex/time stay put.
 */
export function applyReplacementCandidateSelection(params: {
  payload: SavedTripPayload;
  target: ItineraryEditTarget;
  baseResult: PartialItineraryEditResult;
  candidate: ItineraryReplacementCandidateView;
}): PartialItineraryEditResult {
  const { payload, target, baseResult, candidate } = params;
  const beforeDay = payload.days[target.dayIndex];
  if (!beforeDay) return baseResult;

  const afterItem = applyReplacementCandidateToItem(
    target.item,
    candidate,
    candidate.shortReason,
  );
  const afterDay = replaceSingleItemInDay(beforeDay, target.itemIndex, afterItem);
  // Do not rewrite other days/items — only the selected slot changes.
  const nextDays = mergeUpdatedDay(cloneDays(payload.days), target.dayIndex, afterDay);
  const summary = `「${target.item.placeName?.trim() || target.item.activity}」を「${candidate.placeName}」に変更`;
  const preview = buildPreview(beforeDay, afterDay, target, summary);

  const diagnostics: ReplacementSearchDiagnostics = {
    ...(baseResult.replacementDiagnostics ?? {
      replacementRequestType: 'custom',
      originalPlaceIdPresent: Boolean(target.item.placeId?.trim()),
      replacementSearchIntent: '',
      candidateCount: baseResult.replacementCandidates?.length ?? 0,
      uniqueCandidateCount: baseResult.replacementCandidates?.length ?? 0,
      openAiUsed: false,
      fallbackType: 'places',
      selectedReplacementPlaceIdPresent: false,
      replacementApplied: false,
    }),
    selectedReplacementPlaceIdPresent: Boolean(candidate.placeId?.trim()),
    replacementApplied: true,
    openAiUsed: false,
    fallbackType: 'places',
  };
  logReplacementDiagnostics(diagnostics);

  return {
    ...baseResult,
    days: nextDays,
    details: payload.details,
    preview: {
      ...preview,
      reason: candidate.shortReason ?? preview.reason,
    },
    replacementCandidates: baseResult.replacementCandidates,
    emptyCandidatesMessage: null,
    replacementDiagnostics: diagnostics,
    preferenceSignalDrafts: buildReplacementPreferenceSignalDrafts({
      originalPlaceIdPresent: Boolean(target.item.placeId?.trim()),
      selectedPlaceIdPresent: Boolean(candidate.placeId?.trim()),
    }),
  };
}

async function previewChangePlaceWithPlaces(params: {
  payload: SavedTripPayload;
  target: ItineraryEditTarget;
  userRequest: string;
  presetId?: ItinerarySingleEditPresetId;
}): Promise<PartialItineraryEditResult> {
  const { payload, target, userRequest, presetId } = params;
  const beforeDay = payload.days[target.dayIndex];
  if (!beforeDay) {
    throw new AppError('編集対象の日が見つかりません', 'UNKNOWN');
  }

  const fetched = await fetchReplacementPlaceCandidates({
    payload,
    target,
    userRequest,
    presetId,
  });

  if (fetched.views.length === 0) {
    const diagnostics: ReplacementSearchDiagnostics = {
      ...fetched.diagnosticsBase,
      openAiUsed: false,
      fallbackType: 'none',
      selectedReplacementPlaceIdPresent: false,
      replacementApplied: false,
    };
    logReplacementDiagnostics(diagnostics);

    return {
      days: cloneDays(payload.days),
      details: payload.details,
      preview: {
        beforeDay,
        afterDay: beforeDay,
        beforeItem: target.item,
        afterItem: null,
        summary: REPLACEMENT_NO_CANDIDATES_MESSAGE,
        reason: undefined,
      },
      replacementCandidates: [],
      emptyCandidatesMessage: REPLACEMENT_NO_CANDIDATES_MESSAGE,
      replacementDiagnostics: diagnostics,
      preferenceSignalDrafts: [],
    };
  }

  // OpenAI is optional assist only — never required for showing candidates.
  let openAiUsed = false;
  let orderedViews = fetched.views;
  try {
    if (isOpenAiConfigured() && fetched.views.length > 1) {
      // Lightweight pass: keep Places order (rating-based). A future ranking call can go here.
      // Intentionally do not call OpenAI for the whole day rewrite anymore.
      openAiUsed = false;
    }
  } catch {
    openAiUsed = false;
    orderedViews = fetched.views;
  }

  const selected = orderedViews[0];
  const afterItem = applyReplacementCandidateToItem(
    target.item,
    selected,
    selected.shortReason,
  );
  const afterDay = replaceSingleItemInDay(beforeDay, target.itemIndex, afterItem);
  // Only the selected item is rewritten — keep the rest of the itinerary intact.
  const nextDays = mergeUpdatedDay(cloneDays(payload.days), target.dayIndex, afterDay);
  const summary = `「${target.item.placeName?.trim() || target.item.activity}」を「${selected.placeName}」に変更`;
  const preview = buildPreview(beforeDay, afterDay, target, summary);

  const diagnostics: ReplacementSearchDiagnostics = {
    ...fetched.diagnosticsBase,
    openAiUsed,
    fallbackType: openAiUsed ? 'places_ranked' : 'places',
    selectedReplacementPlaceIdPresent: Boolean(selected.placeId?.trim()),
    replacementApplied: true,
  };
  logReplacementDiagnostics(diagnostics);

  if (__DEV__) {
    console.log('[ItineraryEdit] replacement result', {
      summary: preview.summary,
      beforeItem: preview.beforeItem?.activity,
      afterItem: preview.afterItem?.activity,
      candidateCount: orderedViews.length,
    });
  }

  return {
    days: nextDays,
    details: payload.details,
    preview: {
      ...preview,
      reason: selected.shortReason ?? preview.reason,
    },
    replacementCandidates: orderedViews,
    emptyCandidatesMessage: null,
    replacementDiagnostics: diagnostics,
    preferenceSignalDrafts: buildReplacementPreferenceSignalDrafts({
      originalPlaceIdPresent: Boolean(target.item.placeId?.trim()),
      selectedPlaceIdPresent: Boolean(selected.placeId?.trim()),
    }),
  };
}

export async function previewPartialItineraryEdit(params: {
  payload: SavedTripPayload;
  target: ItineraryEditTarget;
  action: ItineraryEditAction;
  userRequest: string;
  newTime?: string;
  reorderDirection?: 'up' | 'down';
  variationSeed?: number;
  presetId?: ItinerarySingleEditPresetId;
}): Promise<PartialItineraryEditResult> {
  const { payload, target, action, userRequest } = params;
  const editRequest = userRequest.trim();

  if (__DEV__) {
    console.log('[ItineraryEdit] edit request', editRequest.slice(0, 120));
  }

  const beforeDay = payload.days[target.dayIndex];
  if (!beforeDay) {
    throw new AppError('編集対象の日が見つかりません', 'UNKNOWN');
  }

  // change_place / ai_consult: Google Places first — OpenAI must not be required.
  if (action === 'change_place' || action === 'ai_consult') {
    return previewChangePlaceWithPlaces({
      payload,
      target,
      userRequest,
      presetId: params.presetId,
    });
  }

  let nextDetails = payload.details;
  let afterDay: ItineraryDay;
  let summary: string;

  if (action === 'delete') {
    afterDay = applyLocalDelete(beforeDay, target.itemIndex);
    summary = `「${target.item.activity}」を削除しました`;
  } else if (action === 'reorder' && params.reorderDirection) {
    afterDay = applyLocalReorder(beforeDay, target.itemIndex, params.reorderDirection);
    summary =
      params.reorderDirection === 'up'
        ? `「${target.item.activity}」を前へ移動しました`
        : `「${target.item.activity}」を後へ移動しました`;
  } else if (action === 'change_time' && params.newTime?.trim()) {
    afterDay = applyLocalTimeChange(beforeDay, target.itemIndex, params.newTime.trim());
    summary = `「${target.item.activity}」の時間を ${params.newTime} に変更しました`;
  } else {
    const variationNote = params.variationSeed
      ? `前回と異なる別案を提案してください（seed: ${params.variationSeed}）`
      : undefined;

    const instruction = buildPartialEditInstruction({
      payload,
      target,
      action,
      userRequest,
      variationNote,
    });

    const aiResult = await fetchPartialDayFromAi(instruction);
    afterDay = aiResult.updatedDay;
    summary = aiResult.changeSummary;

    if (aiResult.totalBudget?.trim()) {
      nextDetails = { ...nextDetails, totalBudget: aiResult.totalBudget.trim() };
    }
  }

  afterDay = sortDayByTime(afterDay);
  const nextDays = mergeUpdatedDay(cloneDays(payload.days), target.dayIndex, afterDay);
  const processed = postProcessDays(nextDays, nextDetails, payload);
  const preview = buildPreview(beforeDay, processed.days[target.dayIndex], target, summary);

  return {
    days: processed.days,
    details: processed.details,
    preview,
  };
}

export function applyPartialEditResult(
  payload: SavedTripPayload,
  result: PartialItineraryEditResult,
): SavedTripPayload {
  return {
    ...payload,
    days: result.days,
    items: flattenItineraryDays(result.days),
    details: result.details,
  };
}

export function suggestTimeShift(minutes: number, delta: number): string {
  return formatMinutesAsTime(minutes + delta);
}

export { cloneDays };
