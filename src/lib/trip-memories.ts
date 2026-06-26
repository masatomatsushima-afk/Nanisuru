import * as ImagePicker from 'expo-image-picker';

import { getDurationDisplayLabel } from '@/lib/trip-duration';
import { formatTripDateRangeLabel, formatTripScheduleSummary } from '@/lib/trip-schedule';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  noteShowOnProfileColumnMissing,
  shouldUseShowOnProfileColumn,
} from '@/lib/supabase-schema-fallback';
import type { SavedTrip } from '@/types/trip';
import type {
  ItineraryMemorySlot,
  MemoryPeriodGroup,
  TripMemory,
  TripMemoryAiSummary,
  TripMemoryComment,
  TripMemoryMedia,
  TripMemoryMediaType,
  TripMemoryVisibility,
  TripMemoryWithMedia,
} from '@/types/trip-memory';

export const TRIP_MEMORY_BUCKET = 'trip-memories';

const MEMORY_SELECT_BASE =
  'id, user_id, trip_id, title, destination, date_label, duration_label, companion, cover_image_url, summary, ai_summary, favorite_moments, visibility, like_count, save_count, comment_count, created_at, updated_at';

const MEMORY_SELECT = `${MEMORY_SELECT_BASE}, show_on_profile`;

function resolveMemorySelect(): string {
  return shouldUseShowOnProfileColumn() ? MEMORY_SELECT : MEMORY_SELECT_BASE;
}

async function selectMemories(
  queryFn: (select: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<{ data: unknown; error: { message?: string } | null }> {
  const first = await queryFn(resolveMemorySelect());
  if (first.error && noteShowOnProfileColumnMissing(first.error)) {
    return queryFn(MEMORY_SELECT_BASE);
  }
  return first;
}

const MEDIA_SELECT =
  'id, memory_id, media_url, storage_path, media_type, caption, timeline_time, place_name, latitude, longitude, itinerary_day_number, itinerary_item_time, itinerary_item_activity, is_favorite, order_index, created_at';

type MemoryRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  title: string;
  destination: string;
  date_label: string;
  duration_label: string;
  companion: string;
  cover_image_url: string | null;
  summary: string;
  ai_summary: TripMemoryAiSummary | null;
  favorite_moments: string[] | null;
  visibility: TripMemoryVisibility;
  like_count: number;
  save_count: number;
  comment_count: number;
  show_on_profile?: boolean;
  created_at: string;
  updated_at: string;
};

type MediaRow = {
  id: string;
  memory_id: string;
  media_url: string | null;
  storage_path: string | null;
  media_type: TripMemoryMediaType;
  caption: string;
  timeline_time: string;
  place_name: string;
  latitude: number | null;
  longitude: number | null;
  itinerary_day_number: number | null;
  itinerary_item_time: string | null;
  itinerary_item_activity: string | null;
  is_favorite: boolean;
  order_index: number;
  created_at: string;
};

type CommentRow = {
  id: string;
  memory_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

function assertConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '思い出機能には Supabase の設定が必要です。\ntrip_memories.sql を実行してください。',
    );
  }
}

