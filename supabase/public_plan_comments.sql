-- Nanisuru: public_plan_comments
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.public_plan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  comment_text text NOT NULL CHECK (char_length(trim(comment_text)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_plan_comments_plan_created_idx ON public.public_plan_comments (public_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS public_plan_comments_user_idx ON public.public_plan_comments (user_id);
ALTER TABLE public.public_plan_comments ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_comments' AND policyname = 'public_plan_comments_read') THEN
    CREATE POLICY "public_plan_comments_read" ON public.public_plan_comments FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.public_plans p WHERE p.id = public_plan_id AND (p.visibility IN ('public', 'unlisted') OR p.user_id = auth.uid()))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_comments' AND policyname = 'public_plan_comments_insert_own') THEN
    CREATE POLICY "public_plan_comments_insert_own" ON public.public_plan_comments FOR INSERT WITH CHECK (
      auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.public_plans p WHERE p.id = public_plan_id AND p.visibility IN ('public', 'unlisted'))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_comments' AND policyname = 'public_plan_comments_delete_own') THEN
    CREATE POLICY "public_plan_comments_delete_own" ON public.public_plan_comments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;

CREATE OR REPLACE FUNCTION public.refresh_public_plan_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.public_plans SET comment_count = comment_count + 1, updated_at = now() WHERE id = new.public_plan_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.public_plans SET comment_count = greatest(comment_count - 1, 0), updated_at = now() WHERE id = old.public_plan_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND t.tgname = 'public_plan_comments_count_trigger' AND c.relname = 'public_plan_comments' AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER public_plan_comments_count_trigger AFTER INSERT OR DELETE ON public.public_plan_comments
    FOR EACH ROW EXECUTE FUNCTION public.refresh_public_plan_comment_count();
  END IF;
END
$trigger$;
