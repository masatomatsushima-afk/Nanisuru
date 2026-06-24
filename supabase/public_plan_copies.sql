-- Nanisuru: public_plan_copies
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.public_plans ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.public_plan_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  copied_trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_plan_copies_plan_created_idx ON public.public_plan_copies (public_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS public_plan_copies_user_plan_idx ON public.public_plan_copies (user_id, public_plan_id);
ALTER TABLE public.public_plan_copies ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_copies' AND policyname = 'public_plan_copies_read') THEN
    CREATE POLICY "public_plan_copies_read" ON public.public_plan_copies FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_copies' AND policyname = 'public_plan_copies_insert_own') THEN
    CREATE POLICY "public_plan_copies_insert_own" ON public.public_plan_copies FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$policy$;

CREATE OR REPLACE FUNCTION public.refresh_public_plan_copy_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.public_plans SET copy_count = copy_count + 1, updated_at = now() WHERE id = new.public_plan_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.public_plans SET copy_count = greatest(copy_count - 1, 0), updated_at = now() WHERE id = old.public_plan_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND t.tgname = 'public_plan_copies_count_trigger' AND c.relname = 'public_plan_copies' AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER public_plan_copies_count_trigger AFTER INSERT OR DELETE ON public.public_plan_copies
    FOR EACH ROW EXECUTE FUNCTION public.refresh_public_plan_copy_count();
  END IF;
END
$trigger$;

UPDATE public.public_plans p
SET comment_count = (SELECT count(*)::integer FROM public.public_plan_comments c WHERE c.public_plan_id = p.id)
WHERE comment_count IS DISTINCT FROM (SELECT count(*)::integer FROM public.public_plan_comments c WHERE c.public_plan_id = p.id);
