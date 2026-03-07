-- Stage: dashboard invitation, role, and completion model hardening
-- Additive only. No destructive changes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.contact_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  assigned_role text NOT NULL,
  invitation_status text NOT NULL DEFAULT 'pending',
  invite_token_hash text,
  invited_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  sent_at timestamptz,
  last_sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS contact_invitations_owner_created_idx
  ON public.contact_invitations (owner_user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS contact_invitations_owner_email_unique_pending_idx
  ON public.contact_invitations (owner_user_id, contact_email, assigned_role)
  WHERE invitation_status IN ('pending', 'accepted');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'contact_invitations' AND c.conname = 'contact_invitations_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.contact_invitations
      ADD CONSTRAINT contact_invitations_status_check
      CHECK (invitation_status IN ('pending','accepted','rejected','revoked'))
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
    WHERE n.nspname = 'public' AND t.relname = 'contact_invitations' AND c.conname = 'contact_invitations_role_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.contact_invitations
      ADD CONSTRAINT contact_invitations_role_check
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

CREATE TABLE IF NOT EXISTS public.role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES public.contact_invitations(id) ON DELETE CASCADE,
  assigned_role text NOT NULL,
  activation_status text NOT NULL DEFAULT 'invited',
  permissions_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS role_assignments_invitation_unique_idx
  ON public.role_assignments (invitation_id);
CREATE INDEX IF NOT EXISTS role_assignments_owner_updated_idx
  ON public.role_assignments (owner_user_id, updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'role_assignments' AND c.conname = 'role_assignments_activation_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.role_assignments
      ADD CONSTRAINT role_assignments_activation_status_check
      CHECK (activation_status IN (
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

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_assignment_id uuid NOT NULL REFERENCES public.role_assignments(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  request_status text NOT NULL DEFAULT 'pending',
  evidence_document_path text,
  submitted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS verification_requests_owner_status_idx
  ON public.verification_requests (owner_user_id, request_status, submitted_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'verification_requests' AND c.conname = 'verification_requests_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.verification_requests
      ADD CONSTRAINT verification_requests_status_check
      CHECK (request_status IN ('pending','submitted','approved','rejected'))
      NOT VALID
    $sql$;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.section_completion_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  completion_state text NOT NULL DEFAULT 'not_started',
  completion_percent integer NOT NULL DEFAULT 0,
  missing_items_count integer NOT NULL DEFAULT 0,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS section_completion_status_user_section_uidx
  ON public.section_completion_status (user_id, section_key);
CREATE INDEX IF NOT EXISTS section_completion_status_user_updated_idx
  ON public.section_completion_status (user_id, updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'section_completion_status' AND c.conname = 'section_completion_state_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.section_completion_status
      ADD CONSTRAINT section_completion_state_check
      CHECK (completion_state IN ('not_started','in_progress','complete'))
      NOT VALID
    $sql$;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.invitation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES public.contact_invitations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS invitation_events_owner_created_idx
  ON public.invitation_events (owner_user_id, created_at DESC);

ALTER TABLE public.contact_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_completion_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contact_invitations' AND policyname='contact_invitations_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY contact_invitations_owner_rw ON public.contact_invitations FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_assignments' AND policyname='role_assignments_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY role_assignments_owner_rw ON public.role_assignments FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='verification_requests' AND policyname='verification_requests_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY verification_requests_owner_rw ON public.verification_requests FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='section_completion_status' AND policyname='section_completion_status_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY section_completion_status_owner_rw ON public.section_completion_status FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invitation_events' AND policyname='invitation_events_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY invitation_events_owner_rw ON public.invitation_events FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;
END$$;
