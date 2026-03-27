CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  email_normalized text,
  phone text,
  contact_role text,
  relationship text,
  linked_context jsonb NOT NULL DEFAULT '[]'::jsonb,
  invite_status text NOT NULL DEFAULT 'not_invited',
  verification_status text NOT NULL DEFAULT 'not_verified',
  source_type text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS email_normalized text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS linked_context jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS invite_status text NOT NULL DEFAULT 'not_invited',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_verified',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

UPDATE public.contacts
SET
  linked_context = COALESCE(linked_context, '[]'::jsonb),
  invite_status = COALESCE(NULLIF(invite_status, ''), 'not_invited'),
  verification_status = COALESCE(NULLIF(verification_status, ''), 'not_verified'),
  source_type = COALESCE(NULLIF(source_type, ''), 'manual'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()))
WHERE
  linked_context IS NULL
  OR invite_status IS NULL
  OR verification_status IS NULL
  OR source_type IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

UPDATE public.contacts
SET email_normalized = NULLIF(lower(trim(email)), '')
WHERE email IS NOT NULL
  AND (email_normalized IS NULL OR email_normalized = '');

CREATE UNIQUE INDEX IF NOT EXISTS contacts_owner_email_unique_idx
  ON public.contacts (owner_user_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_owner_updated_idx
  ON public.contacts (owner_user_id, updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'contacts' AND c.conname = 'contacts_invite_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_invite_status_check
      CHECK (invite_status IN ('not_invited','invite_sent','accepted','rejected','revoked'))
      NOT VALID
    $sql$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'contacts' AND c.conname = 'contacts_verification_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_verification_status_check
      CHECK (verification_status IN (
        'not_verified',
        'invited',
        'accepted',
        'pending_verification',
        'verification_submitted',
        'verified',
        'active',
        'rejected',
        'revoked'
      ))
      NOT VALID
    $sql$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'contacts' AND c.conname = 'contacts_source_type_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_source_type_check
      CHECK (source_type IN ('next_of_kin','executor_asset','trusted_contact','invitation','record_contact','manual'))
      NOT VALID
    $sql$;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.contact_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  source_id uuid NOT NULL,
  section_key text,
  category_key text,
  context_label text,
  role_label text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_links_owner_source_unique_idx
  ON public.contact_links (owner_user_id, source_kind, source_id);

CREATE INDEX IF NOT EXISTS contact_links_owner_contact_idx
  ON public.contact_links (owner_user_id, contact_id, updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'contact_links' AND c.conname = 'contact_links_source_kind_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.contact_links
      ADD CONSTRAINT contact_links_source_kind_check
      CHECK (source_kind IN ('record','asset','invitation'))
      NOT VALID
    $sql$;
  END IF;
END$$;

ALTER TABLE public.record_contacts
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.contact_invitations
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS record_contacts_contact_id_idx
  ON public.record_contacts (contact_id);

CREATE INDEX IF NOT EXISTS contact_invitations_contact_id_idx
  ON public.contact_invitations (contact_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contacts' AND policyname='contacts_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY contacts_owner_rw ON public.contacts FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contact_links' AND policyname='contact_links_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY contact_links_owner_rw ON public.contact_links FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;
END$$;
