-- Canonical model hardening: organisation -> wallet -> asset -> document
-- Additive migration only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Primary organisation',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS organisations_owner_uidx
  ON public.organisations (owner_user_id);

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Primary wallet',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT wallets_status_check CHECK (status IN ('active', 'archived'))
);

-- Harden a pre-existing legacy wallets table so the canonical migration can run safely
-- even when wallets already exists without the canonical columns.
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.wallets
  ALTER COLUMN label SET DEFAULT 'Primary wallet',
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN created_at SET DEFAULT timezone('utc', now()),
  ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

UPDATE public.wallets
SET
  label = COALESCE(NULLIF(label, ''), 'Primary wallet'),
  status = COALESCE(NULLIF(status, ''), 'active'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()))
WHERE
  label IS NULL
  OR label = ''
  OR status IS NULL
  OR status = ''
  OR created_at IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'wallets'
      AND c.conname = 'wallets_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_status_check
      CHECK (status IN ('active', 'archived'))
      NOT VALID
    $sql$;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS wallets_owner_active_uidx
  ON public.wallets (owner_user_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  category_key text NOT NULL,
  title text,
  provider_name text,
  provider_key text,
  summary text,
  value_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'GBP',
  visibility text NOT NULL DEFAULT 'private',
  status text NOT NULL DEFAULT 'active',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  archived_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT assets_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT assets_currency_code_check CHECK (char_length(currency_code) = 3),
  CONSTRAINT assets_value_minor_non_negative CHECK (value_minor >= 0),
  CONSTRAINT assets_visibility_check CHECK (visibility IN ('private', 'shared'))
);

-- Harden a pre-existing legacy assets table so the canonical migration can run safely
-- even when assets already exists without the canonical columns.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS section_key text,
  ADD COLUMN IF NOT EXISTS category_key text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS provider_name text,
  ADD COLUMN IF NOT EXISTS provider_key text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS value_minor bigint,
  ADD COLUMN IF NOT EXISTS currency_code text,
  ADD COLUMN IF NOT EXISTS visibility text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS metadata_json jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.assets
  ALTER COLUMN value_minor SET DEFAULT 0,
  ALTER COLUMN currency_code SET DEFAULT 'GBP',
  ALTER COLUMN visibility SET DEFAULT 'private',
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN metadata_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT timezone('utc', now()),
  ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

UPDATE public.assets
SET
  value_minor = COALESCE(value_minor, 0),
  currency_code = COALESCE(NULLIF(currency_code, ''), 'GBP'),
  visibility = COALESCE(NULLIF(visibility, ''), 'private'),
  status = COALESCE(NULLIF(status, ''), 'active'),
  metadata_json = COALESCE(metadata_json, '{}'::jsonb),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()))
WHERE
  value_minor IS NULL
  OR currency_code IS NULL
  OR currency_code = ''
  OR visibility IS NULL
  OR visibility = ''
  OR status IS NULL
  OR status = ''
  OR metadata_json IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'assets'
      AND c.conname = 'assets_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.assets
      ADD CONSTRAINT assets_status_check
      CHECK (status IN ('active', 'archived'))
      NOT VALID
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'assets'
      AND c.conname = 'assets_currency_code_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.assets
      ADD CONSTRAINT assets_currency_code_check
      CHECK (char_length(currency_code) = 3)
      NOT VALID
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'assets'
      AND c.conname = 'assets_value_minor_non_negative'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.assets
      ADD CONSTRAINT assets_value_minor_non_negative
      CHECK (value_minor >= 0)
      NOT VALID
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'assets'
      AND c.conname = 'assets_visibility_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.assets
      ADD CONSTRAINT assets_visibility_check
      CHECK (visibility IN ('private', 'shared'))
      NOT VALID
    $sql$;
  END IF;
END $$;

