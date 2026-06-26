import { getUserDisplayName } from '@/lib/auth';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchProfilesByUserIds } from '@/lib/user-profiles';
import type { LocalHiddenSpotComment } from '@/types/local-hidden-spot';

type CommentRow = {
  id: string;
  spot_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
};

function assertConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('コメント機能には Supabase の設定が必要です');
  }
}

export function formatLocalSpotCommentTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function fetchLocalHiddenSpotComments(
  spotId: string,
): Promise<LocalHiddenSpotComment[]> {
  assertConfigured();
  if (!spotId.trim()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('local_hidden_spot_comments')
    .select('id, spot_id, user_id, comment_text, created_at')
    .eq('spot_id', spotId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message ?? 'コメントの取得に失敗しました');
  }

  const rows = (data ?? []) as CommentRow[];
  if (rows.length === 0) return [];

  const profiles = await fetchProfilesByUserIds(rows.map((row) => row.user_id));

  return rows.map((row) => ({
    id: row.id,
    spotId: row.spot_id,
    userId: row.user_id,
    commentText: row.comment_text,
    createdAt: row.created_at,
    displayName: profiles.get(row.user_id)?.displayName ?? 'ユーザー',
  }));
}

export async function postLocalHiddenSpotComment(
  spotId: string,
  commentText: string,
): Promise<LocalHiddenSpotComment> {
  assertConfigured();

  const trimmed = commentText.trim();
  if (!trimmed) throw new Error('コメントを入力してください');
  if (trimmed.length > 500) throw new Error('コメントは500文字以内にしてください');

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { data, error } = await supabase
    .from('local_hidden_spot_comments')
    .insert({
      spot_id: spotId,
      user_id: user.id,
      comment_text: trimmed,
    })
    .select('id, spot_id, user_id, comment_text, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'コメントの投稿に失敗しました');
  }

  const row = data as CommentRow;
  return {
    id: row.id,
    spotId: row.spot_id,
    userId: row.user_id,
    commentText: row.comment_text,
    createdAt: row.created_at,
    displayName: getUserDisplayName(user),
  };
}
