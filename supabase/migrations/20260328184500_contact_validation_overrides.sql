ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS validation_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.contacts
SET validation_overrides = '{}'::jsonb
WHERE validation_overrides IS NULL;
