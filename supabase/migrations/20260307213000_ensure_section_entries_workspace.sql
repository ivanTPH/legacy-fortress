-- Ensure shared workspace table exists in environments with migration drift.
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

ALTER TABLE public.section_entries
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.section_entries
  ADD COLUMN IF NOT EXISTS file_path text;

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
