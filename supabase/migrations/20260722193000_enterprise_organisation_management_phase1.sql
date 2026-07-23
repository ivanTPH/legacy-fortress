ALTER TABLE public.enterprise_organisations
  ADD COLUMN IF NOT EXISTS primary_contact_telephone text,
  ADD COLUMN IF NOT EXISTS same_operating_address boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_reference text,
  ADD COLUMN IF NOT EXISTS customer_reference text,
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS onboarding_notes text,
  ADD COLUMN IF NOT EXISTS nominated_admin_name text,
  ADD COLUMN IF NOT EXISTS nominated_admin_email text,
  ADD COLUMN IF NOT EXISTS nominated_admin_require_mfa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nominated_admin_expiry_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.enterprise_organisations
  DROP CONSTRAINT IF EXISTS enterprise_organisations_status_check,
  ADD CONSTRAINT enterprise_organisations_status_check
  CHECK (status IN ('draft','pending_setup','pending_administrator_acceptance','active','suspended','expiring','cancelled','archived'));

ALTER TABLE public.enterprise_organisations
  DROP CONSTRAINT IF EXISTS enterprise_organisations_risk_check,
  ADD CONSTRAINT enterprise_organisations_risk_check
  CHECK (risk_status IN ('normal','watch','at_risk','critical','restricted'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enterprise_organisations_onboarding_status_check'
  ) THEN
    ALTER TABLE public.enterprise_organisations
      ADD CONSTRAINT enterprise_organisations_onboarding_status_check
      CHECK (onboarding_status IN ('not_started','pending','in_progress','blocked','complete'));
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_organisations_registration_unique_idx
  ON public.enterprise_organisations (lower(registration_number))
  WHERE registration_number IS NOT NULL AND btrim(registration_number) <> '';

CREATE INDEX IF NOT EXISTS enterprise_organisations_search_idx
  ON public.enterprise_organisations (lower(legal_name), lower(coalesce(trading_name, '')), lower(coalesce(primary_contact_email, '')));

CREATE INDEX IF NOT EXISTS enterprise_organisations_owner_status_idx
  ON public.enterprise_organisations (lower(coalesce(internal_account_owner, '')), status, updated_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_enterprise_org_idx
  ON public.audit_events (resource_type, resource_id, created_at DESC)
  WHERE resource_type = 'organisation';
