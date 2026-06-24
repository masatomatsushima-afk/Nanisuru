-- =============================================================================
-- Nanisuru: Safe Supabase setup (idempotent — safe to run multiple times)
-- =============================================================================
-- Copy this ENTIRE file into Supabase Dashboard → SQL Editor → Run.
--
-- Does NOT use: DROP TABLE / COLUMN / POLICY / TRIGGER, DELETE, TRUNCATE,
--               or ALTER TABLE ... DROP.
--
-- App table map:
--   profiles          → user_profiles
--   saved_trips       → trips
--   (all other names match)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers (CREATE OR REPLACE is safe; re-run updates function bodies)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nanisuru_ensure_policy(
  p_table_name text,
  p_policy_name text,
  p_policy_sql text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = p_table_name
      AND policyname = p_policy_name
  ) THEN
    EXECUTE p_policy_sql;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.nanisuru_ensure_storage_policy(
  p_policy_name text,
  p_policy_sql text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = p_policy_name
  ) THEN
    EXECUTE p_policy_sql;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.nanisuru_ensure_trigger(
  p_trigger_name text,
  p_table_name text,
  p_trigger_sql text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = p_trigger_name
      AND c.relname = p_table_name
      AND n.nspname = 'public'
  ) THEN
    EXECUTE p_trigger_sql;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. saved_trips → trips
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trips_user_id_created_at_idx
  ON public.trips (user_id, created_at DESC);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'trips',
  'trips_select_own',
  $policy$
    CREATE POLICY "trips_select_own"
      ON public.trips
      FOR SELECT
      USING (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'trips',
  'trips_insert_own',
  $policy$
    CREATE POLICY "trips_insert_own"
      ON public.trips
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'trips',
  'trips_update_own',
  $policy$
    CREATE POLICY "trips_update_own"
      ON public.trips
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'trips',
  'trips_delete_own',
  $policy$
    CREATE POLICY "trips_delete_own"
      ON public.trips
      FOR DELETE
      USING (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 2. profiles → user_profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  style_tags text[] NOT NULL DEFAULT '{}',
  follower_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_display_name_idx
  ON public.user_profiles (display_name);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'user_profiles',
  'user_profiles_public_read',
  $policy$
    CREATE POLICY "user_profiles_public_read"
      ON public.user_profiles
      FOR SELECT
      USING (true)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'user_profiles',
  'user_profiles_insert_own',
  $policy$
    CREATE POLICY "user_profiles_insert_own"
      ON public.user_profiles
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'user_profiles',
  'user_profiles_update_own',
  $policy$
    CREATE POLICY "user_profiles_update_own"
      ON public.user_profiles
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 3. shared_trips
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_trips_created_at_idx
  ON public.shared_trips (created_at DESC);

ALTER TABLE public.shared_trips ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'shared_trips',
  'shared_trips_public_read',
  $policy$
    CREATE POLICY "shared_trips_public_read"
      ON public.shared_trips
      FOR SELECT
      USING (true)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'shared_trips',
  'shared_trips_public_insert',
  $policy$
    CREATE POLICY "shared_trips_public_insert"
      ON public.shared_trips
      FOR INSERT
      WITH CHECK (true)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 4. public_plans (+ moderation / ranking columns)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (
    category IN ('デート', '友達', '一人', '家族', '旅行', 'グルメ')
  ),
  tags text[] NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'public' CHECK (
    visibility IN ('public', 'unlisted', 'private')
  ),
  creator_display_name text NOT NULL,
  payload jsonb NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  copy_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  is_removed boolean NOT NULL DEFAULT false,
  moderation_status text NOT NULL DEFAULT 'active' CHECK (
    moderation_status IN ('active', 'pending', 'hidden', 'removed')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_plans
  ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.public_plans
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.public_plans
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

ALTER TABLE public.public_plans
  ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false;

ALTER TABLE public.public_plans
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS public_plans_visibility_created_at_idx
  ON public.public_plans (visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS public_plans_visibility_like_count_idx
  ON public.public_plans (visibility, like_count DESC);

CREATE INDEX IF NOT EXISTS public_plans_category_idx
  ON public.public_plans (category);

CREATE INDEX IF NOT EXISTS public_plans_tags_idx
  ON public.public_plans USING gin (tags);

CREATE INDEX IF NOT EXISTS public_plans_user_source_trip_idx
  ON public.public_plans (user_id, source_trip_id);

CREATE INDEX IF NOT EXISTS public_plans_discoverable_idx
  ON public.public_plans (visibility, is_public, is_removed, moderation_status, created_at DESC);

UPDATE public.public_plans
SET
  is_public = (visibility = 'public' AND NOT is_removed AND moderation_status = 'active'),
  updated_at = now()
WHERE is_public IS DISTINCT FROM (
  visibility = 'public' AND NOT is_removed AND moderation_status = 'active'
);

ALTER TABLE public.public_plans ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plans',
  'public_plans_read_discoverable',
  $policy$
    CREATE POLICY "public_plans_read_discoverable"
      ON public.public_plans
      FOR SELECT
      USING (
        auth.uid() = user_id
        OR (
          visibility IN ('public', 'unlisted')
          AND is_public = true
          AND is_removed = false
          AND moderation_status = 'active'
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plans',
  'public_plans_insert_own',
  $policy$
    CREATE POLICY "public_plans_insert_own"
      ON public.public_plans
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plans',
  'public_plans_update_own',
  $policy$
    CREATE POLICY "public_plans_update_own"
      ON public.public_plans
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plans',
  'public_plans_delete_own',
  $policy$
    CREATE POLICY "public_plans_delete_own"
      ON public.public_plans
      FOR DELETE
      USING (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 5. public_plan_likes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plan_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, public_plan_id)
);

CREATE INDEX IF NOT EXISTS public_plan_likes_plan_id_idx
  ON public.public_plan_likes (public_plan_id);

ALTER TABLE public.public_plan_likes ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plan_likes',
  'public_plan_likes_read',
  $policy$
    CREATE POLICY "public_plan_likes_read"
      ON public.public_plan_likes
      FOR SELECT
      USING (true)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_likes',
  'public_plan_likes_insert_own',
  $policy$
    CREATE POLICY "public_plan_likes_insert_own"
      ON public.public_plan_likes
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_likes',
  'public_plan_likes_delete_own',
  $policy$
    CREATE POLICY "public_plan_likes_delete_own"
      ON public.public_plan_likes
      FOR DELETE
      USING (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 6. public_plan_saves
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plan_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  saved_trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, public_plan_id)
);

CREATE INDEX IF NOT EXISTS public_plan_saves_plan_id_idx
  ON public.public_plan_saves (public_plan_id);

ALTER TABLE public.public_plan_saves ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plan_saves',
  'public_plan_saves_read',
  $policy$
    CREATE POLICY "public_plan_saves_read"
      ON public.public_plan_saves
      FOR SELECT
      USING (true)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_saves',
  'public_plan_saves_insert_own',
  $policy$
    CREATE POLICY "public_plan_saves_insert_own"
      ON public.public_plan_saves
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_saves',
  'public_plan_saves_delete_own',
  $policy$
    CREATE POLICY "public_plan_saves_delete_own"
      ON public.public_plan_saves
      FOR DELETE
      USING (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 7. public_plan_comments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  comment_text text NOT NULL CHECK (char_length(trim(comment_text)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_plan_comments_plan_created_idx
  ON public.public_plan_comments (public_plan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS public_plan_comments_user_idx
  ON public.public_plan_comments (user_id);

ALTER TABLE public.public_plan_comments ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plan_comments',
  'public_plan_comments_read',
  $policy$
    CREATE POLICY "public_plan_comments_read"
      ON public.public_plan_comments
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans p
          WHERE p.id = public_plan_id
            AND (
              p.visibility IN ('public', 'unlisted')
              OR p.user_id = auth.uid()
            )
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_comments',
  'public_plan_comments_insert_own',
  $policy$
    CREATE POLICY "public_plan_comments_insert_own"
      ON public.public_plan_comments
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM public.public_plans p
          WHERE p.id = public_plan_id
            AND p.visibility IN ('public', 'unlisted')
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_comments',
  'public_plan_comments_delete_own',
  $policy$
    CREATE POLICY "public_plan_comments_delete_own"
      ON public.public_plan_comments
      FOR DELETE
      USING (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 8. public_plan_requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (
    request_type IN (
      'cheaper',
      'less_travel',
      'rainy_day',
      'date_oriented',
      'night_plan',
      'more_gourmet'
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_plan_id, user_id, request_type)
);

CREATE INDEX IF NOT EXISTS public_plan_requests_plan_type_idx
  ON public.public_plan_requests (public_plan_id, request_type);

CREATE INDEX IF NOT EXISTS public_plan_requests_user_idx
  ON public.public_plan_requests (user_id);

ALTER TABLE public.public_plan_requests ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plan_requests',
  'public_plan_requests_read',
  $policy$
    CREATE POLICY "public_plan_requests_read"
      ON public.public_plan_requests
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans p
          WHERE p.id = public_plan_id
            AND (
              p.visibility IN ('public', 'unlisted')
              OR p.user_id = auth.uid()
            )
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_requests',
  'public_plan_requests_insert_own',
  $policy$
    CREATE POLICY "public_plan_requests_insert_own"
      ON public.public_plan_requests
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM public.public_plans p
          WHERE p.id = public_plan_id
            AND p.visibility IN ('public', 'unlisted')
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_requests',
  'public_plan_requests_delete_own',
  $policy$
    CREATE POLICY "public_plan_requests_delete_own"
      ON public.public_plan_requests
      FOR DELETE
      USING (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 9. public_plan_versions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  version_public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  version_type text NOT NULL CHECK (
    version_type IN (
      'cheaper',
      'less_travel',
      'rainy_day',
      'date_oriented',
      'night_plan',
      'more_gourmet'
    )
  ),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_public_plan_id)
);

CREATE INDEX IF NOT EXISTS public_plan_versions_original_idx
  ON public.public_plan_versions (original_public_plan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS public_plan_versions_type_idx
  ON public.public_plan_versions (original_public_plan_id, version_type);

ALTER TABLE public.public_plan_versions ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plan_versions',
  'public_plan_versions_read',
  $policy$
    CREATE POLICY "public_plan_versions_read"
      ON public.public_plan_versions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans original
          WHERE original.id = original_public_plan_id
            AND (
              original.visibility IN ('public', 'unlisted')
              OR original.user_id = auth.uid()
            )
        )
        AND EXISTS (
          SELECT 1
          FROM public.public_plans version
          WHERE version.id = version_public_plan_id
            AND (
              version.visibility IN ('public', 'unlisted')
              OR version.user_id = auth.uid()
            )
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_versions',
  'public_plan_versions_insert_creator',
  $policy$
    CREATE POLICY "public_plan_versions_insert_creator"
      ON public.public_plan_versions
      FOR INSERT
      WITH CHECK (
        auth.uid() = created_by
        AND EXISTS (
          SELECT 1
          FROM public.public_plans original
          WHERE original.id = original_public_plan_id
            AND original.user_id = auth.uid()
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_versions',
  'public_plan_versions_delete_creator',
  $policy$
    CREATE POLICY "public_plan_versions_delete_creator"
      ON public.public_plan_versions
      FOR DELETE
      USING (auth.uid() = created_by)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 10. public_plan_copies
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plan_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  copied_trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_plan_copies_plan_created_idx
  ON public.public_plan_copies (public_plan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS public_plan_copies_user_plan_idx
  ON public.public_plan_copies (user_id, public_plan_id);

ALTER TABLE public.public_plan_copies ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plan_copies',
  'public_plan_copies_read',
  $policy$
    CREATE POLICY "public_plan_copies_read"
      ON public.public_plan_copies
      FOR SELECT
      USING (true)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_copies',
  'public_plan_copies_insert_own',
  $policy$
    CREATE POLICY "public_plan_copies_insert_own"
      ON public.public_plan_copies
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 11. public_plan_images
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plan_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  image_url text NOT NULL,
  storage_path text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_plan_id, order_index)
);

CREATE INDEX IF NOT EXISTS public_plan_images_plan_id_idx
  ON public.public_plan_images (public_plan_id, order_index ASC);

ALTER TABLE public.public_plan_images ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plan_images',
  'public_plan_images_read_public_plans',
  $policy$
    CREATE POLICY "public_plan_images_read_public_plans"
      ON public.public_plan_images
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND (
              plan.visibility IN ('public', 'unlisted')
              OR plan.user_id = auth.uid()
            )
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_images',
  'public_plan_images_insert_own',
  $policy$
    CREATE POLICY "public_plan_images_insert_own"
      ON public.public_plan_images
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND plan.user_id = auth.uid()
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_images',
  'public_plan_images_update_own',
  $policy$
    CREATE POLICY "public_plan_images_update_own"
      ON public.public_plan_images
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND plan.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND plan.user_id = auth.uid()
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_images',
  'public_plan_images_delete_own',
  $policy$
    CREATE POLICY "public_plan_images_delete_own"
      ON public.public_plan_images
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND plan.user_id = auth.uid()
        )
      )
  $policy$
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('public-plan-images', 'public-plan-images', true)
ON CONFLICT (id) DO NOTHING;

SELECT public.nanisuru_ensure_storage_policy(
  'public_plan_images_storage_read',
  $policy$
    CREATE POLICY "public_plan_images_storage_read"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'public-plan-images')
  $policy$
);

SELECT public.nanisuru_ensure_storage_policy(
  'public_plan_images_storage_insert_own',
  $policy$
    CREATE POLICY "public_plan_images_storage_insert_own"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'public-plan-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
  $policy$
);

SELECT public.nanisuru_ensure_storage_policy(
  'public_plan_images_storage_update_own',
  $policy$
    CREATE POLICY "public_plan_images_storage_update_own"
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'public-plan-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'public-plan-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
  $policy$
);

SELECT public.nanisuru_ensure_storage_policy(
  'public_plan_images_storage_delete_own',
  $policy$
    CREATE POLICY "public_plan_images_storage_delete_own"
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'public-plan-images'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
  $policy$
);

-- ---------------------------------------------------------------------------
-- 12. public_plan_videos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.public_plan_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  video_url text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('Instagram', 'TikTok', 'YouTube')),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_plan_id, order_index)
);

CREATE INDEX IF NOT EXISTS public_plan_videos_plan_id_idx
  ON public.public_plan_videos (public_plan_id, order_index ASC);

ALTER TABLE public.public_plan_videos ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'public_plan_videos',
  'public_plan_videos_read_public_plans',
  $policy$
    CREATE POLICY "public_plan_videos_read_public_plans"
      ON public.public_plan_videos
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND (
              plan.visibility IN ('public', 'unlisted')
              OR plan.user_id = auth.uid()
            )
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_videos',
  'public_plan_videos_insert_own',
  $policy$
    CREATE POLICY "public_plan_videos_insert_own"
      ON public.public_plan_videos
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND plan.user_id = auth.uid()
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_videos',
  'public_plan_videos_update_own',
  $policy$
    CREATE POLICY "public_plan_videos_update_own"
      ON public.public_plan_videos
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND plan.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND plan.user_id = auth.uid()
        )
      )
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'public_plan_videos',
  'public_plan_videos_delete_own',
  $policy$
    CREATE POLICY "public_plan_videos_delete_own"
      ON public.public_plan_videos
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.public_plans plan
          WHERE plan.id = public_plan_id
            AND plan.user_id = auth.uid()
        )
      )
  $policy$
);

