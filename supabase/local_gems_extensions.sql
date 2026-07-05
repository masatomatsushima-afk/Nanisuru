-- Nanisuru: local_hidden_spots extensions (local gems visibility + social links)
-- Run after local_hidden_spots.sql. Safe to re-run.

ALTER TABLE public.local_hidden_spots
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('private', 'unlisted', 'public'));

ALTER TABLE public.local_hidden_spots
  ADD COLUMN IF NOT EXISTS instagram_url text NOT NULL DEFAULT '';

ALTER TABLE public.local_hidden_spots
  ADD COLUMN IF NOT EXISTS tiktok_url text NOT NULL DEFAULT '';

ALTER TABLE public.local_hidden_spots
  ADD COLUMN IF NOT EXISTS recommended_for text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS local_hidden_spots_visibility_idx
  ON public.local_hidden_spots (visibility, moderation_status, save_count DESC);

ALTER TABLE public.local_hidden_spots
  DROP CONSTRAINT IF EXISTS local_hidden_spots_category_check;

ALTER TABLE public.local_hidden_spots
  ADD CONSTRAINT local_hidden_spots_category_check CHECK (
    category IN (
      'グルメ', 'カフェ', '自然', '夜景', '買い物', 'デート', '一人時間', '雨の日', '夜遊び', 'その他',
      'レストラン', '景色', '散歩', '体験'
    )
  );
