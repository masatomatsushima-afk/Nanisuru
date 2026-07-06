-- 002: saved_travel_plans (normalized schema — future; app uses trips today)
-- App: src/lib/supabase-persistence.ts (optional path)

CREATE TABLE IF NOT EXISTS public.saved_travel_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  departure_date date,
  return_date date,
  duration_label text NOT NULL DEFAULT '',
  companion text NOT NULL DEFAULT '',
  budget numeric,
  currency text NOT NULL DEFAULT 'JPY',
  budget_includes jsonb NOT NULL DEFAULT '[]',
  travel_purpose text NOT NULL DEFAULT '',
  plan_json jsonb NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT '自分だけ',
  saves_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Extend legacy installs that used text dates
ALTER TABLE public.saved_travel_plans
  ALTER COLUMN departure_date TYPE date USING NULLIF(departure_date::text, '')::date;
ALTER TABLE public.saved_travel_plans
  ALTER COLUMN return_date TYPE date USING NULLIF(return_date::text, '')::date;

ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS companion text NOT NULL DEFAULT '';
ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS budget numeric;
ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'JPY';
ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS budget_includes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS travel_purpose text NOT NULL DEFAULT '';
ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT '自分だけ';
ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS saves_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.saved_travel_plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS saved_travel_plans_user_updated_idx
  ON public.saved_travel_plans (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS saved_travel_plans_public_idx
  ON public.saved_travel_plans (visibility, updated_at DESC)
  WHERE visibility IN ('公開する', 'public');

ALTER TABLE public.saved_travel_plans ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_travel_plans'
      AND policyname = 'saved_travel_plans_select_own'
  ) THEN
    CREATE POLICY "saved_travel_plans_select_own" ON public.saved_travel_plans
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_travel_plans'
      AND policyname = 'saved_travel_plans_insert_own'
  ) THEN
    CREATE POLICY "saved_travel_plans_insert_own" ON public.saved_travel_plans
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_travel_plans'
      AND policyname = 'saved_travel_plans_update_own'
  ) THEN
    CREATE POLICY "saved_travel_plans_update_own" ON public.saved_travel_plans
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_travel_plans'
      AND policyname = 'saved_travel_plans_delete_own'
  ) THEN
    CREATE POLICY "saved_travel_plans_delete_own" ON public.saved_travel_plans
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;
