import { getUserDisplayName } from '@/lib/auth';
import { countLocalHiddenSpotsForUser } from '@/lib/local-hidden-spots';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  noteShowOnProfileColumnMissing,
  shouldUseShowOnProfileColumn,
} from '@/lib/supabase-schema-fallback';
import { countProfilePublicMemoriesForUser } from '@/lib/trip-memories';
import type { SaveUserProfileInput, UserProfile } from '@/types/user-profile';

type UserProfileRow = {
  user_id: string;
  display_name: string;
  bio: string;
  style_tags: string[] | null;
  avatar_url?: string;
  is_local_contributor?: boolean;
  local_expert_areas?: string[] | null;
  follower_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
};

const USER_PROFILE_SELECT =
  'user_id, display_name, bio, style_tags, avatar_url, is_local_contributor, local_expert_areas, follower_count, following_count, created_at, updated_at';

function assertProfilesConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'プロフィール機能には Supabase の設定が必要です。\nuser_profiles テーブルを作成してください。',
    );
  }
}

function rowToUserProfile(
  row: UserProfileRow,
  extras?: Partial<UserProfile>,
): UserProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    bio: row.bio,
    styleTags: row.style_tags ?? [],
    avatarUrl: row.avatar_url?.trim() || undefined,
    isLocalContributor: row.is_local_contributor ?? false,
    localExpertAreas: row.local_expert_areas ?? [],
    followerCount: row.follower_count,
    followingCount: row.following_count,
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

async function countPublicPlansForUser(userId: string): Promise<number> {
  const supabase = getSupabase();
  let query = supabase
    .from('public_plans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('visibility', 'public')
    .eq('is_public', true)
    .eq('is_removed', false)
    .eq('moderation_status', 'active');

  if (shouldUseShowOnProfileColumn()) {
    query = query.eq('show_on_profile', true);
  }

  let { count, error } = await query;

  if (error && noteShowOnProfileColumnMissing(error)) {
    ({ count, error } = await supabase
      .from('public_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('visibility', 'public')
      .eq('is_public', true)
      .eq('is_removed', false)
      .eq('moderation_status', 'active'));
  }

  if (error) return 0;
  return count ?? 0;
}

async function attachProfileCounts(userId: string): Promise<{
  publicPlanCount: number;
  publicMemoryCount: number;
  localSpotCount: number;
}> {
  const [publicPlanCount, publicMemoryCount, localSpotCount] = await Promise.all([
    countPublicPlansForUser(userId),
    countProfilePublicMemoriesForUser(userId),
    countLocalHiddenSpotsForUser(userId),
  ]);
  return { publicPlanCount, publicMemoryCount, localSpotCount };
}

async function isFollowingUser(
  followerId: string | null,
  followingId: string,
): Promise<boolean> {
  if (!followerId || followerId === followingId) return false;

  const supabase = getSupabase();
  const { data } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  return Boolean(data);
}

export async function ensureProfileForUserId(
  userId: string,
  fallbackDisplayName?: string,
): Promise<UserProfile> {
  assertProfilesConfigured();

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('user_profiles')
    .select(USER_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return rowToUserProfile(existing as UserProfileRow);
  }

  let displayName = fallbackDisplayName?.trim();
  if (!displayName) {
    const { data: plans } = await supabase
      .from('public_plans')
      .select('creator_display_name')
      .eq('user_id', userId)
      .limit(1);
    displayName = plans?.[0]?.creator_display_name ?? 'Nanisuruユーザー';
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      user_id: userId,
      display_name: displayName,
      bio: '',
      style_tags: [],
    })
    .select(USER_PROFILE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'プロフィールの作成に失敗しました');
  }

  return rowToUserProfile(data as UserProfileRow);
}

export async function ensureUserProfile(): Promise<UserProfile> {
  assertProfilesConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const profile = await ensureProfileForUserId(user.id, getUserDisplayName(user));
  const counts = await attachProfileCounts(user.id);
  return {
    ...profile,
    isSelf: true,
    ...counts,
  };
}

