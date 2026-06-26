-- Nanisuru: ローカルの穴場（local_hidden_spots）
-- 安全・冪等。全体セットアップ後に単体実行可。

-- プロフィール: ローカル投稿者バッジ
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_local_contributor boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS local_expert_areas text[] NOT NULL DEFAULT '{}';

-- 穴場スポット本体
CREATE TABLE IF NOT EXISTS public.local_hidden_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  area text NOT NULL CHECK (char_length(trim(area)) BETWEEN 1 AND 80),
  category text NOT NULL CHECK (
    category IN (
      'カフェ', 'レストラン', '景色', '散歩', '夜景', '買い物',
      '体験', '雨の日', 'デート', '一人時間', 'その他'
    )
  ),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 5 AND 800),
  best_time text NOT NULL DEFAULT '',
  estimated_budget text NOT NULL DEFAULT '',
  crowd_tip text NOT NULL DEFAULT '',
  caution text NOT NULL DEFAULT '',
  google_maps_url text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  moderation_status text NOT NULL DEFAULT 'active'
    CHECK (moderation_status IN ('active', 'pending', 'hidden', 'removed')),
  creator_display_name text NOT NULL DEFAULT '',
  like_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  want_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS local_hidden_spots_discover_idx
  ON public.local_hidden_spots (moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS local_hidden_spots_area_idx
  ON public.local_hidden_spots (area, moderation_status);

CREATE INDEX IF NOT EXISTS local_hidden_spots_user_idx
  ON public.local_hidden_spots (user_id, created_at DESC);

ALTER TABLE public.local_hidden_spots ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_hidden_spots'
      AND policyname = 'local_hidden_spots_read_active'
  ) THEN
    CREATE POLICY "local_hidden_spots_read_active"
      ON public.local_hidden_spots FOR SELECT
      USING (moderation_status = 'active' OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_hidden_spots'
      AND policyname = 'local_hidden_spots_insert_own'
  ) THEN
    CREATE POLICY "local_hidden_spots_insert_own"
      ON public.local_hidden_spots FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_hidden_spots'
      AND policyname = 'local_hidden_spots_update_own'
  ) THEN
    CREATE POLICY "local_hidden_spots_update_own"
      ON public.local_hidden_spots FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'local_hidden_spots'
      AND policyname = 'local_hidden_spots_delete_own'
  ) THEN
    CREATE POLICY "local_hidden_spots_delete_own"
      ON public.local_hidden_spots FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$policy$;

-- いいね
CREATE TABLE IF NOT EXISTS public.local_hidden_spot_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  spot_id uuid NOT NULL REFERENCES public.local_hidden_spots (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spot_id)
);

CREATE INDEX IF NOT EXISTS local_hidden_spot_likes_spot_idx
  ON public.local_hidden_spot_likes (spot_id);

ALTER TABLE public.local_hidden_spot_likes ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_likes' AND policyname = 'local_hidden_spot_likes_read'
  ) THEN
    CREATE POLICY "local_hidden_spot_likes_read"
      ON public.local_hidden_spot_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_likes' AND policyname = 'local_hidden_spot_likes_insert_own'
  ) THEN
    CREATE POLICY "local_hidden_spot_likes_insert_own"
      ON public.local_hidden_spot_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_likes' AND policyname = 'local_hidden_spot_likes_delete_own'
  ) THEN
    CREATE POLICY "local_hidden_spot_likes_delete_own"
      ON public.local_hidden_spot_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;

-- 保存
CREATE TABLE IF NOT EXISTS public.local_hidden_spot_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  spot_id uuid NOT NULL REFERENCES public.local_hidden_spots (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spot_id)
);

CREATE INDEX IF NOT EXISTS local_hidden_spot_saves_spot_idx
  ON public.local_hidden_spot_saves (spot_id);

ALTER TABLE public.local_hidden_spot_saves ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_saves' AND policyname = 'local_hidden_spot_saves_read'
  ) THEN
    CREATE POLICY "local_hidden_spot_saves_read"
      ON public.local_hidden_spot_saves FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_saves' AND policyname = 'local_hidden_spot_saves_insert_own'
  ) THEN
    CREATE POLICY "local_hidden_spot_saves_insert_own"
      ON public.local_hidden_spot_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_saves' AND policyname = 'local_hidden_spot_saves_delete_own'
  ) THEN
    CREATE POLICY "local_hidden_spot_saves_delete_own"
      ON public.local_hidden_spot_saves FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;

-- 行ってみたい
CREATE TABLE IF NOT EXISTS public.local_hidden_spot_wants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  spot_id uuid NOT NULL REFERENCES public.local_hidden_spots (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spot_id)
);

CREATE INDEX IF NOT EXISTS local_hidden_spot_wants_spot_idx
  ON public.local_hidden_spot_wants (spot_id);

