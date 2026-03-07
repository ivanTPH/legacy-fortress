-- Route parity + workspace support tables (additive, non-destructive)

CREATE TABLE IF NOT EXISTS public.section_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  category_key text NOT NULL,
  title text,
  summary text,
  estimated_value numeric NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS section_entries_user_idx
  ON public.section_entries (user_id);
CREATE INDEX IF NOT EXISTS section_entries_user_section_category_idx
  ON public.section_entries (user_id, section_key, category_key, created_at DESC);
CREATE INDEX IF NOT EXISTS section_entries_created_idx
  ON public.section_entries (created_at DESC);

ALTER TABLE public.section_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'section_entries' AND policyname = 'section_entries_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY section_entries_owner_rw ON public.section_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.reminder_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  in_app_enabled boolean NOT NULL DEFAULT true,
  monthly_review_day integer NOT NULL DEFAULT 1,
  advance_notice_days integer NOT NULL DEFAULT 7,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.reminder_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reminder_preferences' AND policyname = 'reminder_preferences_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY reminder_preferences_owner_rw ON public.reminder_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END$$;

ALTER TABLE public.property_assets
  ADD COLUMN IF NOT EXISTS file_path text;

ALTER TABLE public.business_interests
  ADD COLUMN IF NOT EXISTS file_path text;

ALTER TABLE public.digital_assets
  ADD COLUMN IF NOT EXISTS file_path text;

ALTER TABLE public.personal_possessions
  ADD COLUMN IF NOT EXISTS file_path text;

