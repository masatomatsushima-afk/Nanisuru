import { getUserDisplayName } from '@/lib/auth';
import { LOCAL_GEMS_SAMPLE_DATA } from '@/data/local-gems-sample';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchProfilesByUserIds } from '@/lib/user-profiles';
import type {
  LocalHiddenSpot,
  LocalHiddenSpotCategory,
  LocalHiddenSpotVisibility,
  SubmitLocalHiddenSpotInput,
} from '@/types/local-hidden-spot';
import { isDiscoverableLocalHiddenSpot } from '@/types/local-hidden-spot';
import type { ModerationStatus } from '@/types/moderation';

const SPOT_SELECT =
  'id, user_id, name, area, category, description, best_time, estimated_budget, crowd_tip, caution, recommended_for, google_maps_url, instagram_url, tiktok_url, image_url, tags, visibility, moderation_status, creator_display_name, like_count, save_count, want_count, comment_count, created_at, updated_at';

const SPOT_SELECT_LEGACY =
  'id, user_id, name, area, category, description, best_time, estimated_budget, crowd_tip, caution, google_maps_url, image_url, tags, moderation_status, creator_display_name, like_count, save_count, want_count, comment_count, created_at, updated_at';

type SpotRow = {
  id: string;
  user_id: string;
  name: string;
  area: string;
  category: string;
  description: string;
  best_time: string;
  estimated_budget: string;
  crowd_tip: string;
  caution: string;
  recommended_for?: string;
  google_maps_url: string;
  instagram_url?: string;
  tiktok_url?: string;
  image_url: string;
  tags: string[] | null;
  visibility?: string;
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
  const visibility = (row.visibility as LocalHiddenSpotVisibility | undefined) ?? 'public';
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
    recommendedFor: row.recommended_for ?? '',
    googleMapsUrl: row.google_maps_url,
    instagramUrl: row.instagram_url ?? '',
    tiktokUrl: row.tiktok_url ?? '',
    imageUrl: row.image_url,
    tags: row.tags ?? [],
    visibility,
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

async function querySpots(
  build: (select: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<SpotRow[]> {
  const extended = await build(SPOT_SELECT);
  if (!extended.error && extended.data) {
    return extended.data as SpotRow[];
  }

  console.warn('[LocalGems] extended columns unavailable, using legacy select');
  const legacy = await build(SPOT_SELECT_LEGACY);
  if (legacy.error) {
    throw new Error(legacy.error.message ?? '穴場スポットの取得に失敗しました');
  }
  return (legacy.data as SpotRow[]) ?? [];
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

  if (input.imageUrl?.trim()) {
    const url = input.imageUrl.trim();
    if (!url.startsWith('file://') && !/^https?:\/\//i.test(url)) {
      throw new Error('写真URLは https:// で始まるURLを入力してください');
    }
  }

  for (const url of [input.instagramUrl, input.tiktokUrl]) {
    if (url?.trim() && !/^https?:\/\//i.test(url.trim())) {
      throw new Error('SNSリンクは https:// で始まるURLを入力してください');
    }
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
  const area = options?.area?.trim();
  const limit = options?.limit ?? 24;

  const runQuery = (includeVisibility: boolean) =>
    querySpots((select) => {
      let query = supabase
        .from('local_hidden_spots')
        .select(select)
        .eq('moderation_status', 'active')
        .order('save_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (includeVisibility) {
        query = query.eq('visibility', 'public');
      }
      if (area) {
        query = query.ilike('area', `%${area}%`);
      }
      return query;
    });

  let rows: SpotRow[];
  try {
    rows = await runQuery(true);
  } catch {
    rows = await runQuery(false);
  }

  let spots = rows.map((row) => rowToSpot(row));
  spots = await attachCreatorMeta(spots);
  spots = await attachUserInteractions(spots);
  return spots.filter(isDiscoverableLocalHiddenSpot);
}

export async function fetchLocalHiddenSpotsByUserId(
  userId: string,
  options?: { includePrivate?: boolean },
): Promise<LocalHiddenSpot[]> {
  if (!isSupabaseConfigured() || !userId.trim()) return [];

  const supabase = getSupabase();
  const currentUserId = await getCurrentUserId();
  const isSelf = currentUserId === userId;

  const rows = await querySpots((select) => {
    let query = supabase
      .from('local_hidden_spots')
      .select(select)
      .eq('user_id', userId)
      .eq('moderation_status', 'active')
      .order('created_at', { ascending: false });

    if (!isSelf && !options?.includePrivate) {
      return query.eq('visibility', 'public');
    }

    return query;
  }).catch(() =>
    querySpots((select) =>
      supabase
        .from('local_hidden_spots')
        .select(select)
        .eq('user_id', userId)
        .eq('moderation_status', 'active')
        .order('created_at', { ascending: false }),
    ),
  );

  let spots = rows.map((row) => rowToSpot(row));
  if (!isSelf && !options?.includePrivate) {
    spots = spots.filter(isDiscoverableLocalHiddenSpot);
  }
  spots = await attachCreatorMeta(spots);
  spots = await attachUserInteractions(spots);
  return spots;
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
  if (!spotId.trim()) return null;

  console.log('[LocalGems] open gem', spotId);

  if (spotId.startsWith('sample:')) {
    return LOCAL_GEMS_SAMPLE_DATA.find((spot) => spot.id === spotId) ?? null;
  }

  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  let row: SpotRow | null = null;

  const extended = await supabase.from('local_hidden_spots').select(SPOT_SELECT).eq('id', spotId).maybeSingle();
  if (!extended.error && extended.data) {
    row = extended.data as SpotRow;
  } else {
    const legacy = await supabase
      .from('local_hidden_spots')
      .select(SPOT_SELECT_LEGACY)
      .eq('id', spotId)
      .maybeSingle();
    if (!legacy.error && legacy.data) {
      row = legacy.data as SpotRow;
    }
  }

  if (!row) return null;

  let spot = rowToSpot(row);
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
  const visibility = input.visibility ?? 'public';

  const payload = {
    user_id: user.id,
    name: input.name.trim(),
    area: input.area.trim(),
    category: input.category,
    description: input.description.trim(),
    best_time: input.bestTime?.trim() ?? '',
    estimated_budget: input.estimatedBudget?.trim() ?? '',
    crowd_tip: input.crowdTip?.trim() ?? '',
    caution: input.caution?.trim() ?? '',
    recommended_for: input.recommendedFor?.trim() ?? '',
    google_maps_url: input.googleMapsUrl?.trim() ?? '',
    instagram_url: input.instagramUrl?.trim() ?? '',
    tiktok_url: input.tiktokUrl?.trim() ?? '',
    image_url: input.imageUrl?.trim() ?? '',
    tags: input.tags,
    visibility,
    creator_display_name: displayName,
    moderation_status: 'active',
  };

  console.log('[LocalGems] create gem', payload);

  const { data, error } = await supabase
    .from('local_hidden_spots')
    .insert(payload)
    .select(SPOT_SELECT)
    .single();

  if (error) {
    console.warn('[LocalGems] extended insert failed, retrying legacy', error.message);
    const { data: legacyData, error: legacyError } = await supabase
      .from('local_hidden_spots')
      .insert({
        user_id: payload.user_id,
        name: payload.name,
        area: payload.area,
        category: payload.category,
        description: payload.description,
        best_time: payload.best_time,
        estimated_budget: payload.estimated_budget,
        crowd_tip: payload.crowd_tip,
        caution: payload.caution,
        google_maps_url: payload.google_maps_url,
        image_url: payload.image_url,
        tags: payload.tags,
        creator_display_name: payload.creator_display_name,
        moderation_status: 'active',
      })
      .select(SPOT_SELECT_LEGACY)
      .single();

    if (legacyError || !legacyData) {
      throw new Error(legacyError?.message ?? '穴場スポットの投稿に失敗しました');
    }
    return rowToSpot(legacyData as SpotRow);
  }

  if (!data) {
    throw new Error('穴場スポットの投稿に失敗しました');
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

  return /穴場|ローカル|ローカル感|地元|観光客.*少|隠れ|知る人ぞ知る|穴場好き|グルメ|デート/i.test(
    haystack,
  );
}
