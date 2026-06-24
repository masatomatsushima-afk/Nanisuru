-- Nanisuru: public_plan_videos
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.public_plan_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  video_url text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('Instagram', 'TikTok', 'YouTube')),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_plan_id, order_index)
);

CREATE INDEX IF NOT EXISTS public_plan_videos_plan_id_idx ON public.public_plan_videos (public_plan_id, order_index ASC);
ALTER TABLE public.public_plan_videos ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_videos' AND policyname = 'public_plan_videos_read_public_plans') THEN
    CREATE POLICY "public_plan_videos_read_public_plans" ON public.public_plan_videos FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND (plan.visibility IN ('public', 'unlisted') OR plan.user_id = auth.uid()))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_videos' AND policyname = 'public_plan_videos_insert_own') THEN
    CREATE POLICY "public_plan_videos_insert_own" ON public.public_plan_videos FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND plan.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_videos' AND policyname = 'public_plan_videos_update_own') THEN
    CREATE POLICY "public_plan_videos_update_own" ON public.public_plan_videos FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND plan.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND plan.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_videos' AND policyname = 'public_plan_videos_delete_own') THEN
    CREATE POLICY "public_plan_videos_delete_own" ON public.public_plan_videos FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND plan.user_id = auth.uid())
    );
  END IF;
END
$policy$;
