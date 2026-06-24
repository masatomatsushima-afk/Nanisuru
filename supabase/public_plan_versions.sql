-- Nanisuru: public_plan_versions
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.public_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  version_public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  version_type text NOT NULL CHECK (
    version_type IN ('cheaper', 'less_travel', 'rainy_day', 'date_oriented', 'night_plan', 'more_gourmet')
  ),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_public_plan_id)
);

CREATE INDEX IF NOT EXISTS public_plan_versions_original_idx ON public.public_plan_versions (original_public_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS public_plan_versions_type_idx ON public.public_plan_versions (original_public_plan_id, version_type);
ALTER TABLE public.public_plan_versions ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_versions' AND policyname = 'public_plan_versions_read') THEN
    CREATE POLICY "public_plan_versions_read" ON public.public_plan_versions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.public_plans original WHERE original.id = original_public_plan_id AND (original.visibility IN ('public', 'unlisted') OR original.user_id = auth.uid()))
      AND EXISTS (SELECT 1 FROM public.public_plans version WHERE version.id = version_public_plan_id AND (version.visibility IN ('public', 'unlisted') OR version.user_id = auth.uid()))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_versions' AND policyname = 'public_plan_versions_insert_creator') THEN
    CREATE POLICY "public_plan_versions_insert_creator" ON public.public_plan_versions FOR INSERT WITH CHECK (
      auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.public_plans original WHERE original.id = original_public_plan_id AND original.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_versions' AND policyname = 'public_plan_versions_delete_creator') THEN
    CREATE POLICY "public_plan_versions_delete_creator" ON public.public_plan_versions FOR DELETE USING (auth.uid() = created_by);
  END IF;
END
$policy$;
