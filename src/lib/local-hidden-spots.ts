import { getUserDisplayName } from '@/lib/auth';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchProfilesByUserIds } from '@/lib/user-profiles';
import type {
  LocalHiddenSpot,
  LocalHiddenSpotCategory,
  SubmitLocalHiddenSpotInput,
} from '@/types/local-hidden-spot';
import { isDiscoverableLocalHiddenSpot } from '@/types/local-hidden-spot';
import type { ModerationStatus } from '@/types/moderation';

const SPOT_SELECT =
  'id, user_id, name, area, category, description, best_time, estimated_budget, crowd_tip, caution, google_maps_url, image_url, tags, moderation_status, creator_display_name, like_count, save_count, want_count, comment_count, created_at, updated_at';

type SpotRow = {
  id: string;
  user_id: string;
  name: string;
  area: string;
  category: LocalHiddenSpotCategory;
  description: string;
  best_time: string;
  estimated_budget: string;
  crowd_tip: string;
  caution: string;
  google_maps_url: string;
  image_url: string;
  tags: string[] | null;
  moderation_status: ModerationStatus;
  creator_display_name: string;
  like_count: number;
  save_count: number;
  want_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
};

const PRIVATE_ADDRESS_PATTERN =
  /(\d{1,4}[-−‐]?\d{1,4}[-−‐]?\d{1,4})|(丁目|番地|番\s*\d|号室|マンション|アパート|団地)/i;

function assertConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '穴場機能には Supabase の設定が必要です。\nlocal_hidden_spots.sql を実行してください。',
    );
  }
}

