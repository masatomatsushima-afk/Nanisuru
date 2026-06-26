-- Nanisuru: after_plans（このあとどうする？ 夜・2軒目プラン履歴）
-- 安全・冪等。Supabase SQL Editor で実行してください。

CREATE TABLE IF NOT EXISTS public.after_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  base_trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  current_location text NOT NULL DEFAULT '',
  mood text NOT NULL DEFAULT '',
  people_count text NOT NULL DEFAULT '',
  companion_type text NOT NULL DEFAULT '',
  budget text NOT NULL DEFAULT '',
  selected_option jsonb NOT NULL DEFAULT '{}',
  input_payload jsonb NOT NULL DEFAULT '{}',
  is_public boolean NOT NULL DEFAULT false,
  public_title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS after_plans_user_id_idx
  ON public.after_plans (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS after_plans_public_idx
  ON public.after_plans (is_public, created_at DESC)
  WHERE is_public = true;

ALTER TABLE public.after_plans ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'after_plans' AND policyname = 'after_plans_read_own'
  ) THEN
    CREATE POLICY "after_plans_read_own" ON public.after_plans
      FOR SELECT USING (auth.uid() = user_id OR is_public = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'after_plans' AND policyname = 'after_plans_insert_own'
  ) THEN
    CREATE POLICY "after_plans_insert_own" ON public.after_plans
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'after_plans' AND policyname = 'after_plans_update_own'
  ) THEN
    CREATE POLICY "after_plans_update_own" ON public.after_plans
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END
$policy$;
