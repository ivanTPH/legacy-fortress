-- Ensure user_profiles has avatar_path for profile avatar persistence.
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_path text;
