-- Stage: account/profile hardening
-- Additive only. No drops or renames.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_path text;

CREATE TABLE IF NOT EXISTS public.contact_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secondary_email text,
  telephone text,
  mobile_number text,
  mobile_verified boolean NOT NULL DEFAULT false,
  mobile_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_details_user_id_uidx ON public.contact_details (user_id);
CREATE INDEX IF NOT EXISTS contact_details_updated_at_idx ON public.contact_details (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  house_name_or_number text,
  street_name text,
  town text,
  city text,
  country text,
  post_code text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS addresses_user_id_uidx ON public.addresses (user_id);
CREATE INDEX IF NOT EXISTS addresses_updated_at_idx ON public.addresses (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.communication_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sms_enabled boolean NOT NULL DEFAULT true,
  phone_enabled boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT true,
  letter_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS communication_preferences_user_id_uidx ON public.communication_preferences (user_id);

CREATE TABLE IF NOT EXISTS public.marketing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_preferences_user_id_uidx ON public.marketing_preferences (user_id);

CREATE TABLE IF NOT EXISTS public.identity_sensitive_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ni_number_encrypted bytea,
  ni_number_hash text,
  masked_ni_number text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_sensitive_data_user_id_uidx ON public.identity_sensitive_data (user_id);
CREATE INDEX IF NOT EXISTS identity_sensitive_data_hash_idx ON public.identity_sensitive_data (ni_number_hash);

CREATE TABLE IF NOT EXISTS public.billing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_charge numeric(10,2) NOT NULL DEFAULT 0,
  billing_currency text NOT NULL DEFAULT 'GBP',
  payment_method_type text NOT NULL DEFAULT 'card',
  payment_method_last4 text,
  direct_debit_reference text,
  standing_order_reference text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_profiles_user_id_uidx ON public.billing_profiles (user_id);
CREATE INDEX IF NOT EXISTS billing_profiles_updated_at_idx ON public.billing_profiles (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_method_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  provider_customer_id text,
  provider_payment_method_id text,
  payment_type text,
  status text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS payment_method_metadata_user_id_idx ON public.payment_method_metadata (user_id);
CREATE INDEX IF NOT EXISTS payment_method_metadata_provider_idx ON public.payment_method_metadata (provider, provider_customer_id);

CREATE TABLE IF NOT EXISTS public.mobile_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text,
  status text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS mobile_verification_events_user_created_idx ON public.mobile_verification_events (user_id, created_at DESC);

ALTER TABLE public.contact_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_sensitive_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_verification_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contact_details' AND policyname='contact_details_owner_rw') THEN
    EXECUTE 'CREATE POLICY contact_details_owner_rw ON public.contact_details FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='addresses' AND policyname='addresses_owner_rw') THEN
    EXECUTE 'CREATE POLICY addresses_owner_rw ON public.addresses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communication_preferences' AND policyname='communication_preferences_owner_rw') THEN
    EXECUTE 'CREATE POLICY communication_preferences_owner_rw ON public.communication_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='marketing_preferences' AND policyname='marketing_preferences_owner_rw') THEN
    EXECUTE 'CREATE POLICY marketing_preferences_owner_rw ON public.marketing_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='identity_sensitive_data' AND policyname='identity_sensitive_data_owner_rw') THEN
    EXECUTE 'CREATE POLICY identity_sensitive_data_owner_rw ON public.identity_sensitive_data FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='billing_profiles' AND policyname='billing_profiles_owner_rw') THEN
    EXECUTE 'CREATE POLICY billing_profiles_owner_rw ON public.billing_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_method_metadata' AND policyname='payment_method_metadata_owner_rw') THEN
    EXECUTE 'CREATE POLICY payment_method_metadata_owner_rw ON public.payment_method_metadata FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mobile_verification_events' AND policyname='mobile_verification_events_owner_rw') THEN
    EXECUTE 'CREATE POLICY mobile_verification_events_owner_rw ON public.mobile_verification_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.set_identity_sensitive_data(p_ni_number text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_clean text;
  v_masked text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean := upper(regexp_replace(coalesce(p_ni_number, ''), '[^A-Za-z0-9]', '', 'g'));
  IF length(v_clean) < 2 THEN
    RAISE EXCEPTION 'Invalid NI number';
  END IF;

  v_masked := repeat('•', GREATEST(length(v_clean) - 4, 0)) || right(v_clean, 4);

  INSERT INTO public.identity_sensitive_data (
    user_id,
    ni_number_encrypted,
    ni_number_hash,
    masked_ni_number,
    updated_at
  ) VALUES (
    v_user_id,
    pgp_sym_encrypt(v_clean, coalesce(current_setting('app.settings.ni_encryption_key', true), 'legacy-fortress-dev-key')),
    encode(digest(v_clean, 'sha256'), 'hex'),
    v_masked,
    timezone('utc', now())
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    ni_number_encrypted = EXCLUDED.ni_number_encrypted,
    ni_number_hash = EXCLUDED.ni_number_hash,
    masked_ni_number = EXCLUDED.masked_ni_number,
    updated_at = timezone('utc', now());
END;
$$;

REVOKE ALL ON FUNCTION public.set_identity_sensitive_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_identity_sensitive_data(text) TO authenticated;

INSERT INTO storage.buckets (id, name, public)
SELECT 'avatars', 'avatars', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY avatars_select_own ON storage.objects FOR SELECT USING (bucket_id = ''avatars'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_insert_own'
  ) THEN
    EXECUTE 'CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''avatars'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_update_own'
  ) THEN
    EXECUTE 'CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE USING (bucket_id = ''avatars'' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = ''avatars'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_delete_own'
  ) THEN
    EXECUTE 'CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE USING (bucket_id = ''avatars'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;
END$$;