export async function getUserProfileById(userId: string): Promise<UserProfile | null> {
  assertProfilesConfigured();

  if (!userId.trim()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_profiles')
    .select(USER_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  const currentUserId = await getCurrentUserId();

  if (error || !data) {
    const { data: plans } = await supabase
      .from('public_plans')
      .select('creator_display_name')
      .eq('user_id', userId)
      .eq('visibility', 'public')
      .limit(1);

    const fallbackName = plans?.[0]?.creator_display_name;
    if (!fallbackName) return null;

    return {
      userId,
      displayName: fallbackName,
      bio: '',
      styleTags: [],
      isLocalContributor: false,
      localExpertAreas: [],
      followerCount: 0,
      followingCount: 0,
      ...(await attachProfileCounts(userId)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFollowing: await isFollowingUser(currentUserId, userId),
      isSelf: currentUserId === userId,
    };
  }

  const counts = await attachProfileCounts(userId);
  const profile = rowToUserProfile(data as UserProfileRow, {
    ...counts,
    isSelf: currentUserId === userId,
    isFollowing: await isFollowingUser(currentUserId, userId),
  });

  return profile;
}

export async function saveUserProfile(input: SaveUserProfileInput): Promise<UserProfile> {
  assertProfilesConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  await ensureUserProfile();

  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error('表示名を入力してください');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      display_name: displayName,
      bio: input.bio.trim(),
      style_tags: input.styleTags,
      is_local_contributor: input.isLocalContributor ?? false,
      local_expert_areas: input.localExpertAreas ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select(USER_PROFILE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'プロフィールの保存に失敗しました');
  }

  await supabase
    .from('public_plans')
    .update({ creator_display_name: displayName })
    .eq('user_id', user.id);

  await supabase.auth.updateUser({
    data: { full_name: displayName },
  });

  return rowToUserProfile(data as UserProfileRow, {
    isSelf: true,
    publicPlanCount: await countPublicPlansForUser(user.id),
  });
}

export async function fetchProfilesByUserIds(
  userIds: string[],
): Promise<Map<string, UserProfile>> {
  assertProfilesConfigured();

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_profiles')
    .select(USER_PROFILE_SELECT)
    .in('user_id', uniqueIds);

  const map = new Map<string, UserProfile>();
  if (error || !data) return map;

  for (const row of data as UserProfileRow[]) {
    map.set(row.user_id, rowToUserProfile(row));
  }

  return map;
}

export async function toggleFollowUser(
  followingId: string,
): Promise<{ isFollowing: boolean; followerCount: number }> {
  assertProfilesConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  if (user.id === followingId) {
    throw new Error('自分自身をフォローすることはできません');
  }

  const { isUserBlocked } = await import('@/lib/user-blocks');
  if (await isUserBlocked(followingId)) {
    throw new Error('ブロック中のユーザーはフォローできません');
  }

  await ensureUserProfile();

  const { data: existing } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', followingId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', followingId);

    if (error) {
      throw new Error(error.message ?? 'フォロー解除に失敗しました');
    }
  } else {
    const { error } = await supabase.from('user_follows').insert({
      follower_id: user.id,
      following_id: followingId,
    });

    if (error) {
      throw new Error(error.message ?? 'フォローに失敗しました');
    }

    const { notifyUserFollowed } = await import('@/lib/notifications');
    void notifyUserFollowed(followingId, user.id);
  }

  const profile = await getUserProfileById(followingId);
  if (!profile) {
    throw new Error('プロフィールが見つかりません');
  }

  return {
    isFollowing: !existing,
    followerCount: profile.followerCount,
  };
}

export async function getFollowingIdsForUsers(
  followerId: string,
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const supabase = getSupabase();
  const { data } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', followerId)
    .in('following_id', userIds);

  return new Set((data ?? []).map((row) => row.following_id as string));
}

export async function getPublicDisplayName(userId: string): Promise<string> {
  const profile = await getUserProfileById(userId);
  return profile?.displayName ?? 'Nanisuruユーザー';
}
