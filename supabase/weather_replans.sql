-- Nanisuru: weather_replans（天気に基づくプラン再調整履歴）
-- 安全・冪等。Supabase SQL Editor で実行してください。

CREATE TABLE IF NOT EXISTS public.weather_replans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plan_id uuid,
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  before_plan jsonb NOT NULL DEFAULT '{}',
  after_plan jsonb NOT NULL DEFAULT '{}',
  weather_context jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weather_replans_user_id_idx
  ON public.weather_replans (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS weather_replans_trip_id_idx
  ON public.weather_replans (trip_id, created_at DESC)
  WHERE trip_id IS NOT NULL;

ALTER TABLE public.weather_replans ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weather_replans' AND policyname = 'weather_replans_read_own'
  ) THEN
    CREATE POLICY "weather_replans_read_own" ON public.weather_replans
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weather_replans' AND policyname = 'weather_replans_insert_own'
  ) THEN
    CREATE POLICY "weather_replans_insert_own" ON public.weather_replans
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$policy$;
