ALTER TABLE public.enterprise_invitations
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'organisation',
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS resend_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_resent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS seat_id uuid REFERENCES public.enterprise_seats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_reference text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS synthetic_run_marker text;

ALTER TABLE public.enterprise_invitations
  DROP CONSTRAINT IF EXISTS enterprise_invitations_type_check,
  ADD CONSTRAINT enterprise_invitations_type_check
  CHECK (invitation_type IN ('organisation_admin','enterprise_user','enrolment_link'));

ALTER TABLE public.enterprise_invitations
  DROP CONSTRAINT IF EXISTS enterprise_invitations_role_template_check,
  ADD CONSTRAINT enterprise_invitations_role_template_check
  CHECK (role_template IN ('organisation_admin','organisation_licence_manager','organisation_user_manager','organisation_reporting_viewer','organisation_auditor','organisation_member','licence_manager','user_manager','reporting_viewer','read_only_auditor','enterprise_user'));

ALTER TABLE public.enterprise_invitations
  DROP CONSTRAINT IF EXISTS enterprise_invitations_scope_check,
  ADD CONSTRAINT enterprise_invitations_scope_check
  CHECK (scope = 'organisation');

ALTER TABLE public.enterprise_invitations
  DROP CONSTRAINT IF EXISTS enterprise_invitations_resend_count_check,
  ADD CONSTRAINT enterprise_invitations_resend_count_check
  CHECK (resend_count >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_invitations_pending_email_idx
  ON public.enterprise_invitations (organisation_id, email_normalized)
  WHERE status IN ('draft','scheduled','sent','delivered');

CREATE TABLE IF NOT EXISTS public.enterprise_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  licence_id uuid REFERENCES public.enterprise_licences(id) ON DELETE SET NULL,
  seat_id uuid REFERENCES public.enterprise_seats(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  full_name text,
  organisation_role text NOT NULL DEFAULT 'organisation_member',
  membership_status text NOT NULL DEFAULT 'invited',
  onboarding_status text NOT NULL DEFAULT 'not_started',
  consent_status text NOT NULL DEFAULT 'pending',
  internal_reference text,
  department text,
  invited_at timestamptz,
  joined_at timestamptz,
  suspended_at timestamptz,
  removed_at timestamptz,
  last_active_at timestamptz,
  access_expires_at timestamptz,
  synthetic_run_marker text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_memberships_role_check CHECK (organisation_role IN ('organisation_admin','organisation_licence_manager','organisation_user_manager','organisation_reporting_viewer','organisation_auditor','organisation_member','licence_manager','user_manager','reporting_viewer','read_only_auditor')),
  CONSTRAINT enterprise_memberships_status_check CHECK (membership_status IN ('invited','active','suspended','removed')),
  CONSTRAINT enterprise_memberships_onboarding_check CHECK (onboarding_status IN ('not_started','pending','in_progress','blocked','complete')),
  CONSTRAINT enterprise_memberships_consent_check CHECK (consent_status IN ('pending','accepted','partially_accepted','declined'))
);

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_memberships_active_user_org_idx
  ON public.enterprise_memberships (organisation_id, user_id)
  WHERE membership_status IN ('invited','active','suspended');

CREATE INDEX IF NOT EXISTS enterprise_memberships_org_status_idx
  ON public.enterprise_memberships (organisation_id, membership_status, created_at DESC);

CREATE INDEX IF NOT EXISTS enterprise_memberships_email_idx
  ON public.enterprise_memberships (email_normalized);

ALTER TABLE public.enterprise_seats
  ADD COLUMN IF NOT EXISTS invitation_id uuid REFERENCES public.enterprise_invitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES public.enterprise_memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS synthetic_run_marker text;

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_seats_active_user_licence_idx
  ON public.enterprise_seats (licence_id, user_id)
  WHERE user_id IS NOT NULL AND seat_status IN ('invited','active','suspended');

CREATE TABLE IF NOT EXISTS public.enterprise_enrolment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  licence_id uuid NOT NULL REFERENCES public.enterprise_licences(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  max_claims integer NOT NULL DEFAULT 1,
  claims_used integer NOT NULL DEFAULT 0,
  allowed_email_domain text,
  approval_required boolean NOT NULL DEFAULT false,
  default_role text NOT NULL DEFAULT 'organisation_member',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_enrolment_links_status_check CHECK (status IN ('active','paused','expired','exhausted','revoked')),
  CONSTRAINT enterprise_enrolment_links_claims_check CHECK (max_claims > 0 AND claims_used >= 0 AND claims_used <= max_claims),
  CONSTRAINT enterprise_enrolment_links_role_check CHECK (default_role IN ('organisation_member','organisation_user_manager','organisation_reporting_viewer','organisation_auditor'))
);

CREATE INDEX IF NOT EXISTS enterprise_enrolment_links_org_status_idx
  ON public.enterprise_enrolment_links (organisation_id, status, expires_at);

CREATE TABLE IF NOT EXISTS public.enterprise_enrolment_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_link_id uuid NOT NULL REFERENCES public.enterprise_enrolment_links(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  licence_id uuid NOT NULL REFERENCES public.enterprise_licences(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.enterprise_memberships(id) ON DELETE SET NULL,
  seat_id uuid REFERENCES public.enterprise_seats(id) ON DELETE SET NULL,
  claimed_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  claim_status text NOT NULL DEFAULT 'accepted',
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_enrolment_claims_status_check CHECK (claim_status IN ('accepted','blocked','failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_enrolment_claims_user_link_idx
  ON public.enterprise_enrolment_claims (enrolment_link_id, claimed_by_user_id);

CREATE TABLE IF NOT EXISTS public.enterprise_consent_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.enterprise_memberships(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.enterprise_invitations(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version text NOT NULL DEFAULT 'phase3-2026-07',
  organisation_terms_accepted boolean NOT NULL DEFAULT false,
  reporting_consent boolean NOT NULL DEFAULT false,
  adviser_insight_consent boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  communication_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'invitation_acceptance',
  synthetic_run_marker text,
  accepted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_consent_acceptances_source_check CHECK (source IN ('invitation_acceptance','enrolment_link_claim','admin_recorded'))
);

CREATE INDEX IF NOT EXISTS enterprise_consent_acceptances_org_user_idx
  ON public.enterprise_consent_acceptances (organisation_id, user_id, accepted_at DESC);

ALTER TABLE public.enterprise_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_enrolment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_enrolment_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_consent_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active enterprise operators can read memberships" ON public.enterprise_memberships;
CREATE POLICY "active enterprise operators can read memberships"
  ON public.enterprise_memberships FOR SELECT
  TO authenticated
  USING (
    public.is_active_enterprise_operator()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "active enterprise operators can read enrolment links" ON public.enterprise_enrolment_links;
CREATE POLICY "active enterprise operators can read enrolment links"
  ON public.enterprise_enrolment_links FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "active enterprise operators can read enrolment claims" ON public.enterprise_enrolment_claims;
CREATE POLICY "active enterprise operators can read enrolment claims"
  ON public.enterprise_enrolment_claims FOR SELECT
  TO authenticated
  USING (
    public.is_active_enterprise_operator()
    OR claimed_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "enterprise users can read own consent acceptances" ON public.enterprise_consent_acceptances;
CREATE POLICY "enterprise users can read own consent acceptances"
  ON public.enterprise_consent_acceptances FOR SELECT
  TO authenticated
  USING (
    public.is_active_enterprise_operator()
    OR user_id = auth.uid()
  );
