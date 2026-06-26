import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildActiveTripContext, buildSecretaryTripBrief } from '@/lib/active-trip';
import { getDurationDisplayLabel } from '@/lib/trip-duration';
import { getPublishedPlanForTrip } from '@/lib/public-plans';
import { formatTripDateRangeLabel, formatTripScheduleSummary } from '@/lib/trip-schedule';
import { fetchTripMemoryWithMedia, getTripMemoryByTripId } from '@/lib/trip-memories';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';
import type { ActiveTripContext } from '@/types/travel-secretary';
import type { TripFolder } from '@/types/trip-folder';

export type TripFolderEnrichedContext = {
  tripContext: ActiveTripContext | null;
  extendedBrief: string;
};

function buildFolderTitleFromPayload(payload: SavedTripPayload, fallbackTitle?: string): string {
  return fallbackTitle?.trim() || payload.location || '旅行';
}

export async function buildTripFolderEnrichedContext(
  folder: TripFolder,
): Promise<TripFolderEnrichedContext> {
  const payload = folder.planPayload;
  let tripContext: ActiveTripContext | null = null;

  if (payload?.days?.length) {
    tripContext = buildActiveTripContext({
      location: payload.location || folder.destination,
      budget: payload.budget || folder.budget,
      currency: payload.currency || folder.currency,
      people: payload.people,
      mood: payload.mood,
      companion: (payload.companion || folder.companionType) as ActiveTripContext['companion'],
      personality: payload.personality,
      tripDuration: payload.tripDuration,
      days: payload.days,
      details: {
        ...payload.details,
        tripDate: payload.details.tripDate || folder.departureDate,
        tripEndDate: payload.details.tripEndDate || folder.returnDate,
      },
    });
  }

  const sections: string[] = [];

  sections.push(`=== 選択中の旅行フォルダ: ${folder.title} ===`);
  sections.push(`行き先: ${folder.destination}`);
  if (folder.departureDate || folder.returnDate) {
    sections.push(
      `日程: ${formatTripDateRangeLabel(folder.departureDate, folder.returnDate) ?? `${folder.departureDate} 〜 ${folder.returnDate}`}`,
    );
  }
  sections.push(`期間: ${folder.durationLabel}`);
  sections.push(`同行: ${folder.companionType}`);
  sections.push(`予算: ${folder.budget || '未設定'} ${folder.currency}`);

  if (tripContext) {
    sections.push('\n' + buildSecretaryTripBrief(tripContext));
  }

  const notes = folder.contextNotes;
  if (notes.flightNotes?.trim()) {
    sections.push(`\n【フライトメモ】\n${notes.flightNotes.trim()}`);
  }
  if (notes.hotelNotes?.trim()) {
    sections.push(`\n【ホテルメモ】\n${notes.hotelNotes.trim()}`);
  }
  if (notes.savedPlaces?.length) {
    sections.push(`\n【保存した場所】\n${notes.savedPlaces.map((p) => `- ${p}`).join('\n')}`);
  }

  if (folder.savedTripId) {
    try {
      const published = await getPublishedPlanForTrip(folder.savedTripId);
      if (published) {
        const status =
          published.visibility === 'public' && published.isPublic
            ? '公開中'
            : published.visibility === 'unlisted'
              ? 'リンクのみ公開'
              : '非公開';
        sections.push(`\n【コミュニティ公開】${status}`);
      } else {
        sections.push('\n【コミュニティ公開】未公開');
      }
    } catch {
      // optional
    }

    try {
      const memory = await getTripMemoryByTripId(folder.savedTripId);
      if (memory) {
        const memoryDetail = await fetchTripMemoryWithMedia(memory.id);
        if (memoryDetail) {
          const photoCount = memoryDetail.media.filter((m) => m.mediaType === 'photo').length;
          const videoCount = memoryDetail.media.filter((m) => m.mediaType === 'video').length;
          const noteCount = memoryDetail.media.filter((m) => m.mediaType === 'note').length;
          sections.push(
            `\n【思い出アルバム】${memoryDetail.title}\n` +
              `写真 ${photoCount} · 動画 ${videoCount} · メモ ${noteCount}` +
              (memoryDetail.summary ? `\n一言: ${memoryDetail.summary}` : ''),
          );
        }
      }
    } catch {
      // optional
    }
  }

  const outfit = payload?.details?.outfitAdvice;
  if (outfit) {
    const packingItems = outfit.items?.slice(0, 12) ?? [];
    if (packingItems.length) {
      sections.push(`\n【持ち物チェックリスト】\n${packingItems.map((item: string) => `- ${item}`).join('\n')}`);
    }
    if (outfit.title) {
      sections.push(`\n【服装アドバイス】${outfit.title}`);
    }
    if (outfit.travelPackingAdvice?.length) {
      sections.push(outfit.travelPackingAdvice.map((tip) => `- ${tip}`).join('\n'));
    }
  }

  return {
    tripContext,
    extendedBrief: sections.join('\n'),
  };
}

