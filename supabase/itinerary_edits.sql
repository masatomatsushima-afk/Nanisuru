-- Nanisuru: itinerary_edits（行程の部分編集履歴）
-- 安全・冪等。Supabase SQL Editor で実行してください。

CREATE TABLE IF NOT EXISTS public.itinerary_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  plan_id uuid,
  day_index integer NOT NULL DEFAULT 0,
  item_id text NOT NULL DEFAULT '',
  edit_request text NOT NULL DEFAULT '',
  before_data jsonb NOT NULL DEFAULT '{}',
  after_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itinerary_edits_user_id_idx
  ON public.itinerary_edits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS itinerary_edits_trip_id_idx
  ON public.itinerary_edits (trip_id, created_at DESC)
  WHERE trip_id IS NOT NULL;

ALTER TABLE public.itinerary_edits ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'itinerary_edits' AND policyname = 'itinerary_edits_read_own'
  ) THEN
    CREATE POLICY "itinerary_edits_read_own" ON public.itinerary_edits
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'itinerary_edits' AND policyname = 'itinerary_edits_insert_own'
  ) THEN
    CREATE POLICY "itinerary_edits_insert_own" ON public.itinerary_edits
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$policy$;
