ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.contacts
SET user_id = owner_user_id
WHERE user_id IS NULL
  AND owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_user_id_idx
  ON public.contacts (user_id);
