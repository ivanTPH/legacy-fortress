CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL,
  full_name text,
  role_template text NOT NULL,
  scope_type text NOT NULL DEFAULT 'platform',
  organisation_id uuid,
  status text NOT NULL DEFAULT 'draft',
  require_mfa boolean NOT NULL DEFAULT true,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  access_expires_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT admin_invitations_status_check CHECK (status IN ('draft','pending','sent','delivered','accepted','expired','revoked','failed')),
  CONSTRAINT admin_invitations_role_template_check CHECK (role_template IN ('super_admin','support_agent','probate_reviewer','auditor','enterprise_admin','read_only_operations')),
  CONSTRAINT admin_invitations_scope_type_check CHECK (scope_type IN ('platform','organisation','support_only','probate_only','read_only','time_limited'))
);

CREATE INDEX IF NOT EXISTS admin_invitations_email_status_idx
  ON public.admin_invitations (email_normalized, status);

CREATE INDEX IF NOT EXISTS admin_invitations_created_idx
  ON public.admin_invitations (created_at DESC);

CREATE TABLE IF NOT EXISTS public.enterprise_organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trading_name text,
  organisation_type text NOT NULL,
  organisation_type_other text,
  registration_number text,
  country text NOT NULL DEFAULT 'GB',
  registered_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  operating_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  primary_contact_name text,
  primary_contact_email text,
  website text,
  internal_account_owner text,
  status text NOT NULL DEFAULT 'draft',
  risk_status text NOT NULL DEFAULT 'normal',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_organisations_type_check CHECK (organisation_type IN ('employer','law_firm','wealth_manager','insurer','funeral_provider','employee_benefit_provider','enterprise_reseller','other')),
  CONSTRAINT enterprise_organisations_status_check CHECK (status IN ('draft','pending_setup','pending_administrator_acceptance','active','suspended','expiring','cancelled')),
  CONSTRAINT enterprise_organisations_risk_check CHECK (risk_status IN ('normal','watch','at_risk','restricted'))
);

CREATE INDEX IF NOT EXISTS enterprise_organisations_status_idx
  ON public.enterprise_organisations (status, created_at DESC);

CREATE INDEX IF NOT EXISTS enterprise_organisations_type_idx
  ON public.enterprise_organisations (organisation_type);

CREATE TABLE IF NOT EXISTS public.enterprise_licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  licence_plan text NOT NULL,
  contract_reference text,
  billing_reference text,
  start_date date NOT NULL,
  renewal_date date NOT NULL,
  purchased_seats integer NOT NULL DEFAULT 0,
  allocated_seats integer NOT NULL DEFAULT 0,
  active_seats integer NOT NULL DEFAULT 0,
  invited_seats integer NOT NULL DEFAULT 0,
  suspended_seats integer NOT NULL DEFAULT 0,
  billing_status text NOT NULL DEFAULT 'pending',
  licence_status text NOT NULL DEFAULT 'draft',
  account_owner text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_licences_status_check CHECK (licence_status IN ('draft','pending_approval','active','expiring','suspended','cancelled')),
  CONSTRAINT enterprise_licences_billing_status_check CHECK (billing_status IN ('pending','current','overdue','manual_review','cancelled')),
  CONSTRAINT enterprise_licences_seat_nonnegative_check CHECK (
    purchased_seats >= 0 AND allocated_seats >= 0 AND active_seats >= 0 AND invited_seats >= 0 AND suspended_seats >= 0
  ),
  CONSTRAINT enterprise_licences_seat_entitlement_check CHECK (allocated_seats <= purchased_seats)
);

CREATE INDEX IF NOT EXISTS enterprise_licences_org_idx
  ON public.enterprise_licences (organisation_id, licence_status);

CREATE TABLE IF NOT EXISTS public.enterprise_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  licence_id uuid NOT NULL REFERENCES public.enterprise_licences(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invitee_email_normalized text,
  seat_status text NOT NULL DEFAULT 'invited',
  assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  activated_at timestamptz,
  suspended_at timestamptz,
  released_at timestamptz,
  CONSTRAINT enterprise_seats_status_check CHECK (seat_status IN ('invited','active','suspended','removed','unclaimed'))
);

CREATE INDEX IF NOT EXISTS enterprise_seats_org_status_idx
  ON public.enterprise_seats (organisation_id, seat_status);

CREATE TABLE IF NOT EXISTS public.enterprise_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  licence_id uuid REFERENCES public.enterprise_licences(id) ON DELETE SET NULL,
  email_normalized text NOT NULL,
  full_name text,
  invitation_type text NOT NULL DEFAULT 'enterprise_user',
  role_template text NOT NULL DEFAULT 'enterprise_user',
  status text NOT NULL DEFAULT 'draft',
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  require_mfa boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  failure_reason text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_invitations_type_check CHECK (invitation_type IN ('organisation_admin','enterprise_user')),
  CONSTRAINT enterprise_invitations_status_check CHECK (status IN ('draft','scheduled','sent','delivered','accepted','expired','revoked','failed'))
);

CREATE INDEX IF NOT EXISTS enterprise_invitations_org_status_idx
  ON public.enterprise_invitations (organisation_id, status);

CREATE TABLE IF NOT EXISTS public.enterprise_consent_settings (
  organisation_id uuid PRIMARY KEY REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  adviser_insight_consent boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  reporting_consent boolean NOT NULL DEFAULT true,
  export_permission boolean NOT NULL DEFAULT false,
  minimum_reporting_cohort integer NOT NULL DEFAULT 10,
  retention_rule text NOT NULL DEFAULT 'standard',
  updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_consent_minimum_cohort_check CHECK (minimum_reporting_cohort >= 5)
);

CREATE TABLE IF NOT EXISTS public.enterprise_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  view_type text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_saved_views_type_check CHECK (view_type IN ('portfolio','organisations','licences','invitations','adoption','reports','renewals'))
);

CREATE INDEX IF NOT EXISTS enterprise_saved_views_owner_idx
  ON public.enterprise_saved_views (owner_user_id, view_type);

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_consent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_saved_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_enterprise_operator(required_roles text[] DEFAULT ARRAY['super_admin','enterprise_admin'])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.status = 'active'
      AND (au.is_master = true OR au.role = ANY(required_roles))
  );
$$;

DROP POLICY IF EXISTS "active admin operators can read admin invitations" ON public.admin_invitations;
CREATE POLICY "active admin operators can read admin invitations"
  ON public.admin_invitations FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator(ARRAY['super_admin']));

DROP POLICY IF EXISTS "active enterprise operators can read organisations" ON public.enterprise_organisations;
CREATE POLICY "active enterprise operators can read organisations"
  ON public.enterprise_organisations FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "active enterprise operators can read licences" ON public.enterprise_licences;
CREATE POLICY "active enterprise operators can read licences"
  ON public.enterprise_licences FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "active enterprise operators can read seats" ON public.enterprise_seats;
CREATE POLICY "active enterprise operators can read seats"
  ON public.enterprise_seats FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "active enterprise operators can read invitations" ON public.enterprise_invitations;
CREATE POLICY "active enterprise operators can read invitations"
  ON public.enterprise_invitations FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "active enterprise operators can read consent" ON public.enterprise_consent_settings;
CREATE POLICY "active enterprise operators can read consent"
  ON public.enterprise_consent_settings FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "saved views are owner scoped" ON public.enterprise_saved_views;
CREATE POLICY "saved views are owner scoped"
  ON public.enterprise_saved_views FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());
