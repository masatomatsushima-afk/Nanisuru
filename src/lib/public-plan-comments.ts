import { getUserDisplayName } from '@/lib/auth';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { filterCommentsByBlockedUsers, getBlockedUserIds } from '@/lib/user-blocks';
import { fetchProfilesByUserIds } from '@/lib/user-profiles';
import type { PublicPlanComment } from '@/types/public-plan-feedback';

type CommentRow = {
  id: string;
  public_plan_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
};

const MAX_COMMENT_LENGTH = 500;

function assertCommentsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'コメント機能には Supabase の設定が必要です。\npublic_plan_comments テーブルを作成してください。',
    );
  }
}

export function formatPublicPlanCommentTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function fetchPublicPlanComments(publicPlanId: string): Promise<PublicPlanComment[]> {
  assertCommentsConfigured();

  if (!publicPlanId.trim()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_plan_comments')
    .select('id, public_plan_id, user_id, comment_text, created_at')
    .eq('public_plan_id', publicPlanId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message ?? 'コメントの取得に失敗しました');
  }

  const rows = (data ?? []) as CommentRow[];
  if (rows.length === 0) return [];

  const profiles = await fetchProfilesByUserIds(rows.map((row) => row.user_id));
  const blockedUserIds = await getBlockedUserIds();

  return filterCommentsByBlockedUsers(
    rows.map((row) => ({
      id: row.id,
      publicPlanId: row.public_plan_id,
      userId: row.user_id,
      commentText: row.comment_text,
      createdAt: row.created_at,
      displayName: profiles.get(row.user_id)?.displayName ?? 'ユーザー',
    })),
    blockedUserIds,
  );
}

export async function postPublicPlanComment(
  publicPlanId: string,
  commentText: string,
): Promise<PublicPlanComment> {
  assertCommentsConfigured();

  const trimmed = commentText.trim();
  if (!trimmed) {
    throw new Error('コメントを入力してください');
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(`コメントは${MAX_COMMENT_LENGTH}文字以内で入力してください`);
  }

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { data, error } = await supabase
    .from('public_plan_comments')
    .insert({
      public_plan_id: publicPlanId,
      user_id: user.id,
      comment_text: trimmed,
    })
    .select('id, public_plan_id, user_id, comment_text, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'コメントの投稿に失敗しました');
  }

  const row = data as CommentRow;
  const profiles = await fetchProfilesByUserIds([row.user_id]);
  const displayName =
    profiles.get(row.user_id)?.displayName ?? getUserDisplayName(user) ?? 'ユーザー';

  const { notifyPlanCommented } = await import('@/lib/notifications');
  void notifyPlanCommented(publicPlanId, user.id, trimmed);

  return {
    id: row.id,
    publicPlanId: row.public_plan_id,
    userId: row.user_id,
    commentText: row.comment_text,
    createdAt: row.created_at,
    displayName,
  };
}

export { MAX_COMMENT_LENGTH };
