-- Nanisuru: reports & blocked_users（モデレーション）
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false;
ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS public_plans_discoverable_idx
  ON public.public_plans (visibility, is_public, is_removed, moderation_status, created_at DESC);

UPDATE public.public_plans
SET is_public = (visibility = 'public' AND NOT is_removed AND moderation_status = 'active'), updated_at = now()
WHERE is_public IS DISTINCT FROM (visibility = 'public' AND NOT is_removed AND moderation_status = 'active');

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('public_plan', 'comment', 'user')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_target_idx ON public.reports (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_user_id),
  CHECK (blocker_id <> blocked_user_id)
);
CREATE INDEX IF NOT EXISTS blocked_users_blocker_idx ON public.blocked_users (blocker_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'reports_insert_own') THEN
    CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocked_users' AND policyname = 'blocked_users_read_own') THEN
    CREATE POLICY "blocked_users_read_own" ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocked_users' AND policyname = 'blocked_users_insert_own') THEN
    CREATE POLICY "blocked_users_insert_own" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocked_users' AND policyname = 'blocked_users_delete_own') THEN
    CREATE POLICY "blocked_users_delete_own" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);
  END IF;
END
$policy$;
