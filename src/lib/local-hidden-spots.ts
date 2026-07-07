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

/** Preferred Supabase table; legacy name kept as fallback. */
export const LOCAL_GEMS_TABLE = 'local_gems';
const LOCAL_GEMS_TABLE_LEGACY = 'local_hidden_spots';

const LOCAL_GEMS_SELECT =
  'id, user_id, name, area, category, description, tags, budget_level, crowd_level, recommended_for, caution_notes, image_url, google_maps_url, instagram_url, tiktok_url, visibility, saves_count, created_at, updated_at';

type LocalGemsRow = {
  id: string;
  user_id: string;
  name: string;
  area: string;
  category: string;
  description: string;
  tags: string[] | null;
  budget_level?: string;
  crowd_level?: string;
  recommended_for?: string[] | null;
  caution_notes?: string;
  image_url?: string;
  google_maps_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  visibility?: string;
  saves_count?: number;
  created_at: string;
  updated_at: string;
};

function parseTagsField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function normalizeGemVisibility(value?: string): LocalHiddenSpotVisibility {
  if (value === 'private' || value === 'unlisted') return value;
  if (value === '非公開') return 'private';
  if (value === '限定公開') return 'unlisted';
  return 'public';
}

export function isMissingLocalGemsTableError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message ?? error)
        : String(error ?? '');

  return (
    /Could not find the table/i.test(message) ||
    /schema cache/i.test(message) ||
    /PGRST\d+/i.test(message) ||
    /local_hidden_spots/i.test(message) ||
    /local_gems/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

function localGemsRowToSpot(row: LocalGemsRow): LocalHiddenSpot {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    area: row.area,
    category: row.category as LocalHiddenSpotCategory,
    description: row.description,
    bestTime: '',
    estimatedBudget: row.budget_level?.trim() ?? '',
    crowdTip: row.crowd_level?.trim() ?? '',
    caution: row.caution_notes?.trim() ?? '',
    recommendedFor: parseTagsField(row.recommended_for).join('、'),
    googleMapsUrl: row.google_maps_url?.trim() ?? '',
    instagramUrl: row.instagram_url?.trim() ?? '',
    tiktokUrl: row.tiktok_url?.trim() ?? '',
    imageUrl: row.image_url?.trim() ?? '',
    tags: parseTagsField(row.tags),
    visibility: normalizeGemVisibility(row.visibility),
    moderationStatus: 'active',
    creatorDisplayName: '',
    likeCount: 0,
    saveCount: row.saves_count ?? 0,
    wantCount: 0,
    commentCount: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function queryLocalGemsTable(options: {
  area?: string;
  limit: number;
  userId?: string;
  includePrivate?: boolean;
  spotId?: string;
}): Promise<LocalHiddenSpot[] | null> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  const area = options.area?.trim();
  const limit = options.limit;

  let query = supabase.from(LOCAL_GEMS_TABLE).select(LOCAL_GEMS_SELECT);

  if (options.spotId) {
    query = query.eq('id', options.spotId).limit(1);
  } else if (options.userId) {
    query = query
      .eq('user_id', options.userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!options.includePrivate) {
      query = query.in('visibility', ['public', '公開する']);
    }
  } else {
    query = query
      .in('visibility', ['public', '公開する'])
      .order('saves_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (area) {
      query = query.ilike('area', `%${area}%`);
    }
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingLocalGemsTableError(error)) {
      console.warn(`[LocalGems] table "${LOCAL_GEMS_TABLE}" unavailable`, error);
      return null;
    }
    console.warn('[LocalGems] failed to load from local_gems, continuing without local gems', error);
    return [];
  }

  const rows = (data as LocalGemsRow[]) ?? [];
  return rows.map(localGemsRowToSpot);
}

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
  build: (select: string, table: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<SpotRow[]> {
  for (const table of [LOCAL_GEMS_TABLE_LEGACY]) {
    const extended = await build(SPOT_SELECT, table);
    if (!extended.error && extended.data) {
      return extended.data as SpotRow[];
    }

    if (extended.error && isMissingLocalGemsTableError(extended.error)) {
      console.warn(`[LocalGems] table "${table}" unavailable`, extended.error);
      return [];
    }

    console.warn('[LocalGems] extended columns unavailable, using legacy select');
    const legacy = await build(SPOT_SELECT_LEGACY, table);
    if (!legacy.error && legacy.data) {
      return legacy.data as SpotRow[];
    }
    if (legacy.error) {
      if (isMissingLocalGemsTableError(legacy.error)) {
        console.warn(`[LocalGems] table "${table}" unavailable`, legacy.error);
        return [];
      }
      console.warn('[LocalGems] failed to load, continuing without local gems', legacy.error);
      return [];
    }
    return (legacy.data as SpotRow[]) ?? [];
  }

  return [];
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

  const area = options?.area?.trim();
  const limit = options?.limit ?? 24;

  try {
    const gemsResult = await queryLocalGemsTable({ area, limit });
    if (gemsResult !== null) {
      let spots = gemsResult;
      spots = await attachCreatorMeta(spots).catch(() => spots);
      spots = await attachUserInteractions(spots).catch(() => spots);
      return spots.filter(isDiscoverableLocalHiddenSpot);
    }

    const supabase = getSupabase();

    const runQuery = (includeVisibility: boolean) =>
      querySpots((select, table) => {
        let query = supabase
          .from(table)
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

    let rows: SpotRow[] = await runQuery(true);
    if (rows.length === 0) {
      rows = await runQuery(false);
    }

    let spots = rows.map((row) => rowToSpot(row));
    spots = await attachCreatorMeta(spots).catch(() => spots);
    spots = await attachUserInteractions(spots).catch(() => spots);
    return spots.filter(isDiscoverableLocalHiddenSpot);
  } catch (error) {
    console.warn('[LocalGems] optional local gems unavailable, continuing', error);
    return [];
  }
}

export async function fetchLocalHiddenSpotsByUserId(
  userId: string,
  options?: { includePrivate?: boolean },
): Promise<LocalHiddenSpot[]> {
  if (!isSupabaseConfigured() || !userId.trim()) return [];

  const supabase = getSupabase();
  const currentUserId = await getCurrentUserId();
  const isSelf = currentUserId === userId;

  const rows = await querySpots((select, table) => {
    let query = supabase
      .from(table)
      .select(select)
      .eq('user_id', userId)
      .eq('moderation_status', 'active')
      .order('created_at', { ascending: false });

    if (!isSelf && !options?.includePrivate) {
      return query.eq('visibility', 'public');
    }

    return query;
  }).catch(() =>
    querySpots((select, table) =>
      supabase
        .from(table)
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
  return loadRelevantLocalGemsForPlan(input);
}

/** Plan-generation safe loader — never throws; missing table returns []. */
export async function loadRelevantLocalGemsForPlan(input: {
  location: string;
  limit?: number;
}): Promise<LocalHiddenSpot[]> {
  const location = input.location.trim();
  if (!location) return [];

  try {
    const spots = await fetchLocalHiddenSpots({ limit: input.limit ?? 12 });
    if (spots.length === 0) {
      console.log('[TravelPlanSubmit] local gems count', 0);
      return [];
    }

    const normalized = location.toLowerCase();
    const matched = spots.filter(
      (spot) =>
        spot.area.toLowerCase().includes(normalized) ||
        normalized.includes(spot.area.toLowerCase()) ||
        spot.name.toLowerCase().includes(normalized),
    );

    const result = (matched.length > 0 ? matched : spots).slice(0, input.limit ?? 8);
    console.log('[TravelPlanSubmit] local gems count', result.length);
    return result;
  } catch (error) {
    console.warn('[LocalGems] optional local gems unavailable, continuing', error);
    console.log('[TravelPlanSubmit] local gems count', 0);
    return [];
  }
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