export function buildWelcomeMessageForFolder(
  folder: TripFolder,
  tripContext: ActiveTripContext | null,
): string {
  if (tripContext) {
    const spotCount = tripContext.days.flatMap((d) => d.items).length;
    return (
      `「${folder.title}」フォルダで相談中です。\n\n` +
      `${folder.destination} · ${folder.companionType} · ${folder.durationLabel || tripContext.tripDuration}\n` +
      `予算 ${folder.budget || tripContext.details.totalBudget} · 行程 ${spotCount}件を把握しています。\n\n` +
      `この旅行だけの文脈で答えます。焼肉、服装、雨の日変更など、何でも聞いてください。`
    );
  }

  return (
    `「${folder.title}」フォルダを作成しました。\n\n` +
    `${folder.destination}への旅について、予算・同行・日程をもとにサポートします。\n` +
    `プランを保存すると、行程や持ち物も自動で連携されます。`
  );
}

export function createTripFolderInputFromSavedTrip(trip: SavedTrip): import('@/types/trip-folder').CreateTripFolderInput {
  const { payload } = trip;
  const durationLabel = getDurationDisplayLabel(payload.tripDuration, payload.customDuration);

  return {
    title: trip.title,
    destination: payload.location,
    departureDate: payload.details.tripDate ?? '',
    returnDate: payload.details.tripEndDate ?? '',
    durationLabel,
    companionType: payload.companion,
    budget: payload.budget,
    currency: payload.currency,
    savedTripId: trip.id,
    planPayload: payload,
    contextNotes: {
      savedPlaces: payload.customPreferences?.desiredPlaces
        ? payload.customPreferences.desiredPlaces
            .split(/[,、\n]/)
            .map((place) => place.trim())
            .filter(Boolean)
        : undefined,
    },
  };
}

export function createTripFolderInputFromPayload(
  payload: SavedTripPayload,
  title?: string,
): import('@/types/trip-folder').CreateTripFolderInput {
  const durationLabel = getDurationDisplayLabel(payload.tripDuration, payload.customDuration);
  const schedule = formatTripScheduleSummary({
    location: payload.location,
    departureDate: payload.details.tripDate,
    returnDate: payload.details.tripEndDate,
    tripDuration: payload.tripDuration,
    customDuration: payload.customDuration,
  });

  return {
    title: title ?? buildFolderTitleFromPayload(payload),
    destination: payload.location,
    departureDate: payload.details.tripDate ?? '',
    returnDate: payload.details.tripEndDate ?? '',
    durationLabel: durationLabel || schedule,
    companionType: payload.companion,
    budget: payload.budget,
    currency: payload.currency,
    planPayload: payload,
    contextNotes: {
      savedPlaces: payload.customPreferences?.desiredPlaces
        ? payload.customPreferences.desiredPlaces
            .split(/[,、\n]/)
            .map((place) => place.trim())
            .filter(Boolean)
        : undefined,
    },
  };
}

const LAST_FOLDER_KEY = 'nanisuru_last_trip_folder_id';

export async function getLastSelectedTripFolderId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_FOLDER_KEY);
}

export async function setLastSelectedTripFolderId(folderId: string): Promise<void> {
  await AsyncStorage.setItem(LAST_FOLDER_KEY, folderId);
}
