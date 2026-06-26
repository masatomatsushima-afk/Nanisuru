import { getUserDisplayName } from '@/lib/auth';
import {
  ensureUserProfile,
  fetchProfilesByUserIds,
  getFollowingIdsForUsers,
} from '@/lib/user-profiles';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { SavedTripPayload } from '@/types/trip';
import type {
  PublicPlan,
  PublicPlanCategory,
  PublicPlanVisibility,
  PublishPublicPlanInput,
} from '@/types/public-plan';
import {
  fetchImagesForPlan,
  fetchImagesForPlans,
  syncPublicPlanImages,
} from '@/lib/public-plan-images';
import {
  fetchVideosForPlan,
  fetchVideosForPlans,
  syncPublicPlanVideos,
  validateVideoDrafts,
} from '@/lib/public-plan-videos';
import { notifyPlanLiked, notifyPlanSaved } from '@/lib/notifications';
import {
  noteShowOnProfileColumnMissing,
  shouldUseShowOnProfileColumn,
} from '@/lib/supabase-schema-fallback';
import { getBlockedUserIds, filterPlansByBlockedUsers } from '@/lib/user-blocks';
import type { PublicPlanModerationStatus } from '@/types/public-plan';
import { isDiscoverablePublicPlan } from '@/types/public-plan';

const PUBLIC_PLAN_SELECT_BASE =
  'id, user_id, source_trip_id, title, description, category, tags, visibility, is_public, is_removed, moderation_status, creator_display_name, payload, like_count, save_count, copy_count, comment_count, created_at, updated_at';

const PUBLIC_PLAN_SELECT = `${PUBLIC_PLAN_SELECT_BASE}, show_on_profile`;

function resolvePublicPlanSelect(): string {
  return shouldUseShowOnProfileColumn() ? PUBLIC_PLAN_SELECT : PUBLIC_PLAN_SELECT_BASE;
}

async function selectPublicPlans(
  queryFn: (select: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<{ data: unknown; error: { message?: string } | null }> {
  const first = await queryFn(resolvePublicPlanSelect());
  if (first.error && noteShowOnProfileColumnMissing(first.error)) {
    return queryFn(PUBLIC_PLAN_SELECT_BASE);
  }
  return first;
}

type PublicPlanRow = {
  id: string;
  user_id: string;
  source_trip_id: string | null;
  title: string;
  description: string;
  category: PublicPlanCategory;
  tags: string[] | null;
  visibility: PublicPlanVisibility;
  is_public?: boolean;
  is_removed?: boolean;
  moderation_status?: PublicPlanModerationStatus;
  creator_display_name: string;
  payload: SavedTripPayload;
  like_count: number;
  save_count: number;
  copy_count?: number;
  comment_count?: number;
  show_on_profile?: boolean;
  created_at: string;
  updated_at: string;
};

function assertPublicPlansConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '発見機能には Supabase の設定が必要です。\n.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定し、public_plans テーブルを作成してください。',
    );
  }
}

