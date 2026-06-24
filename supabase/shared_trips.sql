-- Nanisuru: shared_trips
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.shared_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_trips_created_at_idx ON public.shared_trips (created_at DESC);
ALTER TABLE public.shared_trips ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_trips' AND policyname = 'shared_trips_public_read') THEN
    CREATE POLICY "shared_trips_public_read" ON public.shared_trips FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_trips' AND policyname = 'shared_trips_public_insert') THEN
    CREATE POLICY "shared_trips_public_insert" ON public.shared_trips FOR INSERT WITH CHECK (true);
  END IF;
END
$policy$;
