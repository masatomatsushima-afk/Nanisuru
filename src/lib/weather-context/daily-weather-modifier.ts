/**
 * DailyWeatherModifier — trip-day weather signals for ranking / schedule / outfit.
 * Built only from WeatherContext; never invents rain/heat/cold without data.
 */

import type {
  DailyWeatherForecast,
  HourlyWeatherForecast,
  WeatherCondition,
  WeatherContext,
} from '@/types/weather-context';
import type { WeatherCategory, WeatherDayForecast, WeatherForecast } from '@/lib/weather';
import {
  createSeasonalWeatherForecast,
  formatTripDateLabel,
  getTodayIsoDate,
} from '@/lib/weather';
import {
  getWeatherUnavailableUserMessage,
  WEATHER_PLANNING_MESSAGES,
} from '@/lib/weather-planning';
import { WEATHER_RISK_THRESHOLDS as T } from './daily-weather-thresholds';
import { enumerateDateRange, finiteNumber, parseIsoDateOnly } from './weather-context-numbers';

export type RainRiskLevel = 'none' | 'low' | 'moderate' | 'high';
export type HeatRiskLevel = 'none' | 'low' | 'moderate' | 'high';
export type ColdRiskLevel = 'none' | 'low' | 'moderate' | 'high';

export type DailyWeatherModifier = {
  date: string;
  weatherAvailable: boolean;
  condition: WeatherCondition | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  maxFeelsLike: number | null;
  minFeelsLike: number | null;
  precipitationProbability: number | null;
  precipitationAmount: number | null;
  windSpeed: number | null;
  sunrise: string | null;
  sunset: string | null;
  rainRisk: RainRiskLevel;
  heatRisk: HeatRiskLevel;
  coldRisk: ColdRiskLevel;
  strongWindRisk: boolean;
  preferredIndoorRatio: number;
  /** Local hours (0–23) preferred for outdoor activities when weatherAvailable */
  preferredOutdoorHours: number[];
  /** Compact Japanese summary for Plan Detail day header */
  summaryLine: string | null;
  shortCaution: string | null;
};

export type WeatherPlanDiagnostics = {
  weatherProvider: string;
  weatherAvailable: boolean;
  weatherModifierCount: number;
  rainyDayCount: number;
  hotDayCount: number;
  coldDayCount: number;
  weatherAdjustedCandidateCount: number;
  outdoorItemsRescheduled: number;
  weatherBackupCount: number;
  outfitUsedForecast: boolean;
  fallbackType: string | null;
  unavailableReason?: string;
  requestedDateRange?: string;
  returnedDailyCount?: number;
  returnedHourlyCount?: number;
};

function levelFromScore(score: number): RainRiskLevel {
  if (score >= 3) return 'high';
  if (score >= 2) return 'moderate';
  if (score >= 1) return 'low';
  return 'none';
}

function assessRainRisk(
  precipProb: number | null,
  precipAmount: number | null,
  hourly: HourlyWeatherForecast[],
): RainRiskLevel {
  let score = 0;
  if (precipProb != null && precipProb >= T.rainProbabilityPercent) score += 2;
  else if (precipProb != null && precipProb >= T.lightRainProbabilityPercent) score += 1;
  if (precipAmount != null && precipAmount >= T.rainAmountMm) score += 2;

  const wetHours = hourly.filter((h) => {
    const p = h.precipitationProbabilityPercent;
    const a = h.precipitationAmountMm;
    return (
      (p != null && p >= T.wetHourProbabilityPercent) ||
      (a != null && a >= T.wetHourAmountMm)
    );
  }).length;
  if (wetHours >= 4) score += 2;
  else if (wetHours >= 2) score += 1;

  return levelFromScore(score);
}

function assessHeatRisk(maxFeels: number | null, maxTemp: number | null): HeatRiskLevel {
  const value = maxFeels ?? maxTemp;
  if (value == null) return 'none';
  if (value >= T.heatFeelsLikeC + 3) return 'high';
  if (value >= T.heatFeelsLikeC) return 'moderate';
  if (value >= T.warmFeelsLikeC) return 'low';
  return 'none';
}

