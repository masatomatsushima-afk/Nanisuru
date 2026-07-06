-- 011: profiles (alias over user_profiles) + avatar_url
-- App uses public.user_profiles; this migration adds spec-compatible view.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE VIEW public.profiles AS
SELECT
  user_id AS id,
  display_name,
  bio,
  avatar_url,
  created_at,
  updated_at
FROM public.user_profiles;

-- Auto-create profile row on new auth user (optional server-side bootstrap)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, bio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Nanisuruユーザー'),
    ''
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_auth_user_profile();
  END IF;
END
$trigger$;
