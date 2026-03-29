ALTER TABLE IF EXISTS public.user_profiles
ADD COLUMN IF NOT EXISTS accessibility_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
