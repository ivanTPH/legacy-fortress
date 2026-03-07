-- Stage 6: Additive schema support for Property, Business, Digital, and Profile vault pages.
-- Non-destructive only: create-if-missing tables, add-if-missing columns, and query-aligned indexes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Property vault table
CREATE TABLE IF NOT EXISTS public.property_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_type text,
  address text,
  ownership_type text,
  estimated_value numeric(14,2) DEFAULT 0,
  mortgage_lender text,
  mortgage_balance numeric(14,2) DEFAULT 0,
  insurance_provider text,
  policy_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS property_type text;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS ownership_type text;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS estimated_value numeric(14,2) DEFAULT 0;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS mortgage_lender text;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS mortgage_balance numeric(14,2) DEFAULT 0;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS insurance_provider text;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now());
ALTER TABLE public.property_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

ALTER TABLE public.property_assets ALTER COLUMN estimated_value SET DEFAULT 0;
ALTER TABLE public.property_assets ALTER COLUMN mortgage_balance SET DEFAULT 0;
ALTER TABLE public.property_assets ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
ALTER TABLE public.property_assets ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS property_assets_user_id_idx
  ON public.property_assets (user_id);
CREATE INDEX IF NOT EXISTS property_assets_created_at_idx
  ON public.property_assets (created_at DESC);
CREATE INDEX IF NOT EXISTS property_assets_user_created_at_idx
  ON public.property_assets (user_id, created_at DESC);

-- Business vault table
CREATE TABLE IF NOT EXISTS public.business_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text,
  entity_name text,
  registration_number text,
  ownership_percent numeric(6,2) DEFAULT 0,
  estimated_value numeric(14,2) DEFAULT 0,
  advisor_name text,
  advisor_contact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS entity_name text;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS ownership_percent numeric(6,2) DEFAULT 0;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS estimated_value numeric(14,2) DEFAULT 0;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS advisor_name text;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS advisor_contact text;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now());
ALTER TABLE public.business_interests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

ALTER TABLE public.business_interests ALTER COLUMN ownership_percent SET DEFAULT 0;
ALTER TABLE public.business_interests ALTER COLUMN estimated_value SET DEFAULT 0;
ALTER TABLE public.business_interests ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
ALTER TABLE public.business_interests ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS business_interests_user_id_idx
  ON public.business_interests (user_id);
CREATE INDEX IF NOT EXISTS business_interests_created_at_idx
  ON public.business_interests (created_at DESC);
CREATE INDEX IF NOT EXISTS business_interests_user_created_at_idx
  ON public.business_interests (user_id, created_at DESC);

-- Digital vault table
CREATE TABLE IF NOT EXISTS public.digital_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text,
  service_name text,
  username_or_email text,
  recovery_method text,
  has_2fa boolean DEFAULT false,
  executor_instructions text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS service_name text;
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS username_or_email text;
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS recovery_method text;
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS has_2fa boolean DEFAULT false;
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS executor_instructions text;
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now());
ALTER TABLE public.digital_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

ALTER TABLE public.digital_assets ALTER COLUMN has_2fa SET DEFAULT false;
ALTER TABLE public.digital_assets ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
ALTER TABLE public.digital_assets ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS digital_assets_user_id_idx
  ON public.digital_assets (user_id);
CREATE INDEX IF NOT EXISTS digital_assets_created_at_idx
  ON public.digital_assets (created_at DESC);
CREATE INDEX IF NOT EXISTS digital_assets_user_created_at_idx
  ON public.digital_assets (user_id, created_at DESC);

-- Profile settings table used by upsert(onConflict: user_id)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  date_of_birth date,
  about text,
  notification_email text,
  preferred_currency text DEFAULT 'GBP',
  language text DEFAULT 'English',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_email text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'GBP';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS language text DEFAULT 'English';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now());
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

ALTER TABLE public.user_profiles ALTER COLUMN preferred_currency SET DEFAULT 'GBP';
ALTER TABLE public.user_profiles ALTER COLUMN language SET DEFAULT 'English';
ALTER TABLE public.user_profiles ALTER COLUMN created_at SET DEFAULT timezone('utc', now());
ALTER TABLE public.user_profiles ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx
  ON public.user_profiles (user_id);
CREATE INDEX IF NOT EXISTS user_profiles_created_at_idx
  ON public.user_profiles (created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'user_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_uidx ON public.user_profiles (user_id)';
    ELSE
      RAISE NOTICE 'Skipped user_profiles_user_id_uidx: duplicate user_id rows exist.';
    END IF;
  END IF;
END
$$;

-- Add FK constraints for pre-existing tables only when safe to do so.
DO $$
BEGIN
  IF to_regclass('public.property_assets') IS NOT NULL
     AND to_regclass('auth.users') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'property_assets'
         AND column_name = 'user_id'
         AND udt_name = 'uuid'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'property_assets'
         AND c.conname = 'property_assets_user_id_fkey'
     ) THEN
    EXECUTE $sql$
      ALTER TABLE public.property_assets
      ADD CONSTRAINT property_assets_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID
    $sql$;
  END IF;

  IF to_regclass('public.business_interests') IS NOT NULL
     AND to_regclass('auth.users') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'business_interests'
         AND column_name = 'user_id'
         AND udt_name = 'uuid'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'business_interests'
         AND c.conname = 'business_interests_user_id_fkey'
     ) THEN
    EXECUTE $sql$
      ALTER TABLE public.business_interests
      ADD CONSTRAINT business_interests_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID
    $sql$;
  END IF;

  IF to_regclass('public.digital_assets') IS NOT NULL
     AND to_regclass('auth.users') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'digital_assets'
         AND column_name = 'user_id'
         AND udt_name = 'uuid'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'digital_assets'
         AND c.conname = 'digital_assets_user_id_fkey'
     ) THEN
    EXECUTE $sql$
      ALTER TABLE public.digital_assets
      ADD CONSTRAINT digital_assets_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID
    $sql$;
  END IF;

  IF to_regclass('public.user_profiles') IS NOT NULL
     AND to_regclass('auth.users') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'user_profiles'
         AND column_name = 'user_id'
         AND udt_name = 'uuid'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'user_profiles'
         AND c.conname = 'user_profiles_user_id_fkey'
     ) THEN
    EXECUTE $sql$
      ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID
    $sql$;
  END IF;
END
$$;
