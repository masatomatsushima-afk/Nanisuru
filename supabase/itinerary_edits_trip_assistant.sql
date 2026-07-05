-- Nanisuru: itinerary_edits — trip assistant source columns
-- 安全・冪等。Supabase SQL Editor で実行してください。

ALTER TABLE public.itinerary_edits
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.trip_folders (id) ON DELETE SET NULL;

ALTER TABLE public.itinerary_edits
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS itinerary_edits_folder_id_idx
  ON public.itinerary_edits (folder_id, created_at DESC)
  WHERE folder_id IS NOT NULL;