function rowToPublicPlan(row: PublicPlanRow, extras?: Partial<PublicPlan>): PublicPlan {
  return {
    id: row.id,
    userId: row.user_id,
    sourceTripId: row.source_trip_id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    visibility: row.visibility,
    isPublic: row.is_public ?? row.visibility === 'public',
    isRemoved: row.is_removed ?? false,
    moderationStatus: row.moderation_status ?? 'active',
    creatorDisplayName: row.creator_display_name,
    payload: row.payload,
    likeCount: row.like_count,
    saveCount: row.save_count,
    copyCount: row.copy_count ?? 0,
    commentCount: row.comment_count ?? 0,
    showOnProfile: row.show_on_profile ?? true,
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

async function attachUserInteractions(plans: PublicPlan[]): Promise<PublicPlan[]> {
  const userId = await getCurrentUserId();
  if (!userId || plans.length === 0) return plans;

  const planIds = plans.map((plan) => plan.id);
  const supabase = getSupabase();

  const [{ data: likes }, { data: saves }] = await Promise.all([
    supabase
      .from('public_plan_likes')
      .select('public_plan_id')
      .eq('user_id', userId)
      .in('public_plan_id', planIds),
    supabase
      .from('public_plan_saves')
      .select('public_plan_id')
      .eq('user_id', userId)
      .in('public_plan_id', planIds),
  ]);

  const likedIds = new Set((likes ?? []).map((row) => row.public_plan_id as string));
  const savedIds = new Set((saves ?? []).map((row) => row.public_plan_id as string));

  return plans.map((plan) => ({
    ...plan,
    likedByMe: likedIds.has(plan.id),
    savedByMe: savedIds.has(plan.id),
  }));
}

async function attachCreatorSocial(plans: PublicPlan[]): Promise<PublicPlan[]> {
  if (plans.length === 0) return plans;

  const userIds = [...new Set(plans.map((plan) => plan.userId))];
  const currentUserId = await getCurrentUserId();
  const [profiles, followingIds] = await Promise.all([
    fetchProfilesByUserIds(userIds),
    currentUserId ? getFollowingIdsForUsers(currentUserId, userIds) : Promise.resolve(new Set<string>()),
  ]);

  return plans.map((plan) => {
    const profile = profiles.get(plan.userId);
    return {
      ...plan,
      creatorDisplayName: profile?.displayName ?? plan.creatorDisplayName,
      creatorFollowerCount: profile?.followerCount ?? 0,
      isFollowingCreator: followingIds.has(plan.userId),
    };
  });
}

async function attachPlanImages(plans: PublicPlan[]): Promise<PublicPlan[]> {
  if (plans.length === 0) return plans;

  const imageMap = await fetchImagesForPlans(plans.map((plan) => plan.id));
  return plans.map((plan) => ({
    ...plan,
    images: imageMap.get(plan.id) ?? [],
  }));
}

async function attachPlanVideos(plans: PublicPlan[]): Promise<PublicPlan[]> {
  if (plans.length === 0) return plans;

  const videoMap = await fetchVideosForPlans(plans.map((plan) => plan.id));
  return plans.map((plan) => ({
    ...plan,
    videos: videoMap.get(plan.id) ?? [],
  }));
}

async function finalizePlans(plans: PublicPlan[]): Promise<PublicPlan[]> {
  const blockedUserIds = await getBlockedUserIds();
  const visiblePlans = filterPlansByBlockedUsers(plans, blockedUserIds);
  const withInteractions = await attachUserInteractions(visiblePlans);
  const withSocial = await attachCreatorSocial(withInteractions);
  const withImages = await attachPlanImages(withSocial);
  return attachPlanVideos(withImages);
}

export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  assertPublicPlansConfigured();

  const supabase = getSupabase();
  const { data, error } = await selectPublicPlans((select) =>
    supabase
      .from('public_plans')
      .select(select)
      .eq('visibility', 'public')
      .eq('is_public', true)
      .eq('is_removed', false)
      .eq('moderation_status', 'active')
      .order('created_at', { ascending: false })
      .limit(100),
  );

  if (error) {
    throw new Error(error.message ?? '公開プランの取得に失敗しました');
  }

  const plans = (data as PublicPlanRow[])
    .map((row) => rowToPublicPlan(row))
    .filter(isDiscoverablePublicPlan);
  return finalizePlans(plans);
}

export async function fetchPublicPlansByUserId(userId: string): Promise<PublicPlan[]> {
  assertPublicPlansConfigured();

  if (!userId.trim()) return [];

  const supabase = getSupabase();
  const { data, error } = await selectPublicPlans((select) => {
    let query = supabase
      .from('public_plans')
      .select(select)
      .eq('user_id', userId)
      .eq('visibility', 'public')
      .eq('is_public', true)
      .eq('is_removed', false)
      .eq('moderation_status', 'active');

    if (shouldUseShowOnProfileColumn()) {
      query = query.eq('show_on_profile', true);
    }

    return query.order('created_at', { ascending: false });
  });

  if (error) {
    throw new Error(error.message ?? '公開プランの取得に失敗しました');
  }

  const plans = (data as PublicPlanRow[]).map((row) => rowToPublicPlan(row));
  return finalizePlans(plans);
}

export async function getPublicPlanById(planId: string): Promise<PublicPlan | null> {
  assertPublicPlansConfigured();

  if (!planId.trim()) return null;

  const supabase = getSupabase();
  const { data, error } = await selectPublicPlans((select) =>
    supabase.from('public_plans').select(select).eq('id', planId).maybeSingle(),
  );

  if (error || !data) return null;

  const plan = rowToPublicPlan(data as PublicPlanRow);
  const userId = await getCurrentUserId();
  const isOwner = userId === plan.userId;

  if (plan.visibility === 'private' && !isOwner) return null;
  if (!isOwner && !isDiscoverablePublicPlan(plan) && plan.visibility !== 'unlisted') {
    return null;
  }

  if (!isOwner) {
    const blockedUserIds = await getBlockedUserIds();
    if (blockedUserIds.has(plan.userId)) return null;
  }

  const [withSocial] = await finalizePlans([plan]);
  return withSocial;
}

export async function getPublishedPlanForTrip(tripId: string): Promise<PublicPlan | null> {
  assertPublicPlansConfigured();

  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = getSupabase();
  const { data, error } = await selectPublicPlans((select) =>
    supabase
      .from('public_plans')
      .select(select)
      .eq('source_trip_id', tripId)
      .eq('user_id', userId)
      .maybeSingle(),
  );

  if (error || !data) return null;
  const plan = rowToPublicPlan(data as PublicPlanRow);
  const [images, videos] = await Promise.all([
    fetchImagesForPlan(plan.id),
    fetchVideosForPlan(plan.id),
  ]);
  return { ...plan, images, videos };
}

export async function publishPublicPlan(input: PublishPublicPlanInput): Promise<PublicPlan> {
  assertPublicPlansConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const profile = await ensureUserProfile();
  const creatorDisplayName = profile.displayName;
  const existing = await getPublishedPlanForTrip(input.sourceTripId);

  if (input.videoDrafts) {
    const videoError = validateVideoDrafts(input.videoDrafts);
    if (videoError) {
      throw new Error(videoError);
    }
  }

  const row = {
    user_id: user.id,
    source_trip_id: input.sourceTripId,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    tags: input.tags,
    visibility: input.visibility,
    is_public: input.visibility === 'public',
    is_removed: false,
    moderation_status: 'active' as const,
    creator_display_name: creatorDisplayName,
    payload: input.payload,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await selectPublicPlans((select) =>
      supabase
        .from('public_plans')
        .update(row)
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .select(select)
        .single(),
    );

    if (error || !data) {
      throw new Error(error?.message ?? '公開プランの更新に失敗しました');
    }

    const plan = rowToPublicPlan(data as PublicPlanRow);
    const [images, videos] = await Promise.all([
      input.imageDrafts
        ? syncPublicPlanImages(plan.id, user.id, input.imageDrafts, input.visibility)
        : fetchImagesForPlan(plan.id),
      input.videoDrafts
        ? syncPublicPlanVideos(plan.id, input.videoDrafts)
        : fetchVideosForPlan(plan.id),
    ]);
    return { ...plan, images, videos };
  }

  const { data, error } = await selectPublicPlans((select) =>
    supabase.from('public_plans').insert(row).select(select).single(),
  );

  if (error || !data) {
    throw new Error(error?.message ?? '公開プランの作成に失敗しました');
  }

  const plan = rowToPublicPlan(data as PublicPlanRow);
  const [images, videos] = await Promise.all([
    input.imageDrafts
      ? syncPublicPlanImages(plan.id, user.id, input.imageDrafts, input.visibility)
      : Promise.resolve([]),
    input.videoDrafts
      ? syncPublicPlanVideos(plan.id, input.videoDrafts)
      : Promise.resolve([]),
  ]);
  return { ...plan, images, videos };
}

export async function togglePublicPlanLike(
  planId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  assertPublicPlansConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { data: existingLike } = await supabase
    .from('public_plan_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('public_plan_id', planId)
    .maybeSingle();

  if (existingLike) {
    const { error } = await supabase
      .from('public_plan_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('public_plan_id', planId);

    if (error) {
      throw new Error(error.message ?? 'いいねの解除に失敗しました');
    }
  } else {
    const { error } = await supabase.from('public_plan_likes').insert({
      user_id: user.id,
      public_plan_id: planId,
    });

    if (error) {
      throw new Error(error.message ?? 'いいねに失敗しました');
    }

    void notifyPlanLiked(planId, user.id);
  }

  const plan = await getPublicPlanById(planId);
  if (!plan) {
    throw new Error('公開プランが見つかりません');
  }

  return {
    liked: !existingLike,
    likeCount: plan.likeCount,
  };
}

export async function savePublicPlanToMyTrips(planId: string): Promise<{ savedTripId: string }> {
  assertPublicPlansConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const plan = await getPublicPlanById(planId);
  if (!plan) {
    throw new Error('公開プランが見つかりません');
  }

  const { data: existingSave } = await supabase
    .from('public_plan_saves')
    .select('saved_trip_id')
    .eq('user_id', user.id)
    .eq('public_plan_id', planId)
    .maybeSingle();

  if (existingSave?.saved_trip_id) {
    return { savedTripId: existingSave.saved_trip_id as string };
  }

  const { data: savedTrip, error: tripError } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      title: plan.title,
      payload: plan.payload,
    })
    .select('id')
    .single();

  if (tripError || !savedTrip) {
    throw new Error(tripError?.message ?? 'プランの保存に失敗しました');
  }

  const { error: saveError } = await supabase.from('public_plan_saves').insert({
    user_id: user.id,
    public_plan_id: planId,
    saved_trip_id: savedTrip.id,
  });

  if (saveError) {
    throw new Error(saveError.message ?? '保存記録の作成に失敗しました');
  }

  void notifyPlanSaved(planId, user.id);

  return { savedTripId: savedTrip.id as string };
}

export async function stopPublicPlan(planId: string): Promise<PublicPlan> {
  assertPublicPlansConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { data, error } = await selectPublicPlans((select) =>
    supabase
      .from('public_plans')
      .update({
        visibility: 'private',
        is_public: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .eq('user_id', user.id)
      .select(select)
      .single(),
  );

  if (error || !data) {
    throw new Error(error?.message ?? '公開の停止に失敗しました');
  }

  return rowToPublicPlan(data as PublicPlanRow);
}

export async function deletePublicPlan(planId: string): Promise<void> {
  assertPublicPlansConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { error } = await supabase
    .from('public_plans')
    .update({
      visibility: 'private',
      is_public: false,
      is_removed: true,
      moderation_status: 'removed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(error.message ?? '公開プランの削除に失敗しました');
  }
}

export function parseTagsInput(value: string): string[] {
  return value
    .split(/[,、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function togglePublicPlanShowOnProfile(
  planId: string,
  showOnProfile: boolean,
): Promise<PublicPlan> {
  assertPublicPlansConfigured();

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const supabase = getSupabase();
  const { data, error } = await selectPublicPlans((select) =>
    supabase
      .from('public_plans')
      .update({ show_on_profile: showOnProfile, updated_at: new Date().toISOString() })
      .eq('id', planId)
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

  const [plan] = await finalizePlans([rowToPublicPlan(data as PublicPlanRow)]);
  return plan;
}