function rowToMemory(row: MemoryRow): TripMemory {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    title: row.title,
    destination: row.destination,
    dateLabel: row.date_label,
    durationLabel: row.duration_label,
    companion: row.companion,
    coverImageUrl: row.cover_image_url,
    summary: row.summary,
    aiSummary: row.ai_summary,
    favoriteMoments: row.favorite_moments ?? [],
    visibility: row.visibility,
    likeCount: row.like_count,
    saveCount: row.save_count,
    commentCount: row.comment_count,
    showOnProfile: row.show_on_profile ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMedia(row: MediaRow): TripMemoryMedia {
  return {
    id: row.id,
    memoryId: row.memory_id,
    mediaUrl: row.media_url,
    storagePath: row.storage_path,
    mediaType: row.media_type,
    caption: row.caption,
    timelineTime: row.timeline_time,
    placeName: row.place_name,
    latitude: row.latitude,
    longitude: row.longitude,
    itineraryDayNumber: row.itinerary_day_number,
    itineraryItemTime: row.itinerary_item_time,
    itineraryItemActivity: row.itinerary_item_activity,
    isFavorite: row.is_favorite,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function buildMemoryMetaFromTrip(trip: SavedTrip): {
  title: string;
  destination: string;
  dateLabel: string;
  durationLabel: string;
  companion: string;
} {
  const { payload } = trip;
  const dateFromDetails = formatTripDateRangeLabel(
    payload.details.tripDate,
    payload.details.tripEndDate,
  );
  const dateLabel =
    dateFromDetails ??
    formatTripScheduleSummary({
      location: payload.location,
      departureDate: payload.details.tripDate,
      returnDate: payload.details.tripEndDate,
      tripDuration: payload.tripDuration,
      customDuration: payload.customDuration,
    });

  return {
    title: trip.title,
    destination: payload.location,
    dateLabel,
    durationLabel: getDurationDisplayLabel(payload.tripDuration, payload.customDuration),
    companion: payload.companion,
  };
}

export function extractItineraryMemorySlots(trip: SavedTrip): ItineraryMemorySlot[] {
  const slots: ItineraryMemorySlot[] = [];
  for (const day of trip.payload.days) {
    for (const item of day.items) {
      slots.push({
        dayNumber: day.dayNumber,
        time: item.time,
        activity: item.activity,
        placeName: item.placeAddress ?? item.activity,
      });
    }
  }
  return slots;
}

export async function getTripMemoryByTripId(tripId: string): Promise<TripMemory | null> {
  assertConfigured();
  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) =>
    supabase.from('trip_memories').select(select).eq('trip_id', tripId).maybeSingle(),
  );

  if (error || !data) return null;
  return rowToMemory(data as MemoryRow);
}

export async function ensureTripMemoryForSavedTrip(trip: SavedTrip): Promise<TripMemory> {
  assertConfigured();
  const existing = await getTripMemoryByTripId(trip.id);
  if (existing) return existing;

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const meta = buildMemoryMetaFromTrip(trip);
  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) =>
    supabase.from('trip_memories').insert({
      user_id: userId,
      trip_id: trip.id,
      title: meta.title,
      destination: meta.destination,
      date_label: meta.dateLabel,
      duration_label: meta.durationLabel,
      companion: meta.companion,
      visibility: 'private',
    }).select(select).single(),
  );

  if (error || !data) {
    throw new Error(error?.message ?? '思い出フォルダの作成に失敗しました');
  }

  return rowToMemory(data as MemoryRow);
}

export async function fetchTripMemoryWithMedia(memoryId: string): Promise<TripMemoryWithMedia | null> {
  assertConfigured();
  const supabase = getSupabase();
  const { data: memoryData, error: memoryError } = await selectMemories((select) =>
    supabase.from('trip_memories').select(select).eq('id', memoryId).maybeSingle(),
  );

  if (memoryError || !memoryData) return null;

  const { data: mediaData, error: mediaError } = await supabase
    .from('trip_memory_media')
    .select(MEDIA_SELECT)
    .eq('memory_id', memoryId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (mediaError) {
    throw new Error(mediaError.message ?? 'メディアの取得に失敗しました');
  }

  return {
    ...rowToMemory(memoryData as MemoryRow),
    media: ((mediaData ?? []) as MediaRow[]).map(rowToMedia),
  };
}

export async function fetchUserTripMemories(): Promise<TripMemory[]> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) =>
    supabase
      .from('trip_memories')
      .select(select)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );

  if (error) throw new Error(error.message ?? '思い出の取得に失敗しました');
  return ((data ?? []) as MemoryRow[]).map(rowToMemory);
}

export async function fetchPublicTripMemories(limit = 12): Promise<TripMemory[]> {
  assertConfigured();
  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) => {
    let query = supabase
      .from('trip_memories')
      .select(select)
      .eq('visibility', 'public');

    if (shouldUseShowOnProfileColumn()) {
      query = query.eq('show_on_profile', true);
    }

    return query.order('created_at', { ascending: false }).limit(limit);
  });

  if (error) return [];
  return ((data ?? []) as MemoryRow[]).map(rowToMemory);
}

export async function fetchProfilePublicMemoriesByUserId(userId: string): Promise<TripMemory[]> {
  assertConfigured();
  if (!userId.trim()) return [];

  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) => {
    let query = supabase
      .from('trip_memories')
      .select(select)
      .eq('user_id', userId)
      .eq('visibility', 'public');

    if (shouldUseShowOnProfileColumn()) {
      query = query.eq('show_on_profile', true);
    }

    return query.order('created_at', { ascending: false });
  });

  if (error) return [];
  return ((data ?? []) as MemoryRow[]).map(rowToMemory);
}

