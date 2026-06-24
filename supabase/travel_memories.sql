-- Nanisuru: travel_memories
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.travel_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN ('food', 'travel_style', 'budget', 'activities', 'dislikes', 'companion', 'destinations')
  ),
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS travel_memories_user_id_idx ON public.travel_memories (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS travel_memories_user_category_idx ON public.travel_memories (user_id, category);
ALTER TABLE public.travel_memories ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'travel_memories' AND policyname = 'travel_memories_select_own') THEN
    CREATE POLICY "travel_memories_select_own" ON public.travel_memories FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'travel_memories' AND policyname = 'travel_memories_insert_own') THEN
    CREATE POLICY "travel_memories_insert_own" ON public.travel_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'travel_memories' AND policyname = 'travel_memories_update_own') THEN
    CREATE POLICY "travel_memories_update_own" ON public.travel_memories FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'travel_memories' AND policyname = 'travel_memories_delete_own') THEN
    CREATE POLICY "travel_memories_delete_own" ON public.travel_memories FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;
