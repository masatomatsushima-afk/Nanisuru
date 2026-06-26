import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ReportTargetType } from '@/types/moderation';

function assertReportsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '通報機能には Supabase の設定が必要です。\nmoderation.sql を実行してください。',
    );
  }
}

export async function submitContentReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}): Promise<void> {
  assertReportsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('通報理由を選択してください');
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason,
    details: input.details?.trim() ?? '',
  });

  if (error) {
    throw new Error(error.message ?? '通報の送信に失敗しました');
  }
}

export async function reportPublicPlan(
  planId: string,
  reason: string,
  details?: string,
): Promise<void> {
  await submitContentReport({
    targetType: 'public_plan',
    targetId: planId,
    reason,
    details,
  });
}

export async function reportComment(
  commentId: string,
  reason: string,
  details?: string,
): Promise<void> {
  await submitContentReport({
    targetType: 'comment',
    targetId: commentId,
    reason,
    details,
  });
}

export async function reportUser(
  userId: string,
  reason: string,
  details?: string,
): Promise<void> {
  await submitContentReport({
    targetType: 'user',
    targetId: userId,
    reason,
    details,
  });
}

export async function reportLocalHiddenSpot(
  spotId: string,
  reason: string,
  details?: string,
): Promise<void> {
  await submitContentReport({
    targetType: 'local_hidden_spot',
    targetId: spotId,
    reason,
    details,
  });
}
