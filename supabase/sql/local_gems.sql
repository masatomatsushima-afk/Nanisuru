-- Nanisuru: local_gems (preferred table for local hidden gems)
-- Plan generation treats local gems as optional — this table is not required to generate plans.
-- Also see: ../migrations/008_local_gems.sql and ../migrations/010_rls_public_visibility.sql

CREATE TABLE IF NOT EXISTS public.local_gems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  area text NOT NULL,
  category text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]',
  budget_level text NOT NULL DEFAULT '',
  crowd_level text NOT NULL DEFAULT '',
  recommended_for jsonb NOT NULL DEFAULT '[]',
  caution_notes text NOT NULL DEFAULT '',
  image_url text,
  google_maps_url text,
  instagram_url text,
  tiktok_url text,
  visibility text NOT NULL DEFAULT '公開する',
  saves_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS local_gems_user_idx
  ON public.local_gems (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS local_gems_public_idx
  ON public.local_gems (visibility, saves_count DESC)
  WHERE visibility IN ('公開する', 'public');

ALTER TABLE public.local_gems ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_gems'
      AND policyname = 'local_gems_select_own'
  ) THEN
    CREATE POLICY "local_gems_select_own" ON public.local_gems
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_gems'
      AND policyname = 'local_gems_insert_own'
  ) THEN
    CREATE POLICY "local_gems_insert_own" ON public.local_gems
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_gems'
      AND policyname = 'local_gems_update_own'
  ) THEN
    CREATE POLICY "local_gems_update_own" ON public.local_gems
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_gems'
      AND policyname = 'local_gems_delete_own'
  ) THEN
    CREATE POLICY "local_gems_delete_own" ON public.local_gems
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_gems'
      AND policyname = 'local_gems_select_public'
  ) THEN
    CREATE POLICY "local_gems_select_public" ON public.local_gems
      FOR SELECT USING (visibility IN ('public', '公開する'));
  END IF;
END
$policy$;
