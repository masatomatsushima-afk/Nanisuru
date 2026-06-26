-- Nanisuru: プロフィールポートフォリオ（Instagram風公開プロフィール）
-- 安全・冪等。Supabase SQL Editor で実行してください。

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT '';

ALTER TABLE public.public_plans
  ADD COLUMN IF NOT EXISTS show_on_profile boolean NOT NULL DEFAULT true;

ALTER TABLE public.trip_memories
  ADD COLUMN IF NOT EXISTS show_on_profile boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS public_plans_profile_idx
  ON public.public_plans (user_id, show_on_profile, created_at DESC)
  WHERE visibility = 'public' AND is_public = true AND is_removed = false;

CREATE INDEX IF NOT EXISTS trip_memories_profile_idx
  ON public.trip_memories (user_id, show_on_profile, created_at DESC)
  WHERE visibility = 'public';
