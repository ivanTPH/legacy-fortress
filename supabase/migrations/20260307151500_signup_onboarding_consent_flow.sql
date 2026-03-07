-- Stage: signup + onboarding + consent flow support
-- Additive only

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_onboarding_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step text NOT NULL DEFAULT 'identity',
  completed_steps text[] NOT NULL DEFAULT '{}'::text[],
  is_completed boolean NOT NULL DEFAULT false,
  terms_accepted boolean NOT NULL DEFAULT false,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  tour_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS user_onboarding_state_user_id_uidx ON public.user_onboarding_state (user_id);
CREATE INDEX IF NOT EXISTS user_onboarding_state_updated_at_idx ON public.user_onboarding_state (updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_onboarding_state'
      AND c.conname = 'user_onboarding_state_step_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.user_onboarding_state
      ADD CONSTRAINT user_onboarding_state_step_check
      CHECK (current_step IN (
        'identity',
        'verification',
        'consent',
        'personal_details',
        'invite_contacts',
        'send_invites',
        'guided_tour',
        'complete'
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
    WHERE n.nspname = 'public'
      AND t.relname = 'user_onboarding_state'
      AND c.conname = 'user_onboarding_completed_requires_terms_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.user_onboarding_state
      ADD CONSTRAINT user_onboarding_completed_requires_terms_check
      CHECK ((is_completed = false) OR (terms_accepted = true))
      NOT VALID
    $sql$;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  source text NOT NULL DEFAULT 'onboarding',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS terms_acceptances_user_id_uidx ON public.terms_acceptances (user_id);
CREATE INDEX IF NOT EXISTS terms_acceptances_version_idx ON public.terms_acceptances (terms_version, accepted_at DESC);

CREATE TABLE IF NOT EXISTS public.onboarding_invite_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  assigned_role text NOT NULL,
  converted_to_invitation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS onboarding_invite_contacts_user_created_idx
  ON public.onboarding_invite_contacts (user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'onboarding_invite_contacts'
      AND c.conname = 'onboarding_invite_contacts_role_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.onboarding_invite_contacts
      ADD CONSTRAINT onboarding_invite_contacts_role_check
      CHECK (assigned_role IN (
        'professional_advisor',
        'accountant',
        'financial_advisor',
        'lawyer',
        'executor',
        'power_of_attorney',
        'friend_or_family'
      ))
      NOT VALID
    $sql$;
  END IF;
END$$;

ALTER TABLE public.user_onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_invite_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_onboarding_state' AND policyname='user_onboarding_state_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY user_onboarding_state_owner_rw ON public.user_onboarding_state FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='terms_acceptances' AND policyname='terms_acceptances_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY terms_acceptances_owner_rw ON public.terms_acceptances FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='onboarding_invite_contacts' AND policyname='onboarding_invite_contacts_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY onboarding_invite_contacts_owner_rw ON public.onboarding_invite_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END$$;
