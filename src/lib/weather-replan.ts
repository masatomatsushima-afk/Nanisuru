import { generatePlanWithAi } from '@/lib/generate-plan';
import { flattenItineraryDays } from '@/lib/trip-duration';
import {
  FORECAST_HORIZON_DAYS,
  getDaysUntilDeparture,
  WEATHER_PLANNING_MESSAGES,
} from '@/lib/weather-planning';
import { getTodayIsoDate, resolveWeatherForTrip, type WeatherForecast } from '@/lib/weather';
import type { ItineraryDay, PlanDetails } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type { WeatherReplanEligibility, WeatherReplanPreview } from '@/types/weather-replan';

export const WEATHER_REPLAN_ERRORS = {
  fetchFailed: '最新の天気を取得できませんでした。現在のプランのまま利用できます。',
  noForecast: '最新の天気予報がまだ利用できません。出発が近づいてから再度お試しください。',
  aiFailed: '天気に合わせた再調整に失敗しました。現在のプランのまま利用できます。',
} as const;

function resolveStoredPlanningMode(weather?: WeatherForecast) {
  if (weather?.planningMode) return weather.planningMode;
  if (weather?.seasonalContext) return 'seasonal' as const;
  if (weather?.available === false) return 'unavailable' as const;
  return 'forecast' as const;
}

function wasOriginallySeasonalGuidance(weather?: WeatherForecast): boolean {
  const mode = resolveStoredPlanningMode(weather);
  return mode === 'seasonal' || mode === 'unavailable' || Boolean(weather?.seasonalContext);
}

/** Decide whether to show re-plan button or future note. */
export function getWeatherReplanEligibility(
  tripDate: string | undefined,
  weather?: WeatherForecast,
): WeatherReplanEligibility {
  if (!tripDate?.trim()) {
    return { status: 'hidden' };
  }

  const daysUntil = getDaysUntilDeparture(tripDate);

  if (daysUntil > FORECAST_HORIZON_DAYS) {
    return {
      status: 'future',
      message: WEATHER_PLANNING_MESSAGES.rescheduleNote,
    };
  }

  return {
    status: 'ready',
    highlight: wasOriginallySeasonalGuidance(weather),
    daysUntil,
  };
}

export function buildWeatherReplanInstruction(
  previousWeather: WeatherForecast | undefined,
  freshWeather: WeatherForecast,
): string {
  const previousMode = previousWeather ? resolveStoredPlanningMode(previousWeather) : 'seasonal';
  const daySummaries = freshWeather.days
    .map((day) => {
      const hint = day.preferIndoor
        ? '（屋内優先）'
        : day.preferOutdoor
          ? '（屋外可）'
          : '';
      return `- ${day.label}: ${day.condition}・降水${day.precipitationProbability}%${hint}`;
    })
    .join('\n');

  return (
    '最新の天気予報に合わせて、ベースプランを**最小限の変更**で再調整してください。\n\n' +
    `### 以前の天候コンテキスト\nモード: ${previousMode}\n` +
    `${previousWeather?.summary ?? '季節傾向ベースで作成'}\n\n` +
    `### 最新の天気予報（${freshWeather.locationName}）\n${freshWeather.summary}\n\n` +
    `### 日別予報\n${daySummaries}\n\n` +
    '### 必ず守ること\n' +
    '- 目的地・日程・予算・同行者・旅行スタイル・必須スポットは**変更しない**\n' +
    '- 既存プランの良いスポットは**できるだけ維持**し、全体を作り直さない\n' +
    '- 変更が必要なのは主に: 屋外スポット、徒歩多めルート、服装アドバイス、屋内代替案、日順の微調整\n' +
    '- conciergeAnalysis.weather（天気・季節メモ）、outfitAdvice相当の服装、rainyDayAlternatives、各 item の weatherBackup を更新\n' +
    '- weatherReplanChanges に**変更したポイント**を2〜6件、日本語で具体的に記載\n' +
    '  例: 「雨予報のため、午後の屋外散歩を美術館に変更しました」\n' +
    '- 移動の注意点（雨・暑さ・寒さ）があれば plannerMessage か highlights に含める\n' +
    '- 出発前に再確認すべき点があれば plannerMessage に含める'
  );
}

