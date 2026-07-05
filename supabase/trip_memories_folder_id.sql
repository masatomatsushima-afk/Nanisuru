-- Optional: link trip memories to trip assistant folders
-- Run after trip_memories.sql if folder-based memory lookup is needed.

ALTER TABLE public.trip_memories
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.trip_folders (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trip_memories_folder_id_idx
  ON public.trip_memories (folder_id)
  WHERE folder_id IS NOT NULL;

-- Optional per-media itinerary indices (day_index / item_index)
ALTER TABLE public.trip_memory_media
  ADD COLUMN IF NOT EXISTS day_index integer,
  ADD COLUMN IF NOT EXISTS item_index integer;