function assessColdRisk(minFeels: number | null, minTemp: number | null): ColdRiskLevel {
  const value = minFeels ?? minTemp;
  if (value == null) return 'none';
  if (value <= T.coldFeelsLikeC - 4) return 'high';
  if (value <= T.coldFeelsLikeC) return 'moderate';
  if (value <= T.chillyFeelsLikeC) return 'low';
  return 'none';
}

function preferredOutdoorHoursForDay(params: {
  rainRisk: RainRiskLevel;
  heatRisk: HeatRiskLevel;
  coldRisk: ColdRiskLevel;
  hourly: HourlyWeatherForecast[];
}): number[] {
  const { rainRisk, heatRisk, hourly } = params;
  const hours: number[] = [];

  if (hourly.length > 0) {
    for (const h of hourly) {
      const match = h.time.match(/T(\d{2})/);
      if (!match) continue;
      const hour = Number(match[1]);
      if (!Number.isFinite(hour)) continue;
      const precip = h.precipitationProbabilityPercent ?? 0;
      const amount = h.precipitationAmountMm ?? 0;
      const feels = h.feelsLikeC ?? h.temperatureC;
      const wet =
        precip >= T.wetHourProbabilityPercent || amount >= T.wetHourAmountMm;
      const hotPeak =
        heatRisk !== 'none' &&
        hour >= T.heatAvoidHourStart &&
        hour < T.heatAvoidHourEnd &&
        feels != null &&
        feels >= T.warmFeelsLikeC;
      if (wet || hotPeak) continue;
      if (precip > T.dryHourProbabilityPercent && rainRisk !== 'none') continue;
      hours.push(hour);
    }
    if (hours.length > 0) return [...new Set(hours)].sort((a, b) => a - b);
  }

  // Fallback windows without inventing weather claims — structural preference only.
  if (heatRisk !== 'none') {
    return [7, 8, 9, T.coolOutdoorEveningStartHour, 18, 19];
  }
  if (rainRisk === 'high' || rainRisk === 'moderate') {
    return [10, 11, 14, 15];
  }
  return [9, 10, 11, 14, 15, 16];
}

function indoorRatioFor(params: {
  rainRisk: RainRiskLevel;
  heatRisk: HeatRiskLevel;
  coldRisk: ColdRiskLevel;
}): number {
  if (params.rainRisk === 'high' || params.rainRisk === 'moderate') return T.indoorRatioRain;
  if (params.heatRisk === 'high' || params.heatRisk === 'moderate') return T.indoorRatioHeat;
  if (params.coldRisk === 'high' || params.coldRisk === 'moderate') return T.indoorRatioCold;
  return T.indoorRatioFair;
}

function mapConditionToCategory(condition: WeatherCondition | null): WeatherCategory {
  const code = condition?.code ?? '';
  if (/clear|mostly_clear|sunny/.test(code)) return 'sunny';
  if (/partly_cloudy/.test(code)) return 'partly_cloudy';
  if (/cloud|fog|drizzle/.test(code)) return 'cloudy';
  if (/snow/.test(code)) return 'snow';
  if (/rain|shower|thunder|storm/.test(code)) return 'rainy';
  return 'unknown';
}

function buildSummaryLine(day: DailyWeatherForecast, rainRisk: RainRiskLevel): string | null {
  const conditionText =
    day.condition?.description?.trim() ||
    (day.condition?.code ? day.condition.code.replace(/_/g, ' ') : null);
  const max = day.temperatureMaxC;
  const min = day.temperatureMinC;
  const precip = day.precipitationProbabilityPercent;
  if (conditionText == null && max == null && min == null && precip == null) return null;

  const parts: string[] = [];
  if (conditionText) parts.push(conditionText);
  if (max != null && min != null) parts.push(`${Math.round(max)}℃ / ${Math.round(min)}℃`);
  else if (max != null) parts.push(`最高${Math.round(max)}℃`);
  if (precip != null) parts.push(`降水確率${Math.round(precip)}%`);
  if (rainRisk === 'high' || rainRisk === 'moderate') {
    // Short caution only when rain risk is data-backed
  }
  return parts.join('　');
}