ALTER TABLE public.local_hidden_spot_wants ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_wants' AND policyname = 'local_hidden_spot_wants_read'
  ) THEN
    CREATE POLICY "local_hidden_spot_wants_read"
      ON public.local_hidden_spot_wants FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_wants' AND policyname = 'local_hidden_spot_wants_insert_own'
  ) THEN
    CREATE POLICY "local_hidden_spot_wants_insert_own"
      ON public.local_hidden_spot_wants FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_wants' AND policyname = 'local_hidden_spot_wants_delete_own'
  ) THEN
    CREATE POLICY "local_hidden_spot_wants_delete_own"
      ON public.local_hidden_spot_wants FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;

-- コメント
CREATE TABLE IF NOT EXISTS public.local_hidden_spot_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES public.local_hidden_spots (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  comment_text text NOT NULL CHECK (char_length(trim(comment_text)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS local_hidden_spot_comments_spot_idx
  ON public.local_hidden_spot_comments (spot_id, created_at DESC);

ALTER TABLE public.local_hidden_spot_comments ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_comments' AND policyname = 'local_hidden_spot_comments_read'
  ) THEN
    CREATE POLICY "local_hidden_spot_comments_read"
      ON public.local_hidden_spot_comments FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.local_hidden_spots s
          WHERE s.id = spot_id AND (s.moderation_status = 'active' OR s.user_id = auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_comments' AND policyname = 'local_hidden_spot_comments_insert_own'
  ) THEN
    CREATE POLICY "local_hidden_spot_comments_insert_own"
      ON public.local_hidden_spot_comments FOR INSERT WITH CHECK (
        auth.uid() = user_id AND EXISTS (
          SELECT 1 FROM public.local_hidden_spots s
          WHERE s.id = spot_id AND s.moderation_status = 'active'
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'local_hidden_spot_comments' AND policyname = 'local_hidden_spot_comments_delete_own'
  ) THEN
    CREATE POLICY "local_hidden_spot_comments_delete_own"
      ON public.local_hidden_spot_comments FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$policy$;

-- カウンター更新
CREATE OR REPLACE FUNCTION public.refresh_local_hidden_spot_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.local_hidden_spots SET like_count = like_count + 1, updated_at = now() WHERE id = new.spot_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.local_hidden_spots SET like_count = greatest(like_count - 1, 0), updated_at = now() WHERE id = old.spot_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_local_hidden_spot_save_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.local_hidden_spots SET save_count = save_count + 1, updated_at = now() WHERE id = new.spot_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.local_hidden_spots SET save_count = greatest(save_count - 1, 0), updated_at = now() WHERE id = old.spot_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_local_hidden_spot_want_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.local_hidden_spots SET want_count = want_count + 1, updated_at = now() WHERE id = new.spot_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.local_hidden_spots SET want_count = greatest(want_count - 1, 0), updated_at = now() WHERE id = old.spot_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_local_hidden_spot_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.local_hidden_spots SET comment_count = comment_count + 1, updated_at = now() WHERE id = new.spot_id;
    RETURN new;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.local_hidden_spots SET comment_count = greatest(comment_count - 1, 0), updated_at = now() WHERE id = old.spot_id;
    RETURN old;
  END IF;
  RETURN NULL;
END;
$$;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgname = 'local_hidden_spot_likes_count_trigger'
      AND c.relname = 'local_hidden_spot_likes'
  ) THEN
    CREATE TRIGGER local_hidden_spot_likes_count_trigger
      AFTER INSERT OR DELETE ON public.local_hidden_spot_likes
      FOR EACH ROW EXECUTE FUNCTION public.refresh_local_hidden_spot_like_count();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgname = 'local_hidden_spot_saves_count_trigger'
      AND c.relname = 'local_hidden_spot_saves'
  ) THEN
    CREATE TRIGGER local_hidden_spot_saves_count_trigger
      AFTER INSERT OR DELETE ON public.local_hidden_spot_saves
      FOR EACH ROW EXECUTE FUNCTION public.refresh_local_hidden_spot_save_count();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgname = 'local_hidden_spot_wants_count_trigger'
      AND c.relname = 'local_hidden_spot_wants'
  ) THEN
    CREATE TRIGGER local_hidden_spot_wants_count_trigger
      AFTER INSERT OR DELETE ON public.local_hidden_spot_wants
      FOR EACH ROW EXECUTE FUNCTION public.refresh_local_hidden_spot_want_count();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgname = 'local_hidden_spot_comments_count_trigger'
      AND c.relname = 'local_hidden_spot_comments'
  ) THEN
    CREATE TRIGGER local_hidden_spot_comments_count_trigger
      AFTER INSERT OR DELETE ON public.local_hidden_spot_comments
      FOR EACH ROW EXECUTE FUNCTION public.refresh_local_hidden_spot_comment_count();
  END IF;
END
$trigger$;

-- 通報対象に穴場を追加（既存 CHECK がある場合は手動で ALTER してください）
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('public_plan', 'comment', 'user', 'local_hidden_spot'));