function rowToSpot(row: SpotRow, extras?: Partial<LocalHiddenSpot>): LocalHiddenSpot {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    area: row.area,
    category: row.category,
    description: row.description,
    bestTime: row.best_time,
    estimatedBudget: row.estimated_budget,
    crowdTip: row.crowd_tip,
    caution: row.caution,
    googleMapsUrl: row.google_maps_url,
    imageUrl: row.image_url,
    tags: row.tags ?? [],
    moderationStatus: row.moderation_status,
    creatorDisplayName: row.creator_display_name,
    likeCount: row.like_count,
    saveCount: row.save_count,
    wantCount: row.want_count,
    commentCount: row.comment_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extras,
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function validateSpotSubmission(input: SubmitLocalHiddenSpotInput): void {
  const combined = [
    input.name,
    input.area,
    input.description,
    input.caution ?? '',
    input.crowdTip ?? '',
  ].join(' ');

  if (PRIVATE_ADDRESS_PATTERN.test(combined)) {
    throw new Error(
      '個人住所の可能性がある内容は投稿できません。公開施設・店舗名・エリア名で投稿してください。',
    );
  }

  if (input.googleMapsUrl?.trim() && !/^https?:\/\//i.test(input.googleMapsUrl.trim())) {
    throw new Error('Google Maps リンクは https:// で始まるURLを入力してください');
  }

  if (input.imageUrl?.trim() && !/^https?:\/\//i.test(input.imageUrl.trim())) {
    throw new Error('写真URLは https:// で始まるURLを入力してください');
  }
}

async function attachCreatorMeta(spots: LocalHiddenSpot[]): Promise<LocalHiddenSpot[]> {
  if (spots.length === 0) return spots;

  const userIds = [...new Set(spots.map((spot) => spot.userId))];
  const profiles = await fetchProfilesByUserIds(userIds);

  return spots.map((spot) => {
    const profile = profiles.get(spot.userId);
    return {
      ...spot,
      creatorDisplayName: profile?.displayName ?? spot.creatorDisplayName,
      creatorArea: profile?.localExpertAreas?.[0] ?? spot.area,
      isLocalContributor: profile?.isLocalContributor ?? false,
    };
  });
}

async function attachUserInteractions(spots: LocalHiddenSpot[]): Promise<LocalHiddenSpot[]> {
  const userId = await getCurrentUserId();
  if (!userId || spots.length === 0) return spots;

  const spotIds = spots.map((spot) => spot.id);
  const supabase = getSupabase();

  const [{ data: likes }, { data: saves }, { data: wants }] = await Promise.all([
    supabase.from('local_hidden_spot_likes').select('spot_id').eq('user_id', userId).in('spot_id', spotIds),
    supabase.from('local_hidden_spot_saves').select('spot_id').eq('user_id', userId).in('spot_id', spotIds),
    supabase.from('local_hidden_spot_wants').select('spot_id').eq('user_id', userId).in('spot_id', spotIds),
  ]);

  const liked = new Set((likes ?? []).map((row) => row.spot_id as string));
  const saved = new Set((saves ?? []).map((row) => row.spot_id as string));
  const wanted = new Set((wants ?? []).map((row) => row.spot_id as string));

  return spots.map((spot) => ({
    ...spot,
    likedByMe: liked.has(spot.id),
    savedByMe: saved.has(spot.id),
    wantedByMe: wanted.has(spot.id),
  }));
}

export async function fetchLocalHiddenSpots(options?: {
  area?: string;
  limit?: number;
}): Promise<LocalHiddenSpot[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  let query = supabase
    .from('local_hidden_spots')
    .select(SPOT_SELECT)
    .eq('moderation_status', 'active')
    .order('save_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 24);

  const area = options?.area?.trim();
  if (area) {
    query = query.ilike('area', `%${area}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? '穴場スポットの取得に失敗しました');
  }

  let spots = (data as SpotRow[]).map((row) => rowToSpot(row));
  spots = await attachCreatorMeta(spots);
  spots = await attachUserInteractions(spots);
  return spots.filter(isDiscoverableLocalHiddenSpot);
}

export async function fetchLocalHiddenSpotsByUserId(userId: string): Promise<LocalHiddenSpot[]> {
  if (!isSupabaseConfigured() || !userId.trim()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('local_hidden_spots')
    .select(SPOT_SELECT)
    .eq('user_id', userId)
    .eq('moderation_status', 'active')
    .order('created_at', { ascending: false });

  if (error) return [];

  let spots = (data as SpotRow[]).map((row) => rowToSpot(row));
  spots = await attachCreatorMeta(spots);
  spots = await attachUserInteractions(spots);
  return spots.filter(isDiscoverableLocalHiddenSpot);
}

export async function countLocalHiddenSpotsForUser(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !userId.trim()) return 0;
  const supabase = getSupabase();
  const { count } = await supabase
    .from('local_hidden_spots')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('moderation_status', 'active');
  return count ?? 0;
}

export async function getLocalHiddenSpotById(spotId: string): Promise<LocalHiddenSpot | null> {
  if (!isSupabaseConfigured() || !spotId.trim()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('local_hidden_spots')
    .select(SPOT_SELECT)
    .eq('id', spotId)
    .maybeSingle();

  if (error || !data) return null;

  let spot = rowToSpot(data as SpotRow);
  if (!isDiscoverableLocalHiddenSpot(spot)) {
    const userId = await getCurrentUserId();
    if (userId !== spot.userId) return null;
  }

  [spot] = await attachCreatorMeta([spot]);
  [spot] = await attachUserInteractions([spot]);
  return spot;
}

export async function submitLocalHiddenSpot(
  input: SubmitLocalHiddenSpotInput,
): Promise<LocalHiddenSpot> {
  assertConfigured();
  validateSpotSubmission(input);

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const displayName = getUserDisplayName(user);

  const { data, error } = await supabase
    .from('local_hidden_spots')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      area: input.area.trim(),
      category: input.category,
      description: input.description.trim(),
      best_time: input.bestTime?.trim() ?? '',
      estimated_budget: input.estimatedBudget?.trim() ?? '',
      crowd_tip: input.crowdTip?.trim() ?? '',
      caution: input.caution?.trim() ?? '',
      google_maps_url: input.googleMapsUrl?.trim() ?? '',
      image_url: input.imageUrl?.trim() ?? '',
      tags: input.tags,
      creator_display_name: displayName,
      moderation_status: 'active',
    })
    .select(SPOT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '穴場スポットの投稿に失敗しました');
  }

  return rowToSpot(data as SpotRow);
}

async function toggleInteraction(
  table: 'local_hidden_spot_likes' | 'local_hidden_spot_saves' | 'local_hidden_spot_wants',
  spotId: string,
  countKey: 'likeCount' | 'saveCount' | 'wantCount',
  flagKey: 'likedByMe' | 'savedByMe' | 'wantedByMe',
): Promise<LocalHiddenSpot> {
  assertConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const spot = await getLocalHiddenSpotById(spotId);
  if (!spot) {
    throw new Error('スポットが見つかりません');
  }

  const isActive = spot[flagKey];
  if (isActive) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', user.id)
      .eq('spot_id', spotId);
    if (error) throw new Error(error.message ?? '操作に失敗しました');
    return {
      ...spot,
      [flagKey]: false,
      [countKey]: Math.max(spot[countKey] - 1, 0),
    };
  }

  const { error } = await supabase.from(table).insert({
    user_id: user.id,
    spot_id: spotId,
  });
  if (error) throw new Error(error.message ?? '操作に失敗しました');

  return {
    ...spot,
    [flagKey]: true,
    [countKey]: spot[countKey] + 1,
  };
}

export function toggleLocalHiddenSpotLike(spotId: string) {
  return toggleInteraction('local_hidden_spot_likes', spotId, 'likeCount', 'likedByMe');
}

export function toggleLocalHiddenSpotSave(spotId: string) {
  return toggleInteraction('local_hidden_spot_saves', spotId, 'saveCount', 'savedByMe');
}

export function toggleLocalHiddenSpotWant(spotId: string) {
  return toggleInteraction('local_hidden_spot_wants', spotId, 'wantCount', 'wantedByMe');
}

export async function fetchLocalHiddenSpotsForPlan(input: {
  location: string;
  limit?: number;
}): Promise<LocalHiddenSpot[]> {
  const location = input.location.trim();
  if (!location) return [];

  const spots = await fetchLocalHiddenSpots({ limit: input.limit ?? 12 });
  if (spots.length === 0) return [];

  const normalized = location.toLowerCase();
  const matched = spots.filter(
    (spot) =>
      spot.area.toLowerCase().includes(normalized) ||
      normalized.includes(spot.area.toLowerCase()) ||
      spot.name.toLowerCase().includes(normalized),
  );

  return (matched.length > 0 ? matched : spots).slice(0, input.limit ?? 8);
}

export function shouldPrioritizeLocalHiddenSpots(input: {
  personality?: string;
  mood?: string;
  travelIntent?: string;
  customText?: string;
}): boolean {
  const haystack = [
    input.personality,
    input.mood,
    input.travelIntent,
    input.customText,
  ]
    .filter(Boolean)
    .join(' ');

  return /穴場|ローカル|地元|観光客.*少|隠れ|知る人ぞ知る|穴場好き/i.test(haystack);
}