function buildShortCaution(params: {
  rainRisk: RainRiskLevel;
  heatRisk: HeatRiskLevel;
  coldRisk: ColdRiskLevel;
  strongWindRisk: boolean;
}): string | null {
  if (params.rainRisk === 'high') return '雨の可能性が高めです';
  if (params.rainRisk === 'moderate') return 'にわか雨に注意';
  if (params.heatRisk === 'high' || params.heatRisk === 'moderate') return '暑さ対策を';
  if (params.coldRisk === 'high' || params.coldRisk === 'moderate') return '防寒を';
  if (params.strongWindRisk) return '強風に注意';
  return null;
}

function hoursForDate(
  hourly: HourlyWeatherForecast[],
  date: string,
): HourlyWeatherForecast[] {
  return hourly.filter((h) => h.date === date);
}

export function buildDailyWeatherModifiers(
  weatherContext: WeatherContext,
): DailyWeatherModifier[] {
  if (!weatherContext.weatherAvailable || weatherContext.daily.length === 0) {
    return [];
  }

  return weatherContext.daily.map((day) => {
    const hourly = hoursForDate(weatherContext.hourly, day.date);
    const maxFeels =
      finiteNumber(day.feelsLikeMaxC) ?? finiteNumber(day.temperatureMaxC);
    const minFeels =
      finiteNumber(day.feelsLikeMinC) ?? finiteNumber(day.temperatureMinC);
    const rainRisk = assessRainRisk(
      day.precipitationProbabilityPercent,
      day.precipitationAmountMm,
      hourly,
    );
    const heatRisk = assessHeatRisk(maxFeels, day.temperatureMaxC);
    const coldRisk = assessColdRisk(minFeels, day.temperatureMinC);
    const wind = day.windSpeedKph;
    // Daily wind may be null — check hourly max
    const hourlyWindMax = hourly.reduce<number | null>((acc, h) => {
      const w = h.windSpeedKph;
      if (w == null) return acc;
      return acc == null ? w : Math.max(acc, w);
    }, null);
    const windSpeed = wind ?? hourlyWindMax;
    const strongWindRisk = windSpeed != null && windSpeed >= T.strongWindKph;

    return {
      date: day.date,
      weatherAvailable: true,
      condition: day.condition,
      minTemperature: day.temperatureMinC,
      maxTemperature: day.temperatureMaxC,
      maxFeelsLike: maxFeels,
      minFeelsLike: minFeels,
      precipitationProbability: day.precipitationProbabilityPercent,
      precipitationAmount: day.precipitationAmountMm,
      windSpeed,
      sunrise: day.sunrise,
      sunset: day.sunset,
      rainRisk,
      heatRisk,
      coldRisk,
      strongWindRisk,
      preferredIndoorRatio: indoorRatioFor({ rainRisk, heatRisk, coldRisk }),
      preferredOutdoorHours: preferredOutdoorHoursForDay({
        rainRisk,
        heatRisk,
        coldRisk,
        hourly,
      }),
      summaryLine: buildSummaryLine(day, rainRisk),
      shortCaution: buildShortCaution({
        rainRisk,
        heatRisk,
        coldRisk,
        strongWindRisk,
      }),
    };
  });
}

export function aggregateWeatherFitFromModifiers(modifiers: DailyWeatherModifier[]): {
  preferIndoor: boolean;
  preferOutdoor: boolean;
  rainRisk: boolean;
  heatRisk: boolean;
  coldRisk: boolean;
} {
  if (modifiers.length === 0) {
    return {
      preferIndoor: false,
      preferOutdoor: false,
      rainRisk: false,
      heatRisk: false,
      coldRisk: false,
    };
  }
  const rainRisk = modifiers.some((m) => m.rainRisk === 'high' || m.rainRisk === 'moderate');
  const heatRisk = modifiers.some((m) => m.heatRisk === 'high' || m.heatRisk === 'moderate');
  const coldRisk = modifiers.some((m) => m.coldRisk === 'high' || m.coldRisk === 'moderate');
  const preferIndoor =
    rainRisk ||
    heatRisk ||
    coldRisk ||
    modifiers.some((m) => m.preferredIndoorRatio >= 0.55);
  const preferOutdoor =
    !preferIndoor &&
    modifiers.every((m) => m.rainRisk === 'none' || m.rainRisk === 'low') &&
    modifiers.some((m) => m.preferredIndoorRatio <= T.indoorRatioFair);
  return { preferIndoor, preferOutdoor, rainRisk, heatRisk, coldRisk };
}

