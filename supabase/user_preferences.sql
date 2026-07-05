-- Nanisuru: 好み診断 (user_preferences)
-- Run after auth.users exists. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  favorite_categories text[] NOT NULL DEFAULT '{}',
  travel_pace text,
  walking_tolerance text,
  budget_style text,
  avoid_things text[] NOT NULL DEFAULT '{}',
  companion_types text[] NOT NULL DEFAULT '{}',
  free_text_preference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_preferences_user_idx
  ON public.user_preferences (user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_preferences'
      AND policyname = 'user_preferences_select_own'
  ) THEN
    CREATE POLICY "user_preferences_select_own"
      ON public.user_preferences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_preferences'
      AND policyname = 'user_preferences_insert_own'
  ) THEN
    CREATE POLICY "user_preferences_insert_own"
      ON public.user_preferences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_preferences'
      AND policyname = 'user_preferences_update_own'
  ) THEN
    CREATE POLICY "user_preferences_update_own"
      ON public.user_preferences FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$policy$;
