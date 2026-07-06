-- 010: Public visibility RLS (公開する / public)
-- Adds anonymous read for public records on saved_travel_plans, trip_memories, local_gems.
-- Also extends local_hidden_spots (app's active local gems table).

CREATE OR REPLACE FUNCTION public.nanisuru_is_public_visibility(v text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v IN ('公開する', 'public');
$$;

-- saved_travel_plans: public read
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_travel_plans'
      AND policyname = 'saved_travel_plans_select_public'
  ) THEN
    CREATE POLICY "saved_travel_plans_select_public" ON public.saved_travel_plans
      FOR SELECT USING (public.nanisuru_is_public_visibility(visibility));
  END IF;
END
$policy$;

-- trip_memories: public read (may overlap with trip_memories_read — both allowed)
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trip_memories'
      AND policyname = 'trip_memories_select_public'
  ) THEN
    CREATE POLICY "trip_memories_select_public" ON public.trip_memories
      FOR SELECT USING (public.nanisuru_is_public_visibility(visibility));
  END IF;
END
$policy$;

-- local_gems: public read
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_gems'
      AND policyname = 'local_gems_select_public'
  ) THEN
    CREATE POLICY "local_gems_select_public" ON public.local_gems
      FOR SELECT USING (public.nanisuru_is_public_visibility(visibility));
  END IF;
END
$policy$;

-- local_hidden_spots (active app table): public read for active + public visibility
ALTER TABLE public.local_hidden_spots
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_hidden_spots'
      AND policyname = 'local_hidden_spots_select_public'
  ) THEN
    CREATE POLICY "local_hidden_spots_select_public" ON public.local_hidden_spots
      FOR SELECT USING (
        moderation_status = 'active'
        AND public.nanisuru_is_public_visibility(visibility)
      );
  END IF;
END
$policy$;