/**
 * Convert WeatherContext + modifiers → legacy WeatherForecast for prompts / existing UI.
 */
export function weatherContextToLegacyForecast(params: {
  weatherContext: WeatherContext;
  modifiers: DailyWeatherModifier[];
  locationName: string;
  tripDate?: string;
}): WeatherForecast {
  const { weatherContext, modifiers, locationName } = params;
  const tripDate = params.tripDate || getTodayIsoDate();

  if (!weatherContext.weatherAvailable || modifiers.length === 0) {
    const seasonalBase = createSeasonalWeatherForecast(locationName, tripDate);
    const reason = weatherContext.unavailableReason;
    const userMessage = getWeatherUnavailableUserMessage(reason);

    // Mild seasonal label only — no outfit/rain copy (outfit section owns clothing).
    const safeSeasonalContext = seasonalBase.seasonalContext
      ? {
          ...seasonalBase.seasonalContext,
          guidance: `${seasonalBase.seasonalContext.monthLabel}（${seasonalBase.seasonalContext.seasonLabel}）の一般的な傾向です。`,
          // Strip rain/umbrella/waterproof assertions — never surface in weather card.
          outfitAdvice: '',
          riskNotes: [],
        }
      : undefined;

    return {
      available: false,
      locationName,
      location: seasonalBase.location,
      searchLocation: seasonalBase.searchLocation,
      planningMode: reason === 'outside_forecast_range' ? 'seasonal' : 'unavailable',
      planningMessage: userMessage,
      rescheduleNote:
        reason === 'outside_forecast_range'
          ? WEATHER_PLANNING_MESSAGES.rescheduleNote
          : undefined,
      seasonalContext: safeSeasonalContext,
      days: [],
      summary: userMessage,
      hasRainExpected: false,
      isMostlySunny: false,
      temperature: null,
      minTemperature: null,
      maxTemperature: null,
      rainChance: null,
      condition: 'unknown',
      unavailableReason: reason,
    };
  }

  const days: WeatherDayForecast[] = modifiers.map((m) => {
    const category = mapConditionToCategory(m.condition);
    const preferIndoor =
      m.rainRisk === 'high' ||
      m.rainRisk === 'moderate' ||
      m.preferredIndoorRatio >= 0.55;
    const preferOutdoor =
      !preferIndoor &&
      (m.rainRisk === 'none' || m.rainRisk === 'low') &&
      m.heatRisk !== 'high';

    const conditionText =
      m.condition?.description ?? m.condition?.code?.replace(/_/g, ' ') ?? '天気';
    const max = m.maxTemperature ?? m.maxFeelsLike;
    const min = m.minTemperature ?? m.minFeelsLike;
    const precip = m.precipitationProbability;
    const summaryParts: string[] = [];
    if (max != null && min != null) {
      summaryParts.push(`最高${Math.round(max)}℃ / 最低${Math.round(min)}℃`);
    } else if (max != null) {
      summaryParts.push(`最高${Math.round(max)}℃`);
    }
    if (precip != null) summaryParts.push(`降水確率${Math.round(precip)}%`);

    return {
      date: m.date,
      label: formatTripDateLabel(m.date),
      condition: conditionText,
      category,
      temperatureMax: Math.round(max ?? 0),
      temperatureMin: Math.round(min ?? 0),
      feelsLikeMax: m.maxFeelsLike != null ? Math.round(m.maxFeelsLike) : null,
      feelsLikeMin: m.minFeelsLike != null ? Math.round(m.minFeelsLike) : null,
      precipitationProbability: Math.round(precip ?? 0),
      preferIndoor,
      preferOutdoor,
      summary: summaryParts.join('　'),
    };
  });

  const hasRainExpected = modifiers.some(
    (m) => m.rainRisk === 'high' || m.rainRisk === 'moderate',
  );
  const first = days[0];

  return {
    available: true,
    locationName,
    planningMode: 'forecast',
    planningMessage: undefined,
    rescheduleNote: undefined,
    seasonalContext: undefined,
    days,
    // Keep summary short — UI shows per-day rows, not a long intro.
    summary: `${days.length}日間の予報`,
    hasRainExpected,
    isMostlySunny: days.every((d) => d.preferOutdoor),
    temperature: first?.temperatureMax ?? null,
    minTemperature: first?.temperatureMin ?? null,
    maxTemperature: first?.temperatureMax ?? null,
    rainChance: first?.precipitationProbability ?? null,
    condition: first?.category,
  };
}

