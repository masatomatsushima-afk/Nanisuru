-- Nanisuru: public_plans, public_plan_likes, public_plan_saves
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.public_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN ('デート', '友達', '一人', '家族', '旅行', 'グルメ')),
  tags text[] NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  creator_display_name text NOT NULL,
  payload jsonb NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  copy_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  is_removed boolean NOT NULL DEFAULT false,
  moderation_status text NOT NULL DEFAULT 'active' CHECK (moderation_status IN ('active', 'pending', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false;
ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS public_plans_visibility_created_at_idx ON public.public_plans (visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS public_plans_visibility_like_count_idx ON public.public_plans (visibility, like_count DESC);
CREATE INDEX IF NOT EXISTS public_plans_category_idx ON public.public_plans (category);
CREATE INDEX IF NOT EXISTS public_plans_tags_idx ON public.public_plans USING gin (tags);
CREATE INDEX IF NOT EXISTS public_plans_user_source_trip_idx ON public.public_plans (user_id, source_trip_id);
CREATE INDEX IF NOT EXISTS public_plans_discoverable_idx ON public.public_plans (visibility, is_public, is_removed, moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.public_plan_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, public_plan_id)
);
CREATE INDEX IF NOT EXISTS public_plan_likes_plan_id_idx ON public.public_plan_likes (public_plan_id);

CREATE TABLE IF NOT EXISTS public.public_plan_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  saved_trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, public_plan_id)
);
CREATE INDEX IF NOT EXISTS public_plan_saves_plan_id_idx ON public.public_plan_saves (public_plan_id);

CREATE OR REPLACE FUNCTION public.refresh_public_plan_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.public_plans SET like_count = like_count + 1, updated_at = now() WHERE id = new.public_plan_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.public_plans SET like_count = greatest(like_count - 1, 0), updated_at = now() WHERE id = old.public_plan_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_public_plan_save_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.public_plans SET save_count = save_count + 1, updated_at = now() WHERE id = new.public_plan_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.public_plans SET save_count = greatest(save_count - 1, 0), updated_at = now() WHERE id = old.public_plan_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND t.tgname = 'public_plan_likes_count_trigger' AND c.relname = 'public_plan_likes' AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER public_plan_likes_count_trigger AFTER INSERT OR DELETE ON public.public_plan_likes
    FOR EACH ROW EXECUTE FUNCTION public.refresh_public_plan_like_count();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND t.tgname = 'public_plan_saves_count_trigger' AND c.relname = 'public_plan_saves' AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER public_plan_saves_count_trigger AFTER INSERT OR DELETE ON public.public_plan_saves
    FOR EACH ROW EXECUTE FUNCTION public.refresh_public_plan_save_count();
  END IF;
END
$trigger$;

ALTER TABLE public.public_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_plan_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_plan_saves ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plans' AND policyname = 'public_plans_read_discoverable') THEN
    CREATE POLICY "public_plans_read_discoverable" ON public.public_plans FOR SELECT USING (
      auth.uid() = user_id OR (
        visibility IN ('public', 'unlisted') AND is_public = true AND is_removed = false AND moderation_status = 'active'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plans' AND policyname = 'public_plans_insert_own') THEN
    CREATE POLICY "public_plans_insert_own" ON public.public_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plans' AND policyname = 'public_plans_update_own') THEN
    CREATE POLICY "public_plans_update_own" ON public.public_plans FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plans' AND policyname = 'public_plans_delete_own') THEN
    CREATE POLICY "public_plans_delete_own" ON public.public_plans FOR DELETE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_likes' AND policyname = 'public_plan_likes_read') THEN
    CREATE POLICY "public_plan_likes_read" ON public.public_plan_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_likes' AND policyname = 'public_plan_likes_insert_own') THEN
    CREATE POLICY "public_plan_likes_insert_own" ON public.public_plan_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_likes' AND policyname = 'public_plan_likes_delete_own') THEN
    CREATE POLICY "public_plan_likes_delete_own" ON public.public_plan_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_saves' AND policyname = 'public_plan_saves_read') THEN
    CREATE POLICY "public_plan_saves_read" ON public.public_plan_saves FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_saves' AND policyname = 'public_plan_saves_insert_own') THEN
    CREATE POLICY "public_plan_saves_insert_own" ON public.public_plan_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_saves' AND policyname = 'public_plan_saves_delete_own') THEN
    CREATE POLICY "public_plan_saves_delete_own" ON public.public_plan_saves FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;