function buildFallbackChangePoints(
  before: SavedTripPayload,
  after: SavedTripPayload,
  freshWeather: WeatherForecast,
): string[] {
  const points: string[] = [];

  for (const afterDay of after.days) {
    const beforeDay = before.days.find((day) => day.dayNumber === afterDay.dayNumber);
    if (!beforeDay) continue;

    const maxLen = Math.max(beforeDay.items.length, afterDay.items.length);
    for (let index = 0; index < maxLen; index += 1) {
      const beforeItem = beforeDay.items[index];
      const afterItem = afterDay.items[index];
      if (beforeItem && afterItem && beforeItem.activity !== afterItem.activity) {
        points.push(
          `${afterDay.label}の「${beforeItem.activity}」を「${afterItem.activity}」に変更しました`,
        );
      }
    }
  }

  if (freshWeather.hasRainExpected) {
    points.push('雨の可能性を考えて、屋内候補と代替案を強化しました');
  }

  const maxTemp = Math.max(...freshWeather.days.map((day) => day.temperatureMax), 0);
  if (maxTemp >= 30) {
    points.push('気温が高いため、昼間は屋内休憩を多めにしました');
  }

  const minTemp = Math.min(...freshWeather.days.map((day) => day.temperatureMin), 99);
  if (minTemp <= 8) {
    points.push('夜は冷えるため、服装アドバイスを更新しました');
  }

  if (points.length === 0) {
    points.push('最新の天気予報に合わせて、天候メモ・服装・代替案を更新しました');
  }

  return points.slice(0, 6);
}

function mergeReplanPayload(
  base: SavedTripPayload,
  generated: { days: ItineraryDay[]; items: import('@/types/plan').ItineraryItem[]; details: PlanDetails },
  freshWeather: WeatherForecast,
): SavedTripPayload {
  return {
    ...base,
    days: generated.days,
    items: flattenItineraryDays(generated.days),
    details: {
      ...base.details,
      ...generated.details,
      tripDate: base.details.tripDate ?? generated.details.tripDate,
      tripEndDate: base.details.tripEndDate ?? generated.details.tripEndDate,
      tripDuration: base.tripDuration,
      customDuration: base.customDuration,
      budgetScope: base.details.budgetScope ?? generated.details.budgetScope,
      travelTiming: base.details.travelTiming ?? generated.details.travelTiming,
      preTripPlanning: base.details.preTripPlanning ?? generated.details.preTripPlanning,
      weather: freshWeather,
      weatherReplanChanges: generated.details.weatherReplanChanges,
    },
  };
}

export async function previewWeatherReplan(payload: SavedTripPayload): Promise<WeatherReplanPreview> {
  const tripDate = payload.details.tripDate ?? getTodayIsoDate();

  let freshWeather: WeatherForecast;
  try {
    freshWeather = await resolveWeatherForTrip({
      location: payload.location,
      startDate: tripDate,
      tripDuration: payload.tripDuration,
      endDate: payload.details.tripEndDate,
      customDuration: payload.customDuration,
    });
  } catch (error) {
    console.warn('[WeatherReplan] weather fetch failed', error);
    return { success: false, errorMessage: WEATHER_REPLAN_ERRORS.fetchFailed };
  }

  if (!freshWeather.available || freshWeather.planningMode !== 'forecast') {
    return { success: false, errorMessage: WEATHER_REPLAN_ERRORS.noForecast };
  }

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
      weatherReplan: {
        baseDays: payload.days,
        baseDetails: payload.details,
        previousWeather: payload.details.weather,
      },
      planAdjustment: {
        instruction: buildWeatherReplanInstruction(payload.details.weather, freshWeather),
        baseDays: payload.days,
        baseDetails: { ...payload.details, weather: freshWeather },
        notes: payload.notes,
      },
    });

    const afterPayload = mergeReplanPayload(payload, generated, freshWeather);
    const changePoints =
      afterPayload.details.weatherReplanChanges?.filter(Boolean) ??
      buildFallbackChangePoints(payload, afterPayload, freshWeather);

    return {
      success: true,
      beforePayload: payload,
      afterPayload: {
        ...afterPayload,
        details: {
          ...afterPayload.details,
          weatherReplanChanges: changePoints,
        },
      },
      freshWeather,
      previousWeather: payload.details.weather,
      changePoints,
    };
  } catch (error) {
    console.warn('[WeatherReplan] AI replan failed', error);
    return { success: false, errorMessage: WEATHER_REPLAN_ERRORS.aiFailed };
  }
}

export function applyWeatherReplanPreview(preview: Extract<WeatherReplanPreview, { success: true }>): SavedTripPayload {
  return preview.afterPayload;
}
