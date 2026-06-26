import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { BetaFeedback, BetaFeedbackInput } from '@/types/beta-feedback';

type BetaFeedbackRow = {
  id: string;
  user_id: string;
  rating: number;
  ease_of_use: string;
  confusing_points: string;
  would_use_again: string;
  would_recommend: string;
  requested_features: string;
  bug_report: string;
  created_at: string;
};

function assertBetaFeedbackConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'フィードバック保存には Supabase の設定が必要です。\nsupabase/beta_feedback.sql を実行してください。',
    );
  }
}

function rowToBetaFeedback(row: BetaFeedbackRow): BetaFeedback {
  return {
    id: row.id,
    userId: row.user_id,
    rating: row.rating,
    easeOfUse: row.ease_of_use,
    confusingPoints: row.confusing_points,
    wouldUseAgain: row.would_use_again,
    wouldRecommend: row.would_recommend,
    requestedFeatures: row.requested_features,
    bugReport: row.bug_report,
    createdAt: row.created_at,
  };
}

export async function submitBetaFeedback(input: BetaFeedbackInput): Promise<BetaFeedback> {
  assertBetaFeedbackConfigured();

  if (input.rating < 1 || input.rating > 5) {
    throw new Error('評価は1〜5の星で選んでください');
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
    .from('beta_feedback')
    .insert({
      user_id: user.id,
      rating: input.rating,
      ease_of_use: input.easeOfUse.trim(),
      confusing_points: input.confusingPoints.trim(),
      would_use_again: input.wouldUseAgain.trim(),
      would_recommend: input.wouldRecommend.trim(),
      requested_features: input.requestedFeatures.trim(),
      bug_report: input.bugReport.trim(),
    })
    .select(
      'id, user_id, rating, ease_of_use, confusing_points, would_use_again, would_recommend, requested_features, bug_report, created_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'フィードバックの送信に失敗しました');
  }

  return rowToBetaFeedback(data as BetaFeedbackRow);
}
