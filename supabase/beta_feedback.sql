-- Nanisuru: ベータテストフィードバック
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  ease_of_use text NOT NULL DEFAULT '',
  confusing_points text NOT NULL DEFAULT '',
  would_use_again text NOT NULL DEFAULT '',
  would_recommend text NOT NULL DEFAULT '',
  requested_features text NOT NULL DEFAULT '',
  bug_report text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beta_feedback_user_created_idx
  ON public.beta_feedback (user_id, created_at DESC);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beta_feedback' AND policyname = 'beta_feedback_insert_own'
  ) THEN
    CREATE POLICY "beta_feedback_insert_own"
      ON public.beta_feedback
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beta_feedback' AND policyname = 'beta_feedback_select_own'
  ) THEN
    CREATE POLICY "beta_feedback_select_own"
      ON public.beta_feedback
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$policy$;