-- Relax known legacy assets requirements that conflict with canonical inserts/backfills.
-- These columns are not part of the canonical runtime contract, so they must not block
-- canonical assets rows from being created when a pre-existing legacy assets table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND column_name = 'category_id'
      AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.assets ALTER COLUMN category_id DROP NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assets_owner_wallet_category_idx
  ON public.assets (owner_user_id, wallet_id, section_key, category_key, updated_at DESC);

CREATE INDEX IF NOT EXISTS assets_owner_status_idx
  ON public.assets (owner_user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'vault-docs',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  checksum text,
  document_kind text NOT NULL DEFAULT 'document',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  CONSTRAINT documents_kind_check CHECK (document_kind IN ('document', 'photo'))
);

-- Harden a pre-existing legacy documents table so the canonical migration can run safely
-- even when documents already exists without the canonical columns.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS checksum text,
  ADD COLUMN IF NOT EXISTS document_kind text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.documents
  ALTER COLUMN storage_bucket SET DEFAULT 'vault-docs',
  ALTER COLUMN size_bytes SET DEFAULT 0,
  ALTER COLUMN document_kind SET DEFAULT 'document',
  ALTER COLUMN created_at SET DEFAULT timezone('utc', now()),
  ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

UPDATE public.documents
SET
  file_path = COALESCE(file_path, storage_path),
  document_type = COALESCE(document_type, document_kind),
  storage_bucket = COALESCE(NULLIF(storage_bucket, ''), 'vault-docs'),
  size_bytes = COALESCE(size_bytes, 0),
  document_kind = COALESCE(NULLIF(document_kind, ''), 'document'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()))
WHERE
  file_path IS NULL
  OR document_type IS NULL
  OR storage_bucket IS NULL
  OR storage_bucket = ''
  OR size_bytes IS NULL
  OR document_kind IS NULL
  OR document_kind = ''
  OR created_at IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'file_path'
      AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.documents ALTER COLUMN file_path DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'document_type'
      AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.documents ALTER COLUMN document_type DROP NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'documents'
      AND c.conname = 'documents_kind_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.documents
      ADD CONSTRAINT documents_kind_check
      CHECK (document_kind IN ('document', 'photo'))
      NOT VALID
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS documents_owner_asset_idx
  ON public.documents (owner_user_id, asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_storage_path_idx
  ON public.documents (storage_bucket, storage_path);

CREATE TABLE IF NOT EXISTS public.asset_encrypted_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload_encrypted bytea NOT NULL,
  payload_hash text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT asset_encrypted_payloads_asset_uidx UNIQUE (asset_id)
);

