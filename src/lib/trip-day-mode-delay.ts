import { generatePlanWithAi } from '@/lib/generate-plan';
import { flattenItineraryDays } from '@/lib/trip-duration';
import { getTodayIsoDate } from '@/lib/weather';
import type { ItineraryDay, PlanDetails } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type { TripDayDelayPreview } from '@/types/trip-day-mode';

export const TRIP_DAY_DELAY_ERRORS = {
  aiFailed: '遅れに合わせた調整案の作成に失敗しました。旅行秘書に相談することもできます。',
  emptyDay: '調整できる予定がありません。',
} as const;

function buildDelayInstruction(
  payload: SavedTripPayload,
  dayIndex: number,
  delayMinutes: number,
): string {
  const day = payload.days[dayIndex];
  const dayLabel = day?.label ?? `${dayIndex + 1}日目`;

  return (
    `ユーザーは旅行当日に**${delayMinutes}分の遅れ**が発生しています。\n` +
    `対象: **${dayLabel}**（${payload.location}）\n\n` +
    '### 調整方針\n' +
    '- スキップ（1件削減）\n' +
    '- 滞在時間の短縮\n' +
    '- 順序の入れ替え\n' +
    '- 近くのスポットへの差し替え\n' +
    'などを組み合わせ、**残りの時間で無理のない行程**にしてください。\n\n' +
    '### 必ず守ること\n' +
    '- **今日の日（対象日）だけ**を調整し、他の日は変更しない\n' +
    '- 目的地・予算・同行者・旅行スタイルは維持\n' +
    '- 移動負担を増やしすぎない\n' +
    '- 変更理由を changeSummary に日本語で簡潔に記載\n' +
    '- 変更点を highlights または plannerMessage に2〜5件、具体的に記載'
  );
}

function mergeDelayDayPayload(
  base: SavedTripPayload,
  generated: { days: ItineraryDay[]; details: PlanDetails },
  dayIndex: number,
  changeSummary: string,
): SavedTripPayload {
  const nextDays = base.days.map((day, index) =>
    index === dayIndex ? (generated.days[dayIndex] ?? generated.days[0] ?? day) : day,
  );

  return {
    ...base,
    days: nextDays,
    items: flattenItineraryDays(nextDays),
    details: {
      ...base.details,
      ...generated.details,
      tripDate: base.details.tripDate ?? generated.details.tripDate,
      tripEndDate: base.details.tripEndDate ?? generated.details.tripEndDate,
      tripDuration: base.tripDuration,
      plannerMessage: changeSummary || generated.details.plannerMessage,
    },
  };
}

function extractChangePoints(
  beforeDay: ItineraryDay,
  afterDay: ItineraryDay,
  fallbackSummary: string,
): string[] {
  const points: string[] = [];
  const beforeNames = new Set(beforeDay.items.map((item) => item.activity));
  const afterNames = new Set(afterDay.items.map((item) => item.activity));

  for (const item of beforeDay.items) {
    if (!afterNames.has(item.activity)) {
      points.push(`「${item.activity}」をスキップまたは差し替え`);
    }
  }

  for (const item of afterDay.items) {
    if (!beforeNames.has(item.activity)) {
      points.push(`「${item.activity}」を追加`);
    }
  }

  for (let index = 0; index < Math.min(beforeDay.items.length, afterDay.items.length); index += 1) {
    const before = beforeDay.items[index];
    const after = afterDay.items[index];
    if (before.activity === after.activity && before.time !== after.time) {
      points.push(`「${after.activity}」の時間を ${before.time} → ${after.time} に調整`);
    }
  }

  if (!points.length && fallbackSummary.trim()) {
    points.push(fallbackSummary.trim());
  }

  return points.slice(0, 6);
}

export async function previewDelayAdjustment(
  payload: SavedTripPayload,
  dayIndex: number,
  delayMinutes: number,
): Promise<TripDayDelayPreview> {
  const beforeDay = payload.days[dayIndex];
  if (!beforeDay?.items?.length) {
    return { success: false, errorMessage: TRIP_DAY_DELAY_ERRORS.emptyDay };
  }

  const tripDate = payload.details.tripDate ?? getTodayIsoDate();

  try {
    const generated = await generatePlanWithAi({
      location: payload.location,
      budget: payload.budget,
      currency: payload.currency,
      people: payload.people,
      companion: payload.companion,
      personality: payload.personality,
      tripDuration: payload.tripDuration,
      tripDate,
      tripEndDate: payload.details.tripEndDate,
      customDuration: payload.customDuration,
      mood: payload.mood,
      customPreferences: payload.customPreferences,
      budgetScope: payload.details.budgetScope,
      travelTiming: payload.details.travelTiming,
      planAdjustment: {
        instruction: buildDelayInstruction(payload, dayIndex, delayMinutes),
        baseDays: payload.days,
        baseDetails: payload.details,
        notes: payload.notes,
      },
    });

    const afterDay = generated.days[dayIndex] ?? generated.days[0];
    if (!afterDay) {
      return { success: false, errorMessage: TRIP_DAY_DELAY_ERRORS.aiFailed };
    }

    const changeSummary =
      generated.details.plannerMessage?.trim() ||
      `${delayMinutes}分の遅れに合わせて${beforeDay.label}の行程を調整しました`;

    const afterPayload = mergeDelayDayPayload(payload, generated, dayIndex, changeSummary);
    const changePoints = extractChangePoints(beforeDay, afterDay, changeSummary);

    return {
      success: true,
      beforePayload: payload,
      afterPayload,
      dayIndex,
      changeSummary,
      changePoints,
    };
  } catch (error) {
    console.warn('[TripDayMode] delay preview failed', error);
    return { success: false, errorMessage: TRIP_DAY_DELAY_ERRORS.aiFailed };
  }
}