export async function toggleTripMemoryShowOnProfile(
  memoryId: string,
  showOnProfile: boolean,
): Promise<TripMemory> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) =>
    supabase
      .from('trip_memories')
      .update({ show_on_profile: showOnProfile, updated_at: new Date().toISOString() })
      .eq('id', memoryId)
      .eq('user_id', userId)
      .select(select)
      .single(),
  );

  if (error && noteShowOnProfileColumnMissing(error)) {
    throw new Error(
      'プロフィール表示の設定には show_on_profile カラムが必要です。Supabase で add_show_on_profile.sql を実行してください。',
    );
  }

  if (error || !data) {
    throw new Error(error?.message ?? 'プロフィール表示の更新に失敗しました');
  }

  return rowToMemory(data as MemoryRow);
}

export async function countProfilePublicMemoriesForUser(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !userId.trim()) return 0;
  const supabase = getSupabase();

  let query = supabase
    .from('trip_memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('visibility', 'public');

  if (shouldUseShowOnProfileColumn()) {
    query = query.eq('show_on_profile', true);
  }

  let { count, error } = await query;

  if (error && noteShowOnProfileColumnMissing(error)) {
    ({ count, error } = await supabase
      .from('trip_memories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('visibility', 'public'));
  }

  return count ?? 0;
}

export function groupMemoriesByPeriod(memories: TripMemory[]): MemoryPeriodGroup[] {
  const map = new Map<string, MemoryPeriodGroup>();

  for (const memory of memories) {
    const date = resolveMemorySortDate(memory);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month}`;
    const existing = map.get(key);
    if (existing) {
      existing.memories.push(memory);
    } else {
      map.set(key, {
        year,
        month,
        label: `${year}年${month}月`,
        memories: [memory],
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

function resolveMemorySortDate(memory: TripMemory): Date {
  const isoMatch = memory.dateLabel.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[0]}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(memory.createdAt);
}

export function filterMemoriesByYear(memories: TripMemory[], year: number): TripMemory[] {
  return memories.filter((memory) => resolveMemorySortDate(memory).getFullYear() === year);
}

export function filterMemoriesByMonth(memories: TripMemory[], year: number, month: number): TripMemory[] {
  return memories.filter((memory) => {
    const date = resolveMemorySortDate(memory);
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  });
}

export async function updateTripMemoryVisibility(
  memoryId: string,
  visibility: TripMemoryVisibility,
): Promise<TripMemory> {
  assertConfigured();
  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) =>
    supabase
      .from('trip_memories')
      .update({ visibility, updated_at: new Date().toISOString() })
      .eq('id', memoryId)
      .select(select)
      .single(),
  );

  if (error || !data) {
    throw new Error(error?.message ?? '公開設定の更新に失敗しました');
  }

  return rowToMemory(data as MemoryRow);
}

export async function updateTripMemoryAiSummary(
  memoryId: string,
  aiSummary: TripMemoryAiSummary,
): Promise<TripMemory> {
  assertConfigured();
  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) =>
    supabase
      .from('trip_memories')
      .update({
        ai_summary: aiSummary,
        summary: aiSummary.oneLineSummary,
        title: aiSummary.memoryTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memoryId)
      .select(select)
      .single(),
  );

  if (error || !data) {
    throw new Error(error?.message ?? 'AIまとめの保存に失敗しました');
  }

  return rowToMemory(data as MemoryRow);
}

export async function updateTripMemoryCover(
  memoryId: string,
  coverImageUrl: string,
): Promise<TripMemory> {
  assertConfigured();
  const supabase = getSupabase();
  const { data, error } = await selectMemories((select) =>
    supabase
      .from('trip_memories')
      .update({ cover_image_url: coverImageUrl, updated_at: new Date().toISOString() })
      .eq('id', memoryId)
      .select(select)
      .single(),
  );

  if (error || !data) {
    throw new Error(error?.message ?? 'カバー画像の更新に失敗しました');
  }

  return rowToMemory(data as MemoryRow);
}

export type AddTripMemoryMediaInput = {
  memoryId: string;
  mediaUrl?: string | null;
  storagePath?: string | null;
  mediaType: TripMemoryMediaType;
  caption?: string;
  timelineTime?: string;
  placeName?: string;
  latitude?: number | null;
  longitude?: number | null;
  itinerarySlot?: ItineraryMemorySlot | null;
  isFavorite?: boolean;
};

export async function addTripMemoryMedia(input: AddTripMemoryMediaInput): Promise<TripMemoryMedia> {
  assertConfigured();
  const supabase = getSupabase();

  const { count, error: countError } = await supabase
    .from('trip_memory_media')
    .select('id', { count: 'exact', head: true })
    .eq('memory_id', input.memoryId);

  if (countError) {
    throw new Error(countError.message ?? 'メディア数の確認に失敗しました');
  }

  const orderIndex = count ?? 0;
  const slot = input.itinerarySlot;

  const { data, error } = await supabase
    .from('trip_memory_media')
    .insert({
      memory_id: input.memoryId,
      media_url: input.mediaUrl ?? null,
      storage_path: input.storagePath ?? null,
      media_type: input.mediaType,
      caption: input.caption?.trim() ?? '',
      timeline_time: input.timelineTime ?? slot?.time ?? '',
      place_name: input.placeName ?? slot?.placeName ?? '',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      itinerary_day_number: slot?.dayNumber ?? null,
      itinerary_item_time: slot?.time ?? null,
      itinerary_item_activity: slot?.activity ?? null,
      is_favorite: input.isFavorite ?? false,
      order_index: orderIndex,
    })
    .select(MEDIA_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'メディアの追加に失敗しました');
  }

  const media = rowToMedia(data as MediaRow);

  if (input.mediaType === 'photo' && input.mediaUrl) {
    await updateTripMemoryCover(input.memoryId, input.mediaUrl);
  }

  await supabase
    .from('trip_memories')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.memoryId);

  return media;
}

export async function addTripMemoryNote(
  memoryId: string,
  note: string,
  itinerarySlot?: ItineraryMemorySlot | null,
): Promise<TripMemoryMedia> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error('メモを入力してください');

  return addTripMemoryMedia({
    memoryId,
    mediaType: 'note',
    caption: trimmed,
    itinerarySlot,
  });
}

export async function toggleTripMemoryMediaFavorite(
  mediaId: string,
  isFavorite: boolean,
): Promise<TripMemoryMedia> {
  assertConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_memory_media')
    .update({ is_favorite: isFavorite })
    .eq('id', mediaId)
    .select(MEDIA_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'お気に入りの更新に失敗しました');
  }

  return rowToMedia(data as MediaRow);
}

export async function deleteTripMemoryMedia(media: TripMemoryMedia): Promise<void> {
  assertConfigured();
  const supabase = getSupabase();

  if (media.storagePath) {
    await supabase.storage.from(TRIP_MEMORY_BUCKET).remove([media.storagePath]);
  }

  const { error } = await supabase.from('trip_memory_media').delete().eq('id', media.id);
  if (error) throw new Error(error.message ?? 'メディアの削除に失敗しました');
}

function guessContentType(uri: string, mediaType: 'photo' | 'video'): string {
  const lower = uri.toLowerCase();
  if (mediaType === 'video') {
    if (lower.includes('.mov')) return 'video/quicktime';
    if (lower.includes('.webm')) return 'video/webm';
    return 'video/mp4';
  }
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.heic')) return 'image/heic';
  return 'image/jpeg';
}

function buildStoragePath(
  userId: string,
  memoryId: string,
  mediaType: 'photo' | 'video',
  uri: string,
): string {
  const extension = mediaType === 'video' ? 'mp4' : (guessContentType(uri, 'photo').split('/')[1] ?? 'jpg');
  return `${userId}/${memoryId}/${mediaType}-${Date.now()}.${extension}`;
}

export async function uploadTripMemoryFile(
  localUri: string,
  memoryId: string,
  userId: string,
  mediaType: 'photo' | 'video',
): Promise<{ mediaUrl: string; storagePath: string }> {
  assertConfigured();
  const supabase = getSupabase();
  const storagePath = buildStoragePath(userId, memoryId, mediaType, localUri);
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = guessContentType(localUri, mediaType);

  const { error } = await supabase.storage.from(TRIP_MEMORY_BUCKET).upload(storagePath, arrayBuffer, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(error.message ?? 'アップロードに失敗しました');

  const { data } = supabase.storage.from(TRIP_MEMORY_BUCKET).getPublicUrl(storagePath);
  return { mediaUrl: data.publicUrl, storagePath };
}

export async function pickAndUploadTripMemoryPhoto(
  memoryId: string,
  userId: string,
  itinerarySlot?: ItineraryMemorySlot | null,
): Promise<TripMemoryMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('写真ライブラリへのアクセスが必要です');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;

  const { mediaUrl, storagePath } = await uploadTripMemoryFile(
    result.assets[0].uri,
    memoryId,
    userId,
    'photo',
  );

  return addTripMemoryMedia({
    memoryId,
    mediaUrl,
    storagePath,
    mediaType: 'photo',
    itinerarySlot,
    placeName: itinerarySlot?.placeName,
  });
}

export async function pickAndUploadTripMemoryVideo(
  memoryId: string,
  userId: string,
  itinerarySlot?: ItineraryMemorySlot | null,
): Promise<TripMemoryMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('写真ライブラリへのアクセスが必要です');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 0.85,
    videoMaxDuration: 120,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;

  const { mediaUrl, storagePath } = await uploadTripMemoryFile(
    result.assets[0].uri,
    memoryId,
    userId,
    'video',
  );

  return addTripMemoryMedia({
    memoryId,
    mediaUrl,
    storagePath,
    mediaType: 'video',
    itinerarySlot,
    placeName: itinerarySlot?.placeName,
  });
}

export async function fetchTripMemoryEngagement(
  memoryId: string,
  userId: string | null,
): Promise<{ isLiked: boolean; isSaved: boolean }> {
  if (!userId) return { isLiked: false, isSaved: false };

  assertConfigured();
  const supabase = getSupabase();
  const [likeResult, saveResult] = await Promise.all([
    supabase.from('trip_memory_likes').select('memory_id').eq('memory_id', memoryId).eq('user_id', userId).maybeSingle(),
    supabase.from('trip_memory_saves').select('memory_id').eq('memory_id', memoryId).eq('user_id', userId).maybeSingle(),
  ]);

  return {
    isLiked: Boolean(likeResult.data),
    isSaved: Boolean(saveResult.data),
  };
}

export async function toggleTripMemoryLike(memoryId: string): Promise<{ liked: boolean; likeCount: number }> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('trip_memory_likes')
    .select('memory_id')
    .eq('memory_id', memoryId)
    .eq('user_id', userId)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    await supabase.from('trip_memory_likes').delete().eq('memory_id', memoryId).eq('user_id', userId);
    liked = false;
  } else {
    await supabase.from('trip_memory_likes').insert({ memory_id: memoryId, user_id: userId });
    liked = true;
  }

  const { count } = await supabase
    .from('trip_memory_likes')
    .select('memory_id', { count: 'exact', head: true })
    .eq('memory_id', memoryId);

  const likeCount = count ?? 0;
  await supabase.from('trip_memories').update({ like_count: likeCount }).eq('id', memoryId);

  return { liked, likeCount };
}

export async function toggleTripMemorySave(memoryId: string): Promise<{ saved: boolean; saveCount: number }> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('trip_memory_saves')
    .select('memory_id')
    .eq('memory_id', memoryId)
    .eq('user_id', userId)
    .maybeSingle();

  let saved: boolean;
  if (existing) {
    await supabase.from('trip_memory_saves').delete().eq('memory_id', memoryId).eq('user_id', userId);
    saved = false;
  } else {
    await supabase.from('trip_memory_saves').insert({ memory_id: memoryId, user_id: userId });
    saved = true;
  }

  const { count } = await supabase
    .from('trip_memory_saves')
    .select('memory_id', { count: 'exact', head: true })
    .eq('memory_id', memoryId);

  const saveCount = count ?? 0;
  await supabase.from('trip_memories').update({ save_count: saveCount }).eq('id', memoryId);

  return { saved, saveCount };
}

export async function fetchTripMemoryComments(memoryId: string): Promise<TripMemoryComment[]> {
  assertConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_memory_comments')
    .select('id, memory_id, user_id, body, created_at')
    .eq('memory_id', memoryId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message ?? 'コメントの取得に失敗しました');
  return (data as CommentRow[]).map((row) => ({
    id: row.id,
    memoryId: row.memory_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function addTripMemoryComment(memoryId: string, body: string): Promise<TripMemoryComment> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const trimmed = body.trim();
  if (!trimmed) throw new Error('コメントを入力してください');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_memory_comments')
    .insert({ memory_id: memoryId, user_id: userId, body: trimmed })
    .select('id, memory_id, user_id, body, created_at')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'コメントの投稿に失敗しました');

  const { count } = await supabase
    .from('trip_memory_comments')
    .select('id', { count: 'exact', head: true })
    .eq('memory_id', memoryId);

  await supabase.from('trip_memories').update({ comment_count: count ?? 0 }).eq('id', memoryId);

  const row = data as CommentRow;
  return {
    id: row.id,
    memoryId: row.memory_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export const TRIP_MEMORY_VISIBILITY_LABELS: Record<TripMemoryVisibility, string> = {
  private: '自分だけ',
  unlisted: '共有リンクのみ',
  public: '公開する',
};

export const TRIP_MEMORY_VISIBILITY_DESCRIPTIONS: Record<TripMemoryVisibility, string> = {
  private: 'あなただけが見られます',
  unlisted: 'リンクを知っている人だけが見られます',
  public: 'みんなの思い出としてDiscoverに表示されます',
};
