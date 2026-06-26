-- Nanisuru: trip_folders & trip_assistant_messages（旅行秘書フォルダ）
-- 安全・冪等。Supabase SQL Editor で実行してください。

CREATE TABLE IF NOT EXISTS public.trip_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  departure_date text NOT NULL DEFAULT '',
  return_date text NOT NULL DEFAULT '',
  duration_label text NOT NULL DEFAULT '',
  companion_type text NOT NULL DEFAULT '',
  budget text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'JPY',
  saved_trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  plan_payload jsonb,
  context_notes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trip_folders_saved_trip_unique
  ON public.trip_folders (saved_trip_id)
  WHERE saved_trip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trip_folders_user_id_idx
  ON public.trip_folders (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.trip_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_folder_id uuid NOT NULL REFERENCES public.trip_folders (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_assistant_messages_folder_idx
  ON public.trip_assistant_messages (trip_folder_id, created_at ASC);

ALTER TABLE public.trip_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_assistant_messages ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_folders' AND policyname = 'trip_folders_read_own') THEN
    CREATE POLICY "trip_folders_read_own" ON public.trip_folders FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_folders' AND policyname = 'trip_folders_insert_own') THEN
    CREATE POLICY "trip_folders_insert_own" ON public.trip_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_folders' AND policyname = 'trip_folders_update_own') THEN
    CREATE POLICY "trip_folders_update_own" ON public.trip_folders FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_folders' AND policyname = 'trip_folders_delete_own') THEN
    CREATE POLICY "trip_folders_delete_own" ON public.trip_folders FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_assistant_messages' AND policyname = 'trip_assistant_messages_read_own') THEN
    CREATE POLICY "trip_assistant_messages_read_own" ON public.trip_assistant_messages FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_assistant_messages' AND policyname = 'trip_assistant_messages_insert_own') THEN
    CREATE POLICY "trip_assistant_messages_insert_own" ON public.trip_assistant_messages FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.trip_folders f WHERE f.id = trip_folder_id AND f.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_assistant_messages' AND policyname = 'trip_assistant_messages_delete_own') THEN
    CREATE POLICY "trip_assistant_messages_delete_own" ON public.trip_assistant_messages FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;
