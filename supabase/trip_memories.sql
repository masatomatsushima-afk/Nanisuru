-- Nanisuru: trip_memories（思い出アルバム）
-- 安全・冪等。Supabase SQL Editor で実行してください。

CREATE TABLE IF NOT EXISTS public.trip_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  date_label text NOT NULL DEFAULT '',
  duration_label text NOT NULL DEFAULT '',
  companion text NOT NULL DEFAULT '',
  cover_image_url text,
  summary text NOT NULL DEFAULT '',
  ai_summary jsonb,
  favorite_moments text[] NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public')),
  like_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trip_memories_trip_id_unique
  ON public.trip_memories (trip_id)
  WHERE trip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trip_memories_user_id_idx
  ON public.trip_memories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS trip_memories_visibility_idx
  ON public.trip_memories (visibility, created_at DESC)
  WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS public.trip_memory_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES public.trip_memories (id) ON DELETE CASCADE,
  media_url text,
  storage_path text,
  media_type text NOT NULL DEFAULT 'photo'
    CHECK (media_type IN ('photo', 'video', 'note')),
  caption text NOT NULL DEFAULT '',
  timeline_time text NOT NULL DEFAULT '',
  place_name text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  itinerary_day_number integer,
  itinerary_item_time text,
  itinerary_item_activity text,
  is_favorite boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_memory_media_memory_id_idx
  ON public.trip_memory_media (memory_id, order_index ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS public.trip_memory_likes (
  memory_id uuid NOT NULL REFERENCES public.trip_memories (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (memory_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.trip_memory_saves (
  memory_id uuid NOT NULL REFERENCES public.trip_memories (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (memory_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.trip_memory_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES public.trip_memories (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_memory_comments_memory_id_idx
  ON public.trip_memory_comments (memory_id, created_at ASC);

ALTER TABLE public.trip_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_memory_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_memory_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_memory_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_memory_comments ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memories' AND policyname = 'trip_memories_read') THEN
    CREATE POLICY "trip_memories_read" ON public.trip_memories FOR SELECT USING (
      user_id = auth.uid()
      OR visibility = 'public'
      OR (visibility = 'unlisted' AND auth.uid() IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memories' AND policyname = 'trip_memories_insert_own') THEN
    CREATE POLICY "trip_memories_insert_own" ON public.trip_memories FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memories' AND policyname = 'trip_memories_update_own') THEN
    CREATE POLICY "trip_memories_update_own" ON public.trip_memories FOR UPDATE
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memories' AND policyname = 'trip_memories_delete_own') THEN
    CREATE POLICY "trip_memories_delete_own" ON public.trip_memories FOR DELETE USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_media' AND policyname = 'trip_memory_media_read') THEN
    CREATE POLICY "trip_memory_media_read" ON public.trip_memory_media FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.trip_memories m
        WHERE m.id = memory_id
          AND (m.user_id = auth.uid() OR m.visibility = 'public' OR (m.visibility = 'unlisted' AND auth.uid() IS NOT NULL))
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_media' AND policyname = 'trip_memory_media_insert_own') THEN
    CREATE POLICY "trip_memory_media_insert_own" ON public.trip_memory_media FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.trip_memories m WHERE m.id = memory_id AND m.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_media' AND policyname = 'trip_memory_media_update_own') THEN
    CREATE POLICY "trip_memory_media_update_own" ON public.trip_memory_media FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.trip_memories m WHERE m.id = memory_id AND m.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.trip_memories m WHERE m.id = memory_id AND m.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_media' AND policyname = 'trip_memory_media_delete_own') THEN
    CREATE POLICY "trip_memory_media_delete_own" ON public.trip_memory_media FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.trip_memories m WHERE m.id = memory_id AND m.user_id = auth.uid())
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_likes' AND policyname = 'trip_memory_likes_read') THEN
    CREATE POLICY "trip_memory_likes_read" ON public.trip_memory_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_likes' AND policyname = 'trip_memory_likes_insert_auth') THEN
    CREATE POLICY "trip_memory_likes_insert_auth" ON public.trip_memory_likes FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.trip_memories m WHERE m.id = memory_id AND m.visibility = 'public')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_likes' AND policyname = 'trip_memory_likes_delete_own') THEN
    CREATE POLICY "trip_memory_likes_delete_own" ON public.trip_memory_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_saves' AND policyname = 'trip_memory_saves_read') THEN
    CREATE POLICY "trip_memory_saves_read" ON public.trip_memory_saves FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_saves' AND policyname = 'trip_memory_saves_insert_auth') THEN
    CREATE POLICY "trip_memory_saves_insert_auth" ON public.trip_memory_saves FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.trip_memories m WHERE m.id = memory_id AND m.visibility = 'public')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_saves' AND policyname = 'trip_memory_saves_delete_own') THEN
    CREATE POLICY "trip_memory_saves_delete_own" ON public.trip_memory_saves FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_comments' AND policyname = 'trip_memory_comments_read') THEN
    CREATE POLICY "trip_memory_comments_read" ON public.trip_memory_comments FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.trip_memories m
        WHERE m.id = memory_id AND (m.visibility = 'public' OR m.user_id = auth.uid())
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_comments' AND policyname = 'trip_memory_comments_insert_auth') THEN
    CREATE POLICY "trip_memory_comments_insert_auth" ON public.trip_memory_comments FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.trip_memories m WHERE m.id = memory_id AND m.visibility = 'public')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trip_memory_comments' AND policyname = 'trip_memory_comments_delete_own') THEN
    CREATE POLICY "trip_memory_comments_delete_own" ON public.trip_memory_comments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;

INSERT INTO storage.buckets (id, name, public) VALUES ('trip-memories', 'trip-memories', true) ON CONFLICT (id) DO NOTHING;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trip_memories_storage_read') THEN
    CREATE POLICY "trip_memories_storage_read" ON storage.objects FOR SELECT USING (bucket_id = 'trip-memories');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trip_memories_storage_insert_own') THEN
    CREATE POLICY "trip_memories_storage_insert_own" ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'trip-memories' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trip_memories_storage_update_own') THEN
    CREATE POLICY "trip_memories_storage_update_own" ON storage.objects FOR UPDATE
      USING (bucket_id = 'trip-memories' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'trip-memories' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trip_memories_storage_delete_own') THEN
    CREATE POLICY "trip_memories_storage_delete_own" ON storage.objects FOR DELETE USING (
      bucket_id = 'trip-memories' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$policy$;
