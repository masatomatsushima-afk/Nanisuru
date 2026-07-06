-- 005: itinerary_edits (partial itinerary edit history)
-- App: src/lib/itinerary-edits.ts

CREATE TABLE IF NOT EXISTS public.itinerary_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  plan_id uuid,
  folder_id uuid REFERENCES public.trip_folders (id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  day_index integer NOT NULL DEFAULT 0,
  item_index integer,
  item_id text NOT NULL DEFAULT '',
  edit_request text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  before_data jsonb NOT NULL DEFAULT '{}',
  after_data jsonb NOT NULL DEFAULT '{}',
  before_item jsonb,
  after_item jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_edits
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.trip_folders (id) ON DELETE SET NULL;
ALTER TABLE public.itinerary_edits
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.itinerary_edits
  ADD COLUMN IF NOT EXISTS item_index integer;
ALTER TABLE public.itinerary_edits
  ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '';
ALTER TABLE public.itinerary_edits
  ADD COLUMN IF NOT EXISTS before_item jsonb;
ALTER TABLE public.itinerary_edits
  ADD COLUMN IF NOT EXISTS after_item jsonb;

CREATE INDEX IF NOT EXISTS itinerary_edits_user_id_idx
  ON public.itinerary_edits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS itinerary_edits_trip_id_idx
  ON public.itinerary_edits (trip_id, created_at DESC)
  WHERE trip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS itinerary_edits_folder_id_idx
  ON public.itinerary_edits (folder_id, created_at DESC)
  WHERE folder_id IS NOT NULL;

ALTER TABLE public.itinerary_edits ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'itinerary_edits'
      AND policyname = 'itinerary_edits_read_own'
  ) THEN
    CREATE POLICY "itinerary_edits_read_own" ON public.itinerary_edits
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'itinerary_edits'
      AND policyname = 'itinerary_edits_insert_own'
  ) THEN
    CREATE POLICY "itinerary_edits_insert_own" ON public.itinerary_edits
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'itinerary_edits'
      AND policyname = 'itinerary_edits_update_own'
  ) THEN
    CREATE POLICY "itinerary_edits_update_own" ON public.itinerary_edits
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'itinerary_edits'
      AND policyname = 'itinerary_edits_delete_own'
  ) THEN
    CREATE POLICY "itinerary_edits_delete_own" ON public.itinerary_edits
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;
