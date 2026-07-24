ALTER TABLE public.enterprise_saved_views
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS visible_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_scope text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS synthetic_run_marker text;

ALTER TABLE public.enterprise_saved_views
  DROP CONSTRAINT IF EXISTS enterprise_saved_views_type_check,
  ADD CONSTRAINT enterprise_saved_views_type_check
  CHECK (view_type IN ('portfolio','overview','organisations','licences','users','invitations','adoption','reports','consent','renewals','settings'));

ALTER TABLE public.enterprise_saved_views
  DROP CONSTRAINT IF EXISTS enterprise_saved_views_share_scope_check,
  ADD CONSTRAINT enterprise_saved_views_share_scope_check
  CHECK (share_scope IN ('private','organisation','platform'));

CREATE INDEX IF NOT EXISTS enterprise_saved_views_scope_idx
  ON public.enterprise_saved_views (share_scope, organisation_id, view_type, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_saved_views_default_owner_idx
  ON public.enterprise_saved_views (owner_user_id, view_type)
  WHERE is_default = true AND share_scope = 'private';

CREATE TABLE IF NOT EXISTS public.enterprise_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  organisation_id uuid REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  licence_id uuid REFERENCES public.enterprise_licences(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_scope text NOT NULL DEFAULT 'enterprise',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  cohort_count integer NOT NULL DEFAULT 0,
  minimum_cohort integer NOT NULL DEFAULT 5,
  consent_result text NOT NULL DEFAULT 'not_evaluated',
  threshold_result text NOT NULL DEFAULT 'not_evaluated',
  policy_result text NOT NULL DEFAULT 'blocked',
  suppression_applied boolean NOT NULL DEFAULT true,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_report_runs_type_check CHECK (report_type IN ('portfolio','licence_utilisation','seat_availability','invitation_status','membership_status','onboarding_completion','adoption_bands','renewal_pipeline','organisation_risk','consent_readiness','consent_restrictions','enrolment_link_usage','audit_activity')),
  CONSTRAINT enterprise_report_runs_result_check CHECK (consent_result IN ('passed','blocked','not_evaluated') AND threshold_result IN ('passed','blocked','not_evaluated') AND policy_result IN ('allowed','blocked'))
);

CREATE INDEX IF NOT EXISTS enterprise_report_runs_scope_idx
  ON public.enterprise_report_runs (organisation_id, report_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.enterprise_export_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid REFERENCES public.enterprise_report_runs(id) ON DELETE SET NULL,
  report_type text NOT NULL,
  organisation_id uuid REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  export_format text NOT NULL DEFAULT 'csv',
  safe_filename text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  aggregate_count integer NOT NULL DEFAULT 0,
  policy_result text NOT NULL DEFAULT 'blocked',
  consent_result text NOT NULL DEFAULT 'not_evaluated',
  threshold_result text NOT NULL DEFAULT 'not_evaluated',
  storage_path text,
  expires_at timestamptz,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_export_events_format_check CHECK (export_format IN ('csv')),
  CONSTRAINT enterprise_export_events_result_check CHECK (policy_result IN ('allowed','blocked') AND consent_result IN ('passed','blocked','not_evaluated') AND threshold_result IN ('passed','blocked','not_evaluated'))
);

CREATE INDEX IF NOT EXISTS enterprise_export_events_scope_idx
  ON public.enterprise_export_events (organisation_id, report_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.enterprise_risk_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  risk_status text NOT NULL,
  reason text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT enterprise_risk_overrides_status_check CHECK (risk_status IN ('normal','watch','at_risk','critical','restricted'))
);

CREATE INDEX IF NOT EXISTS enterprise_risk_overrides_org_idx
  ON public.enterprise_risk_overrides (organisation_id, created_at DESC);

ALTER TABLE public.enterprise_report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_export_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_risk_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active enterprise operators can read report runs" ON public.enterprise_report_runs;
CREATE POLICY "active enterprise operators can read report runs"
  ON public.enterprise_report_runs FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "active enterprise operators can read export events" ON public.enterprise_export_events;
CREATE POLICY "active enterprise operators can read export events"
  ON public.enterprise_export_events FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "active enterprise operators can read risk overrides" ON public.enterprise_risk_overrides;
CREATE POLICY "active enterprise operators can read risk overrides"
  ON public.enterprise_risk_overrides FOR SELECT
  TO authenticated
  USING (public.is_active_enterprise_operator());

DROP POLICY IF EXISTS "saved views are owner or organisation scoped" ON public.enterprise_saved_views;
CREATE POLICY "saved views are owner or organisation scoped"
  ON public.enterprise_saved_views FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.is_active_enterprise_operator()
  );
