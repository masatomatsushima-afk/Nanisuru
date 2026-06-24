-- Nanisuru: public_plan_images
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.public_plan_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_plan_id uuid NOT NULL REFERENCES public.public_plans (id) ON DELETE CASCADE,
  image_url text NOT NULL,
  storage_path text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_plan_id, order_index)
);

CREATE INDEX IF NOT EXISTS public_plan_images_plan_id_idx ON public.public_plan_images (public_plan_id, order_index ASC);
ALTER TABLE public.public_plan_images ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_images' AND policyname = 'public_plan_images_read_public_plans') THEN
    CREATE POLICY "public_plan_images_read_public_plans" ON public.public_plan_images FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND (plan.visibility IN ('public', 'unlisted') OR plan.user_id = auth.uid()))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_images' AND policyname = 'public_plan_images_insert_own') THEN
    CREATE POLICY "public_plan_images_insert_own" ON public.public_plan_images FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND plan.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_images' AND policyname = 'public_plan_images_update_own') THEN
    CREATE POLICY "public_plan_images_update_own" ON public.public_plan_images FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND plan.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND plan.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'public_plan_images' AND policyname = 'public_plan_images_delete_own') THEN
    CREATE POLICY "public_plan_images_delete_own" ON public.public_plan_images FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.public_plans plan WHERE plan.id = public_plan_id AND plan.user_id = auth.uid())
    );
  END IF;
END
$policy$;

INSERT INTO storage.buckets (id, name, public) VALUES ('public-plan-images', 'public-plan-images', true) ON CONFLICT (id) DO NOTHING;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_plan_images_storage_read') THEN
    CREATE POLICY "public_plan_images_storage_read" ON storage.objects FOR SELECT USING (bucket_id = 'public-plan-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_plan_images_storage_insert_own') THEN
    CREATE POLICY "public_plan_images_storage_insert_own" ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'public-plan-images' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_plan_images_storage_update_own') THEN
    CREATE POLICY "public_plan_images_storage_update_own" ON storage.objects FOR UPDATE
      USING (bucket_id = 'public-plan-images' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'public-plan-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'public_plan_images_storage_delete_own') THEN
    CREATE POLICY "public_plan_images_storage_delete_own" ON storage.objects FOR DELETE USING (
      bucket_id = 'public-plan-images' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$policy$;