-- ---------------------------------------------------------------------------
-- 13. user_follows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS user_follows_follower_idx
  ON public.user_follows (follower_id);

CREATE INDEX IF NOT EXISTS user_follows_following_idx
  ON public.user_follows (following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'user_follows',
  'user_follows_read',
  $policy$
    CREATE POLICY "user_follows_read"
      ON public.user_follows
      FOR SELECT
      USING (true)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'user_follows',
  'user_follows_insert_own',
  $policy$
    CREATE POLICY "user_follows_insert_own"
      ON public.user_follows
      FOR INSERT
      WITH CHECK (auth.uid() = follower_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'user_follows',
  'user_follows_delete_own',
  $policy$
    CREATE POLICY "user_follows_delete_own"
      ON public.user_follows
      FOR DELETE
      USING (auth.uid() = follower_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 14. travel_memories
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.travel_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN (
      'food',
      'travel_style',
      'budget',
      'activities',
      'dislikes',
      'companion',
      'destinations'
    )
  ),
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS travel_memories_user_id_idx
  ON public.travel_memories (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS travel_memories_user_category_idx
  ON public.travel_memories (user_id, category);

ALTER TABLE public.travel_memories ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'travel_memories',
  'travel_memories_select_own',
  $policy$
    CREATE POLICY "travel_memories_select_own"
      ON public.travel_memories
      FOR SELECT
      USING (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'travel_memories',
  'travel_memories_insert_own',
  $policy$
    CREATE POLICY "travel_memories_insert_own"
      ON public.travel_memories
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'travel_memories',
  'travel_memories_update_own',
  $policy$
    CREATE POLICY "travel_memories_update_own"
      ON public.travel_memories
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'travel_memories',
  'travel_memories_delete_own',
  $policy$
    CREATE POLICY "travel_memories_delete_own"
      ON public.travel_memories
      FOR DELETE
      USING (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 15. plan_ratings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.plan_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  feedback_tags text[] NOT NULL DEFAULT '{}',
  plan_source text NOT NULL CHECK (plan_source IN ('home', 'imafima', 'best-day')),
  plan_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_ratings_user_id_idx
  ON public.plan_ratings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS plan_ratings_trip_id_idx
  ON public.plan_ratings (trip_id)
  WHERE trip_id IS NOT NULL;

ALTER TABLE public.plan_ratings ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'plan_ratings',
  'plan_ratings_select_own',
  $policy$
    CREATE POLICY "plan_ratings_select_own"
      ON public.plan_ratings
      FOR SELECT
      USING (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'plan_ratings',
  'plan_ratings_insert_own',
  $policy$
    CREATE POLICY "plan_ratings_insert_own"
      ON public.plan_ratings
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'plan_ratings',
  'plan_ratings_update_own',
  $policy$
    CREATE POLICY "plan_ratings_update_own"
      ON public.plan_ratings
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'plan_ratings',
  'plan_ratings_delete_own',
  $policy$
    CREATE POLICY "plan_ratings_delete_own"
      ON public.plan_ratings
      FOR DELETE
      USING (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 16. shared_trip_reactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_trip_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_plan_id uuid NOT NULL REFERENCES public.shared_trips (id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (
    reaction_type IN (
      '行きたい',
      '微妙',
      'ここ良い',
      '変更したい',
      '高そう',
      '楽しそう'
    )
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_trip_reactions_plan_id_idx
  ON public.shared_trip_reactions (shared_plan_id, created_at DESC);

CREATE INDEX IF NOT EXISTS shared_trip_reactions_type_idx
  ON public.shared_trip_reactions (shared_plan_id, reaction_type);

ALTER TABLE public.shared_trip_reactions ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'shared_trip_reactions',
  'shared_trip_reactions_public_read',
  $policy$
    CREATE POLICY "shared_trip_reactions_public_read"
      ON public.shared_trip_reactions
      FOR SELECT
      USING (true)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'shared_trip_reactions',
  'shared_trip_reactions_public_insert',
  $policy$
    CREATE POLICY "shared_trip_reactions_public_insert"
      ON public.shared_trip_reactions
      FOR INSERT
      WITH CHECK (true)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 17. notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN (
      'plan_liked',
      'plan_saved',
      'plan_copied',
      'plan_commented',
      'user_followed',
      'plan_ranked',
      'plan_request'
    )
  ),
  title text NOT NULL,
  message text NOT NULL,
  related_plan_id uuid REFERENCES public.public_plans (id) ON DELETE SET NULL,
  related_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'notifications',
  'notifications_read_own',
  $policy$
    CREATE POLICY "notifications_read_own"
      ON public.notifications
      FOR SELECT
      USING (auth.uid() = user_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'notifications',
  'notifications_update_own',
  $policy$
    CREATE POLICY "notifications_update_own"
      ON public.notifications
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 18. reports
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (
    target_type IN ('public_plan', 'comment', 'user')
  ),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_target_idx
  ON public.reports (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_reporter_idx
  ON public.reports (reporter_id, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'reports',
  'reports_insert_own',
  $policy$
    CREATE POLICY "reports_insert_own"
      ON public.reports
      FOR INSERT
      WITH CHECK (auth.uid() = reporter_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- 19. blocked_users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_user_id),
  CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS blocked_users_blocker_idx
  ON public.blocked_users (blocker_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

SELECT public.nanisuru_ensure_policy(
  'blocked_users',
  'blocked_users_read_own',
  $policy$
    CREATE POLICY "blocked_users_read_own"
      ON public.blocked_users
      FOR SELECT
      USING (auth.uid() = blocker_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'blocked_users',
  'blocked_users_insert_own',
  $policy$
    CREATE POLICY "blocked_users_insert_own"
      ON public.blocked_users
      FOR INSERT
      WITH CHECK (auth.uid() = blocker_id)
  $policy$
);

SELECT public.nanisuru_ensure_policy(
  'blocked_users',
  'blocked_users_delete_own',
  $policy$
    CREATE POLICY "blocked_users_delete_own"
      ON public.blocked_users
      FOR DELETE
      USING (auth.uid() = blocker_id)
  $policy$
);

-- ---------------------------------------------------------------------------
-- Counter triggers & notification RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_public_plan_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.public_plans
    SET like_count = like_count + 1, updated_at = now()
    WHERE id = new.public_plan_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.public_plans
    SET like_count = greatest(like_count - 1, 0), updated_at = now()
    WHERE id = old.public_plan_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

SELECT public.nanisuru_ensure_trigger(
  'public_plan_likes_count_trigger',
  'public_plan_likes',
  $trigger$
    CREATE TRIGGER public_plan_likes_count_trigger
    AFTER INSERT OR DELETE ON public.public_plan_likes
    FOR EACH ROW EXECUTE FUNCTION public.refresh_public_plan_like_count()
  $trigger$
);

CREATE OR REPLACE FUNCTION public.refresh_public_plan_save_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.public_plans
    SET save_count = save_count + 1, updated_at = now()
    WHERE id = new.public_plan_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.public_plans
    SET save_count = greatest(save_count - 1, 0), updated_at = now()
    WHERE id = old.public_plan_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

SELECT public.nanisuru_ensure_trigger(
  'public_plan_saves_count_trigger',
  'public_plan_saves',
  $trigger$
    CREATE TRIGGER public_plan_saves_count_trigger
    AFTER INSERT OR DELETE ON public.public_plan_saves
    FOR EACH ROW EXECUTE FUNCTION public.refresh_public_plan_save_count()
  $trigger$
);

CREATE OR REPLACE FUNCTION public.refresh_public_plan_copy_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.public_plans
    SET copy_count = copy_count + 1, updated_at = now()
    WHERE id = new.public_plan_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.public_plans
    SET copy_count = greatest(copy_count - 1, 0), updated_at = now()
    WHERE id = old.public_plan_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

SELECT public.nanisuru_ensure_trigger(
  'public_plan_copies_count_trigger',
  'public_plan_copies',
  $trigger$
    CREATE TRIGGER public_plan_copies_count_trigger
    AFTER INSERT OR DELETE ON public.public_plan_copies
    FOR EACH ROW EXECUTE FUNCTION public.refresh_public_plan_copy_count()
  $trigger$
);

CREATE OR REPLACE FUNCTION public.refresh_public_plan_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.public_plans
    SET comment_count = comment_count + 1, updated_at = now()
    WHERE id = new.public_plan_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.public_plans
    SET comment_count = greatest(comment_count - 1, 0), updated_at = now()
    WHERE id = old.public_plan_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

SELECT public.nanisuru_ensure_trigger(
  'public_plan_comments_count_trigger',
  'public_plan_comments',
  $trigger$
    CREATE TRIGGER public_plan_comments_count_trigger
    AFTER INSERT OR DELETE ON public.public_plan_comments
    FOR EACH ROW EXECUTE FUNCTION public.refresh_public_plan_comment_count()
  $trigger$
);

UPDATE public.public_plans p
SET comment_count = (
  SELECT count(*)::integer
  FROM public.public_plan_comments c
  WHERE c.public_plan_id = p.id
)
WHERE comment_count IS DISTINCT FROM (
  SELECT count(*)::integer
  FROM public.public_plan_comments c
  WHERE c.public_plan_id = p.id
);

CREATE OR REPLACE FUNCTION public.refresh_user_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_name text;
BEGIN
  IF tg_op = 'INSERT' THEN
    SELECT creator_display_name
    INTO target_name
    FROM public.public_plans
    WHERE user_id = new.following_id
    LIMIT 1;

    INSERT INTO public.user_profiles (user_id, display_name)
    VALUES (new.following_id, coalesce(target_name, 'Nanisuruユーザー'))
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_profiles (user_id, display_name)
    VALUES (new.follower_id, 'Nanisuruユーザー')
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_profiles
    SET follower_count = follower_count + 1, updated_at = now()
    WHERE user_id = new.following_id;

    UPDATE public.user_profiles
    SET following_count = following_count + 1, updated_at = now()
    WHERE user_id = new.follower_id;

    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.user_profiles
    SET follower_count = greatest(follower_count - 1, 0), updated_at = now()
    WHERE user_id = old.following_id;

    UPDATE public.user_profiles
    SET following_count = greatest(following_count - 1, 0), updated_at = now()
    WHERE user_id = old.follower_id;

    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

SELECT public.nanisuru_ensure_trigger(
  'user_follows_count_trigger',
  'user_follows',
  $trigger$
    CREATE TRIGGER user_follows_count_trigger
    AFTER INSERT OR DELETE ON public.user_follows
    FOR EACH ROW EXECUTE FUNCTION public.refresh_user_follow_counts()
  $trigger$
);

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_plan_id uuid DEFAULT NULL,
  p_related_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_related_user_id IS NOT NULL AND p_user_id = p_related_user_id THEN
    RETURN NULL;
  END IF;

  IF p_type = 'plan_ranked' AND p_related_plan_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = p_user_id
        AND n.type = 'plan_ranked'
        AND n.related_plan_id = p_related_plan_id
        AND n.created_at > now() - interval '7 days'
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    related_plan_id,
    related_user_id
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_plan_id,
    p_related_user_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) TO authenticated;

-- =============================================================================
-- Done. Re-run anytime to add missing tables, columns, indexes, policies,
-- triggers, and functions without destroying existing data.
-- =============================================================================
