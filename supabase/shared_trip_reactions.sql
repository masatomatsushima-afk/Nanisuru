-- Nanisuru: shared_trip_reactions
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.shared_trip_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_plan_id uuid NOT NULL REFERENCES public.shared_trips (id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (
    reaction_type IN ('行きたい', '微妙', 'ここ良い', '変更したい', '高そう', '楽しそう')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_trip_reactions_plan_id_idx ON public.shared_trip_reactions (shared_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shared_trip_reactions_type_idx ON public.shared_trip_reactions (shared_plan_id, reaction_type);
ALTER TABLE public.shared_trip_reactions ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_trip_reactions' AND policyname = 'shared_trip_reactions_public_read') THEN
    CREATE POLICY "shared_trip_reactions_public_read" ON public.shared_trip_reactions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_trip_reactions' AND policyname = 'shared_trip_reactions_public_insert') THEN
    CREATE POLICY "shared_trip_reactions_public_insert" ON public.shared_trip_reactions FOR INSERT WITH CHECK (true);
  END IF;
END
$policy$;
