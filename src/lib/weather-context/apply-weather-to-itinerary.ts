/**
 * Post-process itinerary with DailyWeatherModifier:
 * - soft-reschedule outdoor items toward drier/cooler hours
 * - attach weatherBackup only when rain is data-backed
 * - strip forbidden weather copy
 * Never invent spots; never break arrival/departure windows when provided.
 */

import type { HourlyWeatherForecast, WeatherContext } from '@/types/weather-context';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import {
  assignDatesToItineraryDays,
  findModifierForDate,
  type DailyWeatherModifier,
} from './daily-weather-modifier';
import { WEATHER_RISK_THRESHOLDS as T } from './daily-weather-thresholds';

const FORBIDDEN_BACKUP_PATTERNS = [
  /天気に関わらず楽しめます/,
  /天候に関わらず楽しめます/,
  /天候に関わらず可/,
  /天気に関わらず/,
  /天候に関わらず/,
  /念のため傘/,
  /雨かもしれません/,
];

const OUTDOOR_ACTIVITY_CATEGORIES = new Set(['散歩', '景色', '体験', '夜景']);

export type ApplyWeatherToItineraryResult = {
  days: ItineraryDay[];
  rainyDayAlternatives: string[];
  outdoorItemsRescheduled: number;
  weatherBackupCount: number;
};

function parseTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isOutdoorItem(item: ItineraryItem): boolean {
  if (item.activityCategory && OUTDOOR_ACTIVITY_CATEGORIES.has(item.activityCategory)) {
    return true;
  }
  if (item.category === 'sightseeing' || item.category === 'activity') {
    // Conservative: treat sightseeing as possibly outdoor only for backup/reschedule soft path.
    return true;
  }
  return false;
}

function isForbiddenBackup(text: string | undefined): boolean {
  if (!text?.trim()) return true;
  return FORBIDDEN_BACKUP_PATTERNS.some((p) => p.test(text));
}

function sunsetHour(sunset: string | null): number | null {
  if (!sunset) return null;
  const match = sunset.match(/T(\d{2})/);
  if (match) return Number(match[1]);
  const local = sunset.match(/(\d{2}):(\d{2})/);
  if (local) return Number(local[1]);
  return null;
}

function hourPrecipScore(
  hourly: HourlyWeatherForecast[],
  date: string,
  hour: number,
): number {
  const slots = hourly.filter((h) => {
    if (h.date !== date) return false;
    const m = h.time.match(/T(\d{2})/);
    return m ? Number(m[1]) === hour : false;
  });
  if (slots.length === 0) return 50; // unknown — neutral
  return Math.max(
    ...slots.map((s) => s.precipitationProbabilityPercent ?? 0),
  );
}

function hourHeatScore(
  hourly: HourlyWeatherForecast[],
  date: string,
  hour: number,
): number {
  const slots = hourly.filter((h) => {
    if (h.date !== date) return false;
    const m = h.time.match(/T(\d{2})/);
    return m ? Number(m[1]) === hour : false;
  });
  if (slots.length === 0) return 0;
  return Math.max(
    ...slots.map((s) => s.feelsLikeC ?? s.temperatureC ?? 0),
  );
}

function pickBetterHour(params: {
  currentMinutes: number;
  modifier: DailyWeatherModifier;
  hourly: HourlyWeatherForecast[];
  earliestMinutes: number | null;
  latestMinutes: number | null;
  isNightView: boolean;
}): number | null {
  const {
    currentMinutes,
    modifier,
    hourly,
    earliestMinutes,
    latestMinutes,
    isNightView,
  } = params;
  const currentHour = Math.floor(currentMinutes / 60);
  const preferred = new Set(modifier.preferredOutdoorHours);

  let bestHour: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let hour = 7; hour <= 21; hour += 1) {
    if (isNightView) {
      const sunsetH = sunsetHour(modifier.sunset);
      if (sunsetH != null && hour < sunsetH) continue;
      if (sunsetH == null && hour < 18) continue;
    }
    const candidateMinutes = hour * 60 + (currentMinutes % 60);
    if (earliestMinutes != null && candidateMinutes < earliestMinutes) continue;
    if (latestMinutes != null && candidateMinutes > latestMinutes) continue;

    const precip = hourPrecipScore(hourly, modifier.date, hour);
    const heat = hourHeatScore(hourly, modifier.date, hour);
    let score = precip;
    if (modifier.heatRisk !== 'none' && hour >= T.heatAvoidHourStart && hour < T.heatAvoidHourEnd) {
      score += 30;
    }
    if (heat >= T.heatFeelsLikeC) score += 20;
    if (preferred.has(hour)) score -= 15;
    // Prefer staying close to original when scores similar
    score += Math.abs(hour - currentHour) * 2;

    if (score < bestScore) {
      bestScore = score;
      bestHour = hour;
    }
  }

  if (bestHour == null || bestHour === currentHour) return null;
  const currentPrecip = hourPrecipScore(hourly, modifier.date, currentHour);
  if (bestScore >= currentPrecip - 5 && modifier.rainRisk === 'none' && modifier.heatRisk === 'none') {
    return null;
  }
  return bestHour * 60 + (currentMinutes % 60);
}

