import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

function assertBlocksConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'ブロック機能には Supabase の設定が必要です。\nmoderation.sql を実行してください。',
    );
  }
}

export async function getBlockedUserIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Set();

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_user_id')
    .eq('blocker_id', user.id);

  if (error) return new Set();
  return new Set((data ?? []).map((row) => row.blocked_user_id as string));
}

export async function isUserBlocked(blockedUserId: string): Promise<boolean> {
  const blockedIds = await getBlockedUserIds();
  return blockedIds.has(blockedUserId);
}

async function removeFollowRelations(blockerId: string, blockedUserId: string): Promise<void> {
  const supabase = getSupabase();
  await Promise.all([
    supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', blockerId)
      .eq('following_id', blockedUserId),
    supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', blockedUserId)
      .eq('following_id', blockerId),
  ]);
}

export async function blockUser(blockedUserId: string): Promise<void> {
  assertBlocksConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  if (user.id === blockedUserId) {
    throw new Error('自分自身をブロックすることはできません');
  }

  const { error } = await supabase.from('blocked_users').insert({
    blocker_id: user.id,
    blocked_user_id: blockedUserId,
  });

  if (error) {
    if (error.code === '23505') return;
    throw new Error(error.message ?? 'ブロックに失敗しました');
  }

  await removeFollowRelations(user.id, blockedUserId);
}

export async function unblockUser(blockedUserId: string): Promise<void> {
  assertBlocksConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('ログインが必要です');
  }

  await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_user_id', blockedUserId);
}

export function filterPlansByBlockedUsers<T extends { userId: string }>(
  items: T[],
  blockedUserIds: Set<string>,
): T[] {
  if (blockedUserIds.size === 0) return items;
  return items.filter((item) => !blockedUserIds.has(item.userId));
}

export function filterCommentsByBlockedUsers<T extends { userId: string }>(
  items: T[],
  blockedUserIds: Set<string>,
): T[] {
  if (blockedUserIds.size === 0) return items;
  return items.filter((item) => !blockedUserIds.has(item.userId));
}
