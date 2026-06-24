import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildFavoriteTitle } from '@/lib/favorites-storage';
import { COMPANION_SUBTITLES, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { flattenItineraryDays } from '@/lib/trip-duration';
import { formatTripDateLabel } from '@/lib/weather';
import type { CurrencyCode } from '@/constants/currency';
import type {
  CompanionOption,
  ItineraryDay,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';
import type { ActiveTripContext } from '@/types/travel-secretary';

const STORAGE_KEY = 'nanisuru_active_trip';

export function buildActiveTripContext(input: {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  days: ItineraryDay[];
  details: PlanDetails;
}): ActiveTripContext {
  return {
    title: buildFavoriteTitle(
      input.location,
      input.personality,
      input.companion,
      input.tripDuration,
    ),
    location: input.location.trim() || '未指定',
    budget: input.budget,
    currency: input.currency,
    people: input.people,
    mood: input.mood,
    companion: input.companion,
    personality: input.personality,
    tripDuration: input.tripDuration,
    days: input.days,
    details: input.details,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveActiveTrip(trip: ActiveTripContext): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
}

export async function getActiveTrip(): Promise<ActiveTripContext | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ActiveTripContext;
    if (!parsed.days || parsed.days.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Structured trip brief injected into every secretary prompt turn. */
export function buildSecretaryTripBrief(trip: ActiveTripContext): string {
  const { details } = trip;
  const items = flattenItineraryDays(trip.days);

  const budgetSection = [
    `入力予算: ${trip.budget || '未指定'} ${trip.currency}`,
    `合計目安: ${details.totalBudget}`,
    details.budgetBreakdown
      ? [
          `  宿泊: ${details.budgetBreakdown.accommodation}`,
          `  食事: ${details.budgetBreakdown.food}`,
          `  交通: ${details.budgetBreakdown.transportation}`,
          `  アクティビティ: ${details.budgetBreakdown.activity}`,
        ].join('\n')
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const weatherSection = details.weather
    ? `天気: ${details.weather.summary}\n${details.weather.days.map((d) => `- ${d.label}: ${d.condition}（${d.summary}）`).join('\n')}`
    : '天気: データなし';

  const strategySection = details.conciergeAnalysis?.overallStrategy
    ? `設計方針: ${details.conciergeAnalysis.overallStrategy}`
    : details.plannerMessage
      ? `プランナーメモ: ${details.plannerMessage}`
      : null;

  const itinerarySection = trip.days
    .map((day) => {
      const dayHeader =
        trip.days.length > 1 ? `\n【${day.label}】${day.theme ? ` — ${day.theme}` : ''}` : '';
      const dayItems = day.items
        .map((item, index) => {
          const lines = [`  ${index + 1}. ${item.time} ${item.activity}`];
          if (item.estimatedCost) lines.push(`     費用: ${item.estimatedCost}`);
          if (item.reason) lines.push(`     理由: ${item.reason}`);
          if (item.transportation && item.transportation !== '—') {
            lines.push(`     移動: ${item.transportation}`);
          }
          if (item.travelTimeToNext && item.travelTimeToNext !== '—') {
            lines.push(`     所要: ${item.travelTimeToNext}`);
          }
          if (item.weatherBackup && item.weatherBackup !== '天候に関わらず可') {
            lines.push(`     雨天時: ${item.weatherBackup}`);
          }
          return lines.join('\n');
        })
        .join('\n');
      return `${dayHeader}\n${dayItems}`;
    })
    .join('\n');

  const backups =
    details.rainyDayAlternatives?.length > 0
      ? `\n天候変化時の代替案:\n${details.rainyDayAlternatives.map((a) => `- ${a}`).join('\n')}`
      : '';

  const highlights =
    details.highlights?.length > 0
      ? `\nプランの魅力:\n${details.highlights.map((h) => `- ${h}`).join('\n')}`
      : '';

  const tripDate = details.tripDate ? formatTripDateLabel(details.tripDate) : null;

  return `
=== 現在アクティブな旅行プラン（把握済み・ユーザーに再確認しない） ===

【目的地】${trip.location}
【プラン名】${trip.title}

【予算】
${budgetSection}

【旅行期間】
期間: ${trip.tripDuration}
${tripDate ? `出発日: ${tripDate}` : ''}
所要: ${details.duration ?? trip.tripDuration}

【旅行スタイル】
タイプ: ${trip.personality}（${PERSONALITY_SUBTITLES[trip.personality]}）
気分: ${trip.mood || '未指定'}

【同行者】
${trip.companion}（${COMPANION_SUBTITLES[trip.companion]}）· ${trip.people}人

${weatherSection}
${strategySection ? `\n${strategySection}` : ''}
${highlights}

【行程詳細（${items.length}スポット）】
${itinerarySection}${backups}

=== 以上をすべて把握したうえで回答すること ===`.trim();
}

export function buildSecretaryWelcomeMessage(trip: ActiveTripContext): string {
  const spotCount = flattenItineraryDays(trip.days).length;
  return (
    `${trip.location}での${trip.tripDuration}のプラン、すべて把握しています。\n\n` +
    `${trip.companion}との「${trip.personality}」旅（${trip.people}人・予算目安 ${trip.details.totalBudget}）、` +
    `${spotCount}件の行程も確認済みです。\n\n` +
    `目的地や予算を改めて聞く必要はありません。雨の変更、予算調整、近くのおすすめなど、何でもそのままお聞きください。`
  );
}

export function buildSecretaryWelcomeMessageGeneric(): string {
  return (
    'こんにちは！AI旅行秘書です。\n\n' +
    'ホームでプランを生成すると、目的地・予算・行程を自動で把握して具体的なアドバイスができます。' +
    '今は一般相談モードです。旅行の計画中も、当日のトラブルも、なんでも相談してください。'
  );
}

/** @deprecated Use buildSecretaryTripBrief */
export function summarizeActiveTrip(trip: ActiveTripContext): string {
  return buildSecretaryTripBrief(trip);
}
