-- Nanisuru: notifications
-- 安全・冪等。全体セットアップは SUPABASE_SAFE_SETUP.sql を推奨。

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN ('plan_liked', 'plan_saved', 'plan_copied', 'plan_commented', 'user_followed', 'plan_ranked', 'plan_request')
  ),
  title text NOT NULL,
  message text NOT NULL,
  related_plan_id uuid REFERENCES public.public_plans (id) ON DELETE SET NULL,
  related_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id, is_read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_read_own') THEN
    CREATE POLICY "notifications_read_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_update_own') THEN
    CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END
$policy$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_type text, p_title text, p_message text,
  p_related_plan_id uuid DEFAULT NULL, p_related_user_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  IF p_related_user_id IS NOT NULL AND p_user_id = p_related_user_id THEN RETURN NULL; END IF;
  IF p_type = 'plan_ranked' AND p_related_plan_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = p_user_id AND n.type = 'plan_ranked' AND n.related_plan_id = p_related_plan_id
        AND n.created_at > now() - interval '7 days'
    ) THEN RETURN NULL; END IF;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, message, related_plan_id, related_user_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_related_plan_id, p_related_user_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, uuid) TO authenticated;
