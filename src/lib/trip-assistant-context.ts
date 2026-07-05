import { buildTripFolderEnrichedContext } from '@/lib/trip-folder-context';
import { fetchItineraryEditsForTrip } from '@/lib/itinerary-edits';
import { getUserPreferences } from '@/lib/user-memory';
import { getTravelUserPreferences } from '@/lib/travel-user-preferences';
import { buildTripAssistantPreferencesGuidance } from '@/lib/travel-user-preferences-prompt';
import { hasTravelUserPreferences } from '@/types/travel-user-preferences';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';
import type { TripAssistantContext } from '@/types/trip-assistant';
import type { TripFolder } from '@/types/trip-folder';

function getWeatherContextFromPlan(plan: SavedTripPayload | null): string | null {
  if (!plan?.details?.weather) return null;

  const weather = plan.details.weather;
  const parts: string[] = [];

  if (weather.planningMode === 'seasonal' && weather.seasonalContext) {
    const ctx = weather.seasonalContext;
    parts.push(`季節モード: ${ctx.monthLabel ?? ctx.seasonLabel ?? '季節傾向'}`);
    if (ctx.guidance) parts.push(ctx.guidance);
    if (ctx.riskNotes?.length) parts.push(`リスク: ${ctx.riskNotes.join(' / ')}`);
  } else if (weather.planningMode === 'forecast') {
    parts.push('天気予報連動モード');
    if (weather.summary) parts.push(weather.summary);
  } else if (weather.summary) {
    parts.push(weather.summary);
  }

  if (plan.details.rainyDayAlternatives?.length) {
    parts.push(
      `雨の日代替案: ${plan.details.rainyDayAlternatives.slice(0, 4).join(' / ')}`,
    );
  }

  return parts.length ? parts.join('\n') : null;
}

function buildUserPreferencesSummary(
  prefs: Awaited<ReturnType<typeof getUserPreferences>>,
): string {
  if (!prefs.hasData) return '記録なし';

  const lines: string[] = [];
  if (prefs.favoriteTravelStyle) lines.push(`旅行スタイル: ${prefs.favoriteTravelStyle}`);
  if (prefs.budgetPreference) lines.push(`予算傾向: ${prefs.budgetPreference}`);
  if (prefs.preferredTripDuration) lines.push(`期間の好み: ${prefs.preferredTripDuration}`);
  if (prefs.favoriteActivities.length) {
    lines.push(`よく選ぶスポット: ${prefs.favoriteActivities.slice(0, 5).join('、')}`);
  }

  return lines.length ? lines.join('\n') : '記録なし';
}

async function buildEditHistorySummary(savedTripId: string | null): Promise<string | null> {
  if (!savedTripId) return null;

  try {
    const edits = await fetchItineraryEditsForTrip(savedTripId);
    if (!edits.length) return null;

    return edits
      .slice(0, 8)
      .map((edit) => {
        const before = edit.beforeData.item as { activity?: string } | undefined;
        const after = edit.afterData.item as { activity?: string } | undefined;
        return `- Day${edit.dayIndex + 1}: ${before?.activity ?? '?'} → ${after?.activity ?? '?'}（${edit.editRequest}）`;
      })
      .join('\n');
  } catch {
    return null;
  }
}

export async function buildTripAssistantContext(
  folder: TripFolder,
  linkedTrip: SavedTrip | null,
): Promise<TripAssistantContext> {
  const latestPlan = linkedTrip?.payload ?? folder.planPayload ?? null;
  const savedPlans: SavedTripPayload[] = [];

  if (linkedTrip?.payload) {
    savedPlans.push(linkedTrip.payload);
  } else if (folder.planPayload) {
    savedPlans.push(folder.planPayload);
  }

  const itinerary =
    latestPlan?.items?.length
      ? latestPlan.items
      : (latestPlan?.days.flatMap((day) => day.items) ?? []);

  const [enriched, userPrefs, travelUserPrefs, editHistorySummary] = await Promise.all([
    buildTripFolderEnrichedContext(folder),
    getUserPreferences(),
    getTravelUserPreferences(),
    buildEditHistorySummary(folder.savedTripId),
  ]);

  let extendedBrief = enriched.extendedBrief;
  if (editHistorySummary) {
    extendedBrief += `\n\n【ユーザーが編集した予定】\n${editHistorySummary}`;
  }

  const outfit = latestPlan?.details?.outfitAdvice;
  if (outfit?.title || outfit?.items?.length) {
    extendedBrief += `\n\n【服装・持ち物アドバイス】`;
    if (outfit.title) extendedBrief += `\n${outfit.title}`;
    if (outfit.items?.length) {
      extendedBrief += `\n${outfit.items.slice(0, 12).map((item) => `- ${item}`).join('\n')}`;
    }
  }

  const preferenceSummary = [
    buildUserPreferencesSummary(userPrefs),
    hasTravelUserPreferences(travelUserPrefs)
      ? buildTripAssistantPreferencesGuidance(travelUserPrefs)
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const context: TripAssistantContext = {
    folder,
    savedPlans,
    latestPlan,
    linkedTrip,
    itinerary,
    budget: latestPlan?.budget ?? folder.budget,
    budgetIncludes: latestPlan?.budgetIncludes,
    travelPurpose: latestPlan?.travelPurpose,
    companion: latestPlan?.companion ?? folder.companionType,
    weatherContext: getWeatherContextFromPlan(latestPlan),
    userPreferences: preferenceSummary || '記録なし',
    tripContext: enriched.tripContext,
    extendedBrief,
    editHistorySummary,
  };

  console.log('[TripAssistant] folder context', {
    folderId: context.folder.id,
    title: context.folder.title,
    destination: context.folder.destination,
    departureDate: context.folder.departureDate,
    returnDate: context.folder.returnDate,
    durationLabel: context.folder.durationLabel,
    planCount: context.savedPlans.length,
    itineraryCount: context.itinerary.length,
    budget: context.budget,
    budgetIncludes: context.budgetIncludes,
    travelPurpose: context.travelPurpose,
    companion: context.companion,
    weatherContext: context.weatherContext,
    editHistorySummary: context.editHistorySummary,
    userPreferences: context.userPreferences,
  });

  return context;
}