CREATE INDEX IF NOT EXISTS asset_encrypted_payloads_owner_idx
  ON public.asset_encrypted_payloads (owner_user_id, updated_at DESC);

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_encrypted_payloads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organisations' AND policyname = 'organisations_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY organisations_owner_rw ON public.organisations FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallets' AND policyname = 'wallets_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY wallets_owner_rw ON public.wallets FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'assets' AND policyname = 'assets_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY assets_owner_rw ON public.assets FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'documents_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY documents_owner_rw ON public.documents FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'asset_encrypted_payloads' AND policyname = 'asset_encrypted_payloads_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY asset_encrypted_payloads_owner_rw ON public.asset_encrypted_payloads FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.upsert_asset_sensitive_payload(
  p_asset_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_payload_text text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'Asset id is required';
  END IF;

  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    DELETE FROM public.asset_encrypted_payloads
    WHERE asset_id = p_asset_id AND owner_user_id = v_user_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assets a
    WHERE a.id = p_asset_id
      AND a.owner_user_id = v_user_id
      AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Asset not found for current user';
  END IF;

  v_payload_text := p_payload::text;

  INSERT INTO public.asset_encrypted_payloads (
    asset_id,
    owner_user_id,
    payload_encrypted,
    payload_hash,
    updated_at
  ) VALUES (
    p_asset_id,
    v_user_id,
    extensions.pgp_sym_encrypt(v_payload_text, coalesce(current_setting('app.settings.asset_payload_encryption_key', true), 'legacy-fortress-dev-key')),
    encode(extensions.digest(v_payload_text, 'sha256'), 'hex'),
    timezone('utc', now())
  )
  ON CONFLICT (asset_id)
  DO UPDATE SET
    payload_encrypted = EXCLUDED.payload_encrypted,
    payload_hash = EXCLUDED.payload_hash,
    updated_at = timezone('utc', now());
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_asset_sensitive_payload(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_asset_sensitive_payload(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_assets_sensitive_payloads(
  p_asset_ids uuid[]
)
RETURNS TABLE(asset_id uuid, payload jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    aep.asset_id,
    extensions.pgp_sym_decrypt(aep.payload_encrypted, coalesce(current_setting('app.settings.asset_payload_encryption_key', true), 'legacy-fortress-dev-key'))::jsonb AS payload
  FROM public.asset_encrypted_payloads aep
  JOIN public.assets a ON a.id = aep.asset_id
  WHERE a.owner_user_id = v_user_id
    AND aep.owner_user_id = v_user_id
    AND (p_asset_ids IS NULL OR aep.asset_id = ANY(p_asset_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.get_assets_sensitive_payloads(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assets_sensitive_payloads(uuid[]) TO authenticated;

-- Backfill canonical organisation/wallet for current record owners.
WITH owners AS (
  SELECT DISTINCT owner_user_id AS user_id
  FROM public.records
  WHERE owner_user_id IS NOT NULL
)
INSERT INTO public.organisations (owner_user_id, name)
SELECT o.user_id, 'Primary organisation'
FROM owners o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organisations org WHERE org.owner_user_id = o.user_id
);

INSERT INTO public.wallets (organisation_id, owner_user_id, label, status)
SELECT org.id, org.owner_user_id, 'Primary wallet', 'active'
FROM public.organisations org
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallets w WHERE w.owner_user_id = org.owner_user_id AND w.status = 'active'
);

-- Backfill records -> assets.
INSERT INTO public.assets (
  id,
  organisation_id,
  wallet_id,
  owner_user_id,
  section_key,
  category_key,
  title,
  provider_name,
  provider_key,
  summary,
  value_minor,
  currency_code,
  visibility,
  status,
  metadata_json,
  created_at,
  updated_at,
  archived_at
)
SELECT
  r.id,
  w.organisation_id,
  w.id,
  r.owner_user_id,
  r.section_key,
  r.category_key,
  r.title,
  r.provider_name,
  r.provider_key,
  r.summary,
  r.value_minor,
  r.currency_code,
  COALESCE((r.metadata->>'visibility')::text, 'private'),
  r.status,
  COALESCE(r.metadata, '{}'::jsonb),
  r.created_at,
  r.updated_at,
  r.archived_at
FROM public.records r
JOIN public.wallets w
  ON w.owner_user_id = r.owner_user_id
 AND w.status = 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.assets a WHERE a.id = r.id
);

-- Backfill attachments -> documents.
INSERT INTO public.documents (
  id,
  organisation_id,
  wallet_id,
  asset_id,
  owner_user_id,
  storage_bucket,
  storage_path,
  file_name,
  mime_type,
  size_bytes,
  checksum,
  document_kind,
  created_at,
  updated_at
)
SELECT
  att.id,
  a.organisation_id,
  a.wallet_id,
  att.record_id,
  att.owner_user_id,
  att.storage_bucket,
  att.storage_path,
  att.file_name,
  att.mime_type,
  att.size_bytes,
  att.checksum,
  CASE WHEN att.mime_type LIKE 'image/%' THEN 'photo' ELSE 'document' END,
  att.created_at,
  att.created_at
FROM public.attachments att
JOIN public.assets a ON a.id = att.record_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.documents d WHERE d.id = att.id
);
