-- Nanisuru: public_plan_requests
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.public_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (
    request_type IN ('cheaper', 'less_travel', 'rainy_day', 'date_oriented', 'night_plan', 'more_gourmet')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_plan_id, user_id, request_type)
);

CREATE INDEX IF NOT EXISTS public_plan_requests_plan_type_idx ON public.public_plan_requests (public_plan_id, request_type);
CREATE INDEX IF NOT EXISTS public_plan_requests_user_idx ON public.public_plan_requests (user_id);
ALTER TABLE public.public_plan_requests ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_requests' AND policyname = 'public_plan_requests_read') THEN
    CREATE POLICY "public_plan_requests_read" ON public.public_plan_requests FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.public_plans p WHERE p.id = public_plan_id AND (p.visibility IN ('public', 'unlisted') OR p.user_id = auth.uid()))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_requests' AND policyname = 'public_plan_requests_insert_own') THEN
    CREATE POLICY "public_plan_requests_insert_own" ON public.public_plan_requests FOR INSERT WITH CHECK (
      auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.public_plans p WHERE p.id = public_plan_id AND p.visibility IN ('public', 'unlisted'))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_requests' AND policyname = 'public_plan_requests_delete_own') THEN
    CREATE POLICY "public_plan_requests_delete_own" ON public.public_plan_requests FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;
