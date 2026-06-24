import { getUserDisplayName } from '@/lib/auth';
import {
  ensureUserProfile,
  fetchProfilesByUserIds,
  getFollowingIdsForUsers,
} from '@/lib/user-profiles';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { SavedTripPayload } from '@/types/trip';
import type {
  DiscoverSortOption,
  PublicPlan,
  PublicPlanCategory,
  PublicPlanVisibility,
  PublishPublicPlanInput,
} from '@/types/public-plan';
import { parseBudgetAmount } from '@/types/public-plan';

type PublicPlanRow = {
  id: string;
  user_id: string;
  source_trip_id: string | null;
  title: string;
  description: string;
  category: PublicPlanCategory;
  tags: string[] | null;
  visibility: PublicPlanVisibility;
  creator_display_name: string;
  payload: SavedTripPayload;
  like_count: number;
  save_count: number;
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
    creatorDisplayName: row.creator_display_name,
    payload: row.payload,
    likeCount: row.like_count,
    saveCount: row.save_count,
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

function applyDiscoverSort(plans: PublicPlan[], sort: DiscoverSortOption): PublicPlan[] {
  const visible = plans.filter((plan) => plan.visibility === 'public');

  switch (sort) {
    case 'popular':
      return [...visible].sort((a, b) => b.likeCount - a.likeCount || b.createdAt.localeCompare(a.createdAt));
    case 'newest':
      return [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'date':
      return visible.filter((plan) => plan.category === 'デート');
    case 'gourmet':
      return visible.filter(
        (plan) =>
          plan.category === 'グルメ' ||
          plan.payload.personality === 'グルメ' ||
          plan.tags.some((tag) => tag.includes('グルメ')),
      );
    case 'travel':
      return visible.filter((plan) => plan.category === '旅行');
    case 'low_budget':
      return [...visible].sort((a, b) => parseBudgetAmount(a) - parseBudgetAmount(b));
    case 'rainy_day':
      return visible.filter(
        (plan) =>
          plan.tags.some((tag) => tag.includes('雨')) ||
          (plan.payload.details?.rainyDayAlternatives?.length ?? 0) > 0,
      );
    default:
      return visible;
  }
}

export async function fetchPublicPlans(sort: DiscoverSortOption): Promise<PublicPlan[]> {
  assertPublicPlansConfigured();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plans')
    .select(
      'id, user_id, source_trip_id, title, description, category, tags, visibility, creator_display_name, payload, like_count, save_count, created_at, updated_at',
    )
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    throw new Error(error.message ?? '公開プランの取得に失敗しました');
  }

  const plans = applyDiscoverSort((data as PublicPlanRow[]).map((row) => rowToPublicPlan(row)), sort);
  const sliced = plans.slice(0, 30);
  const withInteractions = await attachUserInteractions(sliced);
  return attachCreatorSocial(withInteractions);
}

export async function fetchPublicPlansByUserId(userId: string): Promise<PublicPlan[]> {
  assertPublicPlansConfigured();

  if (!userId.trim()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plans')
    .select(
      'id, user_id, source_trip_id, title, description, category, tags, visibility, creator_display_name, payload, like_count, save_count, created_at, updated_at',
    )
    .eq('user_id', userId)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message ?? '公開プランの取得に失敗しました');
  }

  const plans = (data as PublicPlanRow[]).map((row) => rowToPublicPlan(row));
  const withInteractions = await attachUserInteractions(plans);
  return attachCreatorSocial(withInteractions);
}

export async function getPublicPlanById(planId: string): Promise<PublicPlan | null> {
  assertPublicPlansConfigured();

  if (!planId.trim()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plans')
    .select(
      'id, user_id, source_trip_id, title, description, category, tags, visibility, creator_display_name, payload, like_count, save_count, created_at, updated_at',
    )
    .eq('id', planId)
    .maybeSingle();

  if (error || !data) return null;

  const plan = rowToPublicPlan(data as PublicPlanRow);
  if (plan.visibility === 'private') {
    const userId = await getCurrentUserId();
    if (userId !== plan.userId) return null;
  }

  const [withInteractions] = await attachUserInteractions([plan]);
  const [withSocial] = await attachCreatorSocial([withInteractions]);
  return withSocial;
}

export async function getPublishedPlanForTrip(tripId: string): Promise<PublicPlan | null> {
  assertPublicPlansConfigured();

  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plans')
    .select(
      'id, user_id, source_trip_id, title, description, category, tags, visibility, creator_display_name, payload, like_count, save_count, created_at, updated_at',
    )
    .eq('source_trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToPublicPlan(data as PublicPlanRow);
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

  const row = {
    user_id: user.id,
    source_trip_id: input.sourceTripId,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    tags: input.tags,
    visibility: input.visibility,
    creator_display_name: creatorDisplayName,
    payload: input.payload,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from('public_plans')
      .update(row)
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .select(
        'id, user_id, source_trip_id, title, description, category, tags, visibility, creator_display_name, payload, like_count, save_count, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? '公開プランの更新に失敗しました');
    }

    return rowToPublicPlan(data as PublicPlanRow);
  }

  const { data, error } = await supabase
    .from('public_plans')
    .insert(row)
    .select(
      'id, user_id, source_trip_id, title, description, category, tags, visibility, creator_display_name, payload, like_count, save_count, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '公開プランの作成に失敗しました');
  }

  return rowToPublicPlan(data as PublicPlanRow);
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

  return { savedTripId: savedTrip.id as string };
}

export function parseTagsInput(value: string): string[] {
  return value
    .split(/[,、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}
