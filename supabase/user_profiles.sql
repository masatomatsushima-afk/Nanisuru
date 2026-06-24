-- Nanisuru: profiles（実テーブル名: user_profiles）& user_follows
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

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

CREATE INDEX IF NOT EXISTS user_profiles_display_name_idx ON public.user_profiles (display_name);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles_public_read') THEN
    CREATE POLICY "user_profiles_public_read" ON public.user_profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles_insert_own') THEN
    CREATE POLICY "user_profiles_insert_own" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles_update_own') THEN
    CREATE POLICY "user_profiles_update_own" ON public.user_profiles FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END
$policy$;

CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON public.user_follows (follower_id);
CREATE INDEX IF NOT EXISTS user_follows_following_idx ON public.user_follows (following_id);
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_follows' AND policyname = 'user_follows_read') THEN
    CREATE POLICY "user_follows_read" ON public.user_follows FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_follows' AND policyname = 'user_follows_insert_own') THEN
    CREATE POLICY "user_follows_insert_own" ON public.user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_follows' AND policyname = 'user_follows_delete_own') THEN
    CREATE POLICY "user_follows_delete_own" ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END
$policy$;

CREATE OR REPLACE FUNCTION public.refresh_user_follow_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_name text;
BEGIN
  IF tg_op = 'INSERT' THEN
    SELECT creator_display_name INTO target_name FROM public.public_plans WHERE user_id = new.following_id LIMIT 1;
    INSERT INTO public.user_profiles (user_id, display_name) VALUES (new.following_id, coalesce(target_name, 'Nanisuruユーザー')) ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_profiles (user_id, display_name) VALUES (new.follower_id, 'Nanisuruユーザー') ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.user_profiles SET follower_count = follower_count + 1, updated_at = now() WHERE user_id = new.following_id;
    UPDATE public.user_profiles SET following_count = following_count + 1, updated_at = now() WHERE user_id = new.follower_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.user_profiles SET follower_count = greatest(follower_count - 1, 0), updated_at = now() WHERE user_id = old.following_id;
    UPDATE public.user_profiles SET following_count = greatest(following_count - 1, 0), updated_at = now() WHERE user_id = old.follower_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND t.tgname = 'user_follows_count_trigger' AND c.relname = 'user_follows' AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER user_follows_count_trigger AFTER INSERT OR DELETE ON public.user_follows
    FOR EACH ROW EXECUTE FUNCTION public.refresh_user_follow_counts();
  END IF;
END
$trigger$;
