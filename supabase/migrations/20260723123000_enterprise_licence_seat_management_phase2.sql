ALTER TABLE public.enterprise_licences
  ADD COLUMN IF NOT EXISTS custom_plan_name text,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS renewal_notice_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_notes text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

ALTER TABLE public.enterprise_licences
  DROP CONSTRAINT IF EXISTS enterprise_licences_status_check,
  ADD CONSTRAINT enterprise_licences_status_check
  CHECK (licence_status IN ('draft','pending_approval','active','expiring','suspended','cancelled','expired'));

ALTER TABLE public.enterprise_licences
  DROP CONSTRAINT IF EXISTS enterprise_licences_billing_status_check,
  ADD CONSTRAINT enterprise_licences_billing_status_check
  CHECK (billing_status IN ('not_configured','trial','active','past_due','suspended','cancelled','pending','current','overdue','manual_review'));

ALTER TABLE public.enterprise_licences
  DROP CONSTRAINT IF EXISTS enterprise_licences_plan_check,
  ADD CONSTRAINT enterprise_licences_plan_check
  CHECK (licence_plan IN ('starter','professional','enterprise','custom'));

ALTER TABLE public.enterprise_licences
  DROP CONSTRAINT IF EXISTS enterprise_licences_custom_plan_check,
  ADD CONSTRAINT enterprise_licences_custom_plan_check
  CHECK (licence_plan <> 'custom' OR NULLIF(btrim(custom_plan_name), '') IS NOT NULL);

ALTER TABLE public.enterprise_licences
  DROP CONSTRAINT IF EXISTS enterprise_licences_dates_check,
  ADD CONSTRAINT enterprise_licences_dates_check
  CHECK (renewal_date >= start_date AND (end_date IS NULL OR end_date >= start_date));

ALTER TABLE public.enterprise_licences
  DROP CONSTRAINT IF EXISTS enterprise_licences_notice_check,
  ADD CONSTRAINT enterprise_licences_notice_check
  CHECK (renewal_notice_days BETWEEN 1 AND 365);

CREATE TABLE IF NOT EXISTS public.enterprise_licence_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  licence_id uuid NOT NULL REFERENCES public.enterprise_licences(id) ON DELETE CASCADE,
  previous_renewal_date date NOT NULL,
  new_renewal_date date NOT NULL,
  previous_purchased_seats integer NOT NULL,
  new_purchased_seats integer NOT NULL,
  previous_plan text NOT NULL,
  new_plan text NOT NULL,
  contract_reference text,
  billing_reference text,
  notes text,
  synthetic_run_marker text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_licence_renewals_seats_check CHECK (new_purchased_seats >= 0),
  CONSTRAINT enterprise_licence_renewals_dates_check CHECK (new_renewal_date >= previous_renewal_date)
);

ALTER TABLE public.enterprise_licence_renewals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active enterprise operators can read licence renewals" ON public.enterprise_licence_renewals;
CREATE POLICY "active enterprise operators can read licence renewals"
  ON public.enterprise_licence_renewals FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

CREATE INDEX IF NOT EXISTS enterprise_licences_renewal_idx
  ON public.enterprise_licences (renewal_date, licence_status);

CREATE INDEX IF NOT EXISTS enterprise_licences_plan_status_idx
  ON public.enterprise_licences (licence_plan, licence_status);

CREATE INDEX IF NOT EXISTS enterprise_licence_renewals_licence_idx
  ON public.enterprise_licence_renewals (licence_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_enterprise_licence_idx
  ON public.audit_events (resource_type, resource_id, created_at DESC)
  WHERE resource_type = 'licence';