function buildRainBackup(item: ItineraryItem, modifier: DailyWeatherModifier): string | null {
  if (!isOutdoorItem(item)) return null;
  if (modifier.rainRisk !== 'high' && modifier.rainRisk !== 'moderate') return null;
  const precip = modifier.precipitationProbability;
  const timeHint =
    modifier.preferredOutdoorHours.length > 0
      ? `${modifier.preferredOutdoorHours[0]}時前後`
      : '雨の弱い時間帯';
  if (precip != null && precip >= T.rainProbabilityPercent) {
    return `降水確率${Math.round(precip)}%のため、同じエリアの屋内施設（カフェ・商業施設・博物館など）へ変更できます。雨が弱いなら${timeHint}の屋外も検討できます。`;
  }
  return `雨の可能性が高いため、近くの屋内施設を代替候補として用意しています。`;
}

function sanitizeBackup(text: string | undefined): string | undefined {
  if (!text?.trim()) return undefined;
  if (isForbiddenBackup(text)) return undefined;
  return text.trim();
}

export function applyWeatherToItinerary(params: {
  days: ItineraryDay[];
  modifiers: DailyWeatherModifier[];
  weatherContext: WeatherContext;
  tripStartDate: string;
  rainyDayAlternatives?: string[];
  earliestActivityMinutes?: number | null;
  latestActivityMinutes?: number | null;
}): ApplyWeatherToItineraryResult {
  const {
    modifiers,
    weatherContext,
    tripStartDate,
    earliestActivityMinutes = null,
    latestActivityMinutes = null,
  } = params;

  let outdoorItemsRescheduled = 0;
  let weatherBackupCount = 0;

  if (!weatherContext.weatherAvailable || modifiers.length === 0) {
    // Strip forbidden backups; do not invent weather backups.
    const cleanedDays = params.days.map((day) => ({
      ...day,
      items: day.items.map((item) => ({
        ...item,
        weatherBackup: sanitizeBackup(item.weatherBackup),
      })),
    }));
    return {
      days: cleanedDays,
      rainyDayAlternatives: [],
      outdoorItemsRescheduled: 0,
      weatherBackupCount: 0,
    };
  }

  const datedDays = assignDatesToItineraryDays(params.days, tripStartDate);
  const hourly = weatherContext.hourly;

  const nextDays: ItineraryDay[] = datedDays.map((day) => {
    const modifier = findModifierForDate(modifiers, day.date);
    const items = day.items.map((item) => {
      let next: ItineraryItem = {
        ...item,
        weatherBackup: sanitizeBackup(item.weatherBackup),
      };

      if (!modifier) return next;

      const minutes = parseTimeToMinutes(item.time);
      const outdoor = isOutdoorItem(item);
      const isNightView =
        item.activityCategory === '夜景' || /夜景|night view/i.test(item.activity);

      if (outdoor && minutes != null) {
        const better = pickBetterHour({
          currentMinutes: minutes,
          modifier,
          hourly,
          earliestMinutes: earliestActivityMinutes,
          latestMinutes: latestActivityMinutes,
          isNightView,
        });
        if (better != null && better !== minutes) {
          next = { ...next, time: formatMinutes(better) };
          outdoorItemsRescheduled += 1;
        }
      }

      // Night view must not be scheduled before sunset when sunset is known.
      if (isNightView && minutes != null) {
        const sunsetH = sunsetHour(modifier.sunset);
        if (sunsetH != null && Math.floor(minutes / 60) < sunsetH) {
          const adjusted = Math.max(minutes, sunsetH * 60 + 15);
          if (latestActivityMinutes == null || adjusted <= latestActivityMinutes) {
            next = { ...next, time: formatMinutes(adjusted) };
            outdoorItemsRescheduled += 1;
          }
        }
      }

      const backup = buildRainBackup(next, modifier);
      if (backup) {
        next = { ...next, weatherBackup: backup };
        weatherBackupCount += 1;
      } else if (next.weatherBackup && isForbiddenBackup(next.weatherBackup)) {
        next = { ...next, weatherBackup: undefined };
      }

      return next;
    });

    // Keep chronological order after soft reschedule
    items.sort((a, b) => {
      const am = parseTimeToMinutes(a.time) ?? 0;
      const bm = parseTimeToMinutes(b.time) ?? 0;
      return am - bm;
    });

    return {
      ...day,
      date: day.date,
      items,
    };
  });

  const hasRainyDay = modifiers.some(
    (m) => m.rainRisk === 'high' || m.rainRisk === 'moderate',
  );
  const rainyDayAlternatives = hasRainyDay
    ? (params.rainyDayAlternatives ?? [])
        .map((line) => line.trim())
        .filter((line) => line && !isForbiddenBackup(line))
        .slice(0, 5)
    : [];

  // If rainy and no alternatives provided, add one soft data-backed line (no fake spots).
  if (hasRainyDay && rainyDayAlternatives.length === 0) {
    rainyDayAlternatives.push(
      '降水確率が高い時間帯は、同じエリアの屋内施設（カフェ・商業施設・博物館など）へ切り替えると安心です。',
    );
  }

  return {
    days: nextDays,
    rainyDayAlternatives,
    outdoorItemsRescheduled,
    weatherBackupCount,
  };
}
