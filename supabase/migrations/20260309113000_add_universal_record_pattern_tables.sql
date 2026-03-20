CREATE TABLE IF NOT EXISTS public.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  category_key text NOT NULL,
  title text,
  provider_name text,
  provider_key text,
  summary text,
  value_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  archived_at timestamptz,
  CONSTRAINT records_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT records_currency_code_check CHECK (char_length(currency_code) = 3),
  CONSTRAINT records_value_minor_non_negative CHECK (value_minor >= 0)
);

CREATE INDEX IF NOT EXISTS records_owner_section_category_idx
  ON public.records (owner_user_id, section_key, category_key, created_at DESC);

CREATE INDEX IF NOT EXISTS records_owner_status_idx
  ON public.records (owner_user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'vault-docs',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  checksum text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS attachments_owner_record_idx
  ON public.attachments (owner_user_id, record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS attachments_storage_path_idx
  ON public.attachments (storage_bucket, storage_path);

CREATE TABLE IF NOT EXISTS public.record_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_email text,
  contact_role text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS record_contacts_owner_record_idx
  ON public.record_contacts (owner_user_id, record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.provider_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'other',
  match_terms text[] NOT NULL DEFAULT ARRAY[]::text[],
  logo_path text,
  icon_text text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT provider_catalog_type_check CHECK (provider_type IN ('social', 'bank', 'subscription', 'vehicle', 'other'))
);

CREATE INDEX IF NOT EXISTS provider_catalog_type_active_idx
  ON public.provider_catalog (provider_type, active);

INSERT INTO public.provider_catalog (provider_key, display_name, provider_type, match_terms, logo_path, icon_text, active)
VALUES
  ('facebook', 'Facebook', 'social', ARRAY['facebook', 'meta'], NULL, 'f', true),
  ('instagram', 'Instagram', 'social', ARRAY['instagram', 'insta'], NULL, 'ig', true),
  ('x', 'X', 'social', ARRAY['twitter', 'x.com', 'x'], NULL, 'x', true),
  ('linkedin', 'LinkedIn', 'social', ARRAY['linkedin'], NULL, 'in', true),
  ('tiktok', 'TikTok', 'social', ARRAY['tiktok', 'tik tok'], NULL, 'tt', true),
  ('youtube', 'YouTube', 'social', ARRAY['youtube'], NULL, 'yt', true),
  ('barclays', 'Barclays', 'bank', ARRAY['barclays'], NULL, NULL, true),
  ('hsbc', 'HSBC', 'bank', ARRAY['hsbc'], NULL, NULL, true),
  ('lloyds', 'Lloyds', 'bank', ARRAY['lloyds', 'lloyds bank'], NULL, NULL, true),
  ('natwest', 'NatWest', 'bank', ARRAY['natwest', 'nat west'], NULL, NULL, true),
  ('monzo', 'Monzo', 'bank', ARRAY['monzo'], NULL, NULL, true),
  ('netflix', 'Netflix', 'subscription', ARRAY['netflix'], NULL, 'n', true),
  ('spotify', 'Spotify', 'subscription', ARRAY['spotify'], NULL, 'sp', true),
  ('amazon-prime', 'Amazon Prime', 'subscription', ARRAY['amazon prime', 'prime video'], NULL, 'ap', true),
  ('disney-plus', 'Disney+', 'subscription', ARRAY['disney+', 'disney plus'], NULL, 'd+', true),
  ('apple-music', 'Apple Music', 'subscription', ARRAY['apple music'], NULL, 'am', true),
  ('bmw', 'BMW', 'vehicle', ARRAY['bmw'], NULL, 'bmw', true),
  ('ford', 'Ford', 'vehicle', ARRAY['ford'], NULL, 'fd', true),
  ('mercedes', 'Mercedes-Benz', 'vehicle', ARRAY['mercedes', 'mercedes-benz'], NULL, 'mb', true),
  ('tesla', 'Tesla', 'vehicle', ARRAY['tesla'], NULL, 't', true)
ON CONFLICT (provider_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider_type = EXCLUDED.provider_type,
  match_terms = EXCLUDED.match_terms,
  logo_path = EXCLUDED.logo_path,
  icon_text = EXCLUDED.icon_text,
  active = EXCLUDED.active,
  updated_at = timezone('utc', now());

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'records' AND policyname = 'records_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY records_owner_rw ON public.records FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attachments' AND policyname = 'attachments_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY attachments_owner_rw ON public.attachments FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'record_contacts' AND policyname = 'record_contacts_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY record_contacts_owner_rw ON public.record_contacts FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'provider_catalog' AND policyname = 'provider_catalog_auth_read'
  ) THEN
    EXECUTE 'CREATE POLICY provider_catalog_auth_read ON public.provider_catalog FOR SELECT TO authenticated USING (active = true)';
  END IF;
END $$;
