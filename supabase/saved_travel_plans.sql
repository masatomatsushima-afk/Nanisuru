-- Nanisuru: saved_travel_plans（将来用・正規化ビュー）
--
-- 現行アプリは public.trips テーブルの payload (jsonb) に
-- 生成プラン・天気再調整・部分編集後の最新状態を保存しています。
-- このファイルは要件ドキュメント兼、将来 trips から分離する場合の参考スキーマです。
--
-- アプリ側: src/lib/saved-trips.ts → trips テーブル
-- TODO: trips から分離する場合は trip_folder_plans とのリレーションも検討

CREATE TABLE IF NOT EXISTS public.saved_travel_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  departure_date text NOT NULL DEFAULT '',
  return_date text NOT NULL DEFAULT '',
  duration_label text NOT NULL DEFAULT '',
  plan_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_travel_plans_user_updated_idx
  ON public.saved_travel_plans (user_id, updated_at DESC);

-- trip_folder_plans: フォルダとプランの多対多（現行は trip_folders.plan_payload + saved_trip_id）
CREATE TABLE IF NOT EXISTS public.trip_folder_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.trip_folders (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.saved_travel_plans (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, plan_id)
);

ALTER TABLE public.saved_travel_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_folder_plans ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_travel_plans' AND policyname = 'saved_travel_plans_own'
  ) THEN
    CREATE POLICY "saved_travel_plans_own" ON public.saved_travel_plans
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trip_folder_plans' AND policyname = 'trip_folder_plans_own'
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
