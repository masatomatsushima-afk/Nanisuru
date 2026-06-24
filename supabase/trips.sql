-- Nanisuru: saved_trips（実テーブル名: trips）
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trips_user_id_created_at_idx
  ON public.trips (user_id, created_at DESC);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trips' AND policyname = 'trips_select_own'
  ) THEN
    CREATE POLICY "trips_select_own" ON public.trips FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trips' AND policyname = 'trips_insert_own'
  ) THEN
    CREATE POLICY "trips_insert_own" ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trips' AND policyname = 'trips_update_own'
  ) THEN
    CREATE POLICY "trips_update_own" ON public.trips FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trips' AND policyname = 'trips_delete_own'
  ) THEN
    CREATE POLICY "trips_delete_own" ON public.trips FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;