export function emptyWeatherPlanDiagnostics(
  overrides?: Partial<WeatherPlanDiagnostics>,
): WeatherPlanDiagnostics {
  return {
    weatherProvider: 'none',
    weatherAvailable: false,
    weatherModifierCount: 0,
    rainyDayCount: 0,
    hotDayCount: 0,
    coldDayCount: 0,
    weatherAdjustedCandidateCount: 0,
    outdoorItemsRescheduled: 0,
    weatherBackupCount: 0,
    outfitUsedForecast: false,
    fallbackType: null,
    ...overrides,
  };
}

export function buildWeatherPlanDiagnostics(params: {
  weatherContext: WeatherContext;
  modifiers: DailyWeatherModifier[];
  weatherAdjustedCandidateCount?: number;
  outdoorItemsRescheduled?: number;
  weatherBackupCount?: number;
  outfitUsedForecast?: boolean;
  fallbackType?: string | null;
  requestedDateRange?: string;
}): WeatherPlanDiagnostics {
  return {
    weatherProvider: params.weatherContext.provider,
    weatherAvailable: params.weatherContext.weatherAvailable,
    weatherModifierCount: params.modifiers.length,
    rainyDayCount: params.modifiers.filter(
      (m) => m.rainRisk === 'high' || m.rainRisk === 'moderate',
    ).length,
    hotDayCount: params.modifiers.filter(
      (m) => m.heatRisk === 'high' || m.heatRisk === 'moderate',
    ).length,
    coldDayCount: params.modifiers.filter(
      (m) => m.coldRisk === 'high' || m.coldRisk === 'moderate',
    ).length,
    weatherAdjustedCandidateCount: params.weatherAdjustedCandidateCount ?? 0,
    outdoorItemsRescheduled: params.outdoorItemsRescheduled ?? 0,
    weatherBackupCount: params.weatherBackupCount ?? 0,
    outfitUsedForecast: params.outfitUsedForecast ?? false,
    fallbackType: params.fallbackType ?? null,
    unavailableReason: params.weatherContext.unavailableReason,
    requestedDateRange: params.requestedDateRange,
    returnedDailyCount: params.weatherContext.daily.length,
    returnedHourlyCount: params.weatherContext.hourly.length,
  };
}

export function assignDatesToItineraryDays<T extends { date?: string }>(
  days: T[],
  startDate: string,
): Array<T & { date: string }> {
  const start = parseIsoDateOnly(startDate);
  if (!start) {
    return days.map((d, i) => ({
      ...d,
      date: d.date?.trim() || `day-${i + 1}`,
    }));
  }
  const range = enumerateDateRange(
    start,
    // enough days for the itinerary length
    (() => {
      const end = new Date(`${start}T12:00:00`);
      end.setDate(end.getDate() + Math.max(0, days.length - 1));
      const y = end.getFullYear();
      const m = String(end.getMonth() + 1).padStart(2, '0');
      const day = String(end.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })(),
  );
  return days.map((d, i) => ({
    ...d,
    date: d.date?.trim() || range[i] || start,
  }));
}

export function findModifierForDate(
  modifiers: DailyWeatherModifier[],
  date: string | undefined,
): DailyWeatherModifier | null {
  if (!date) return null;
  return modifiers.find((m) => m.date === date) ?? null;
}
