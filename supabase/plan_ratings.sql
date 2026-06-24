-- Nanisuru: plan_ratings
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.plan_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  feedback_tags text[] NOT NULL DEFAULT '{}',
  plan_source text NOT NULL CHECK (plan_source IN ('home', 'imafima', 'best-day')),
  plan_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_ratings_user_id_idx ON public.plan_ratings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS plan_ratings_trip_id_idx ON public.plan_ratings (trip_id) WHERE trip_id IS NOT NULL;
ALTER TABLE public.plan_ratings ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plan_ratings' AND policyname = 'plan_ratings_select_own') THEN
    CREATE POLICY "plan_ratings_select_own" ON public.plan_ratings FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plan_ratings' AND policyname = 'plan_ratings_insert_own') THEN
    CREATE POLICY "plan_ratings_insert_own" ON public.plan_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plan_ratings' AND policyname = 'plan_ratings_update_own') THEN
    CREATE POLICY "plan_ratings_update_own" ON public.plan_ratings FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plan_ratings' AND policyname = 'plan_ratings_delete_own') THEN
    CREATE POLICY "plan_ratings_delete_own" ON public.plan_ratings FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;
