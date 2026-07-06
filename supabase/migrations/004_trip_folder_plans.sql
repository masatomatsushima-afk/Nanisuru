-- 004: trip_folder_plans (folder ↔ plan M:N — future; app uses trip_folders.plan_payload)
-- Requires trip_folders (003) and saved_travel_plans (002)

CREATE TABLE IF NOT EXISTS public.trip_folder_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.trip_folders (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.saved_travel_plans (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, plan_id)
);

CREATE INDEX IF NOT EXISTS trip_folder_plans_folder_idx
  ON public.trip_folder_plans (folder_id, created_at DESC);

ALTER TABLE public.trip_folder_plans ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trip_folder_plans'
      AND policyname = 'trip_folder_plans_own'
  ) THEN
    CREATE POLICY "trip_folder_plans_own" ON public.trip_folder_plans
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.trip_folders f
          WHERE f.id = folder_id AND f.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.trip_folders f
          WHERE f.id = folder_id AND f.user_id = auth.uid()
        )
      );
  END IF;
END
$policy$;
