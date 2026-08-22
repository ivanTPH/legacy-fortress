BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('privacy-data-exports', 'privacy-data-exports', false),
  ('encrypted-vault-objects', 'encrypted-vault-objects', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE TABLE IF NOT EXISTS public.vault_key_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
  key_version integer NOT NULL DEFAULT 1,
  algorithm text NOT NULL DEFAULT 'AES-256-GCM',
  wrapping_provider text NOT NULL,
  wrapping_key_reference text NOT NULL,
  wrapped_dek text NOT NULL,
  recovery_provider text,
  recovery_key_reference text,
  recovery_wrapped_dek text,
  status text NOT NULL DEFAULT 'active',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rotated_at timestamptz,
  last_recoverability_check_at timestamptz,
  recoverability_status text NOT NULL DEFAULT 'not_checked',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vault_key_envelopes_status_check CHECK (status IN ('active','rotating','rotated','disabled','destroyed')),
  CONSTRAINT vault_key_envelopes_recoverability_check CHECK (recoverability_status IN ('not_checked','valid','warning','failed')),
  CONSTRAINT vault_key_envelopes_wrapped_only CHECK (
    wrapped_dek !~* '(plaintext|cleartext|secret|master|raw_dek)'
    AND coalesce(recovery_wrapped_dek, '') !~* '(plaintext|cleartext|secret|master|raw_dek)'
    AND NOT (metadata ?| ARRAY['plaintext_key','raw_dek','master_key','cleartext_key'])
  )
);

ALTER TABLE public.vault_key_envelopes
  DROP CONSTRAINT IF EXISTS vault_key_envelopes_wrapped_only;

ALTER TABLE public.vault_key_envelopes
  ADD CONSTRAINT vault_key_envelopes_wrapped_only CHECK (
    wrapped_dek !~* '(plaintext|cleartext|secret|master|raw_dek)'
    AND coalesce(recovery_wrapped_dek, '') !~* '(plaintext|cleartext|secret|master|raw_dek)'
    AND NOT (metadata ?| ARRAY['plaintext_key','raw_dek','master_key','cleartext_key'])
  );

CREATE UNIQUE INDEX IF NOT EXISTS vault_key_envelopes_wallet_version_idx
  ON public.vault_key_envelopes (wallet_id, key_version)
  WHERE wallet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vault_key_envelopes_owner_idx
  ON public.vault_key_envelopes (owner_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vault_encrypted_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
  key_envelope_id uuid NOT NULL REFERENCES public.vault_key_envelopes(id) ON DELETE RESTRICT,
  domain text NOT NULL DEFAULT 'vault',
  record_table text,
  record_id uuid,
  field_name text NOT NULL,
  algorithm text NOT NULL DEFAULT 'AES-256-GCM',
  nonce text NOT NULL,
  auth_tag text NOT NULL,
  ciphertext text NOT NULL,
  aad_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  sensitivity text NOT NULL DEFAULT 'high',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vault_encrypted_payloads_status_check CHECK (status IN ('active','superseded','deleted')),
  CONSTRAINT vault_encrypted_payloads_domain_check CHECK (domain IN ('identity','vault','estate','privacy')),
  CONSTRAINT vault_encrypted_payloads_no_plaintext CHECK (
    ciphertext !~* '(plaintext|cleartext|raw_value|secret)'
    AND aad_context::text !~* '(plaintext|cleartext|raw_value|secret)'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS vault_encrypted_payloads_record_field_idx
  ON public.vault_encrypted_payloads (record_table, record_id, field_name)
  WHERE status = 'active' AND record_table IS NOT NULL AND record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vault_encrypted_payloads_owner_idx
  ON public.vault_encrypted_payloads (owner_user_id, wallet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.privacy_data_rights_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at timestamptz,
  identity_verification_status text NOT NULL DEFAULT 'not_required',
  assigned_admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legal_constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision text,
  outcome text,
  outcome_reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  closed_at timestamptz,
  CONSTRAINT privacy_case_type_check CHECK (request_type IN ('subject_access','rectification','erasure','restriction','portability','objection','marketing_objection','other_privacy_enquiry')),
  CONSTRAINT privacy_case_status_check CHECK (status IN ('received','identity_verification_required','validated','in_progress','awaiting_information','partially_fulfilled','fulfilled','rejected','cancelled','closed'))
);

CREATE INDEX IF NOT EXISTS privacy_cases_subject_idx
  ON public.privacy_data_rights_cases (subject_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.privacy_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.privacy_data_rights_cases(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  result text NOT NULL DEFAULT 'recorded',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.privacy_data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.privacy_data_rights_cases(id) ON DELETE SET NULL,
  subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type text NOT NULL DEFAULT 'portability',
  status text NOT NULL DEFAULT 'created',
  storage_bucket text NOT NULL DEFAULT 'privacy-data-exports',
  storage_path text NOT NULL,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT timezone('utc', now()) + interval '24 hours',
  downloaded_at timestamptz,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT privacy_exports_type_check CHECK (export_type IN ('portability','subject_access','admin_review')),
  CONSTRAINT privacy_exports_status_check CHECK (status IN ('created','released','downloaded','expired','revoked','deleted'))
);

CREATE INDEX IF NOT EXISTS privacy_exports_subject_idx
  ON public.privacy_data_exports (subject_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.retention_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  retention_basis text NOT NULL,
  retention_period text NOT NULL DEFAULT 'policy_tbd',
  trigger_event text NOT NULL DEFAULT 'policy_event',
  deletion_method text NOT NULL DEFAULT 'policy_review',
  restriction_rule text NOT NULL DEFAULT 'restrict_if_required',
  legal_hold_allowed boolean NOT NULL DEFAULT true,
  owner_visible boolean NOT NULL DEFAULT true,
  admin_visible boolean NOT NULL DEFAULT true,
  policy_version text NOT NULL DEFAULT 'phase5-2026-08',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.retention_classifications (category, retention_basis, retention_period, trigger_event, deletion_method, restriction_rule, legal_hold_allowed)
VALUES
  ('user_account','contractual_service','policy_tbd','account_closure','review_then_delete_or_restrict','restrict_if_legal_basis',true),
  ('vault_content','user_private_vault','policy_tbd','owner_erasure_or_closure','delete_or_encrypt_destroy_when_allowed','restrict_if_legal_hold',true),
  ('identity_verification_decision','fraud_security','policy_tbd','verification_expiry','retain_decision_metadata','restrict_raw_evidence',true),
  ('temporary_identity_evidence','data_minimisation','policy_tbd','verification_completion','delete_temporary_evidence','restrict_until_deleted',true),
  ('security_audit','security_integrity','policy_tbd','event_created','append_only_retain','not_user_mutable',true),
  ('estate_record','legal_estate_administration','policy_tbd','estate_closed','retain_or_restrict_by_policy','restrict_if_appropriate',true),
  ('estate_audit','legal_security_audit','policy_tbd','event_created','append_only_retain','not_user_mutable',true),
  ('contractual_record','contract','policy_tbd','contract_end','retain_by_contract_policy','restrict_if_required',true),
  ('billing_record','accounting','policy_tbd','billing_event','retain_by_finance_policy','restrict_if_required',true),
  ('consent_record','consent_evidence','policy_tbd','consent_change','append_history_retain','not_destroyed_on_withdrawal',true),
  ('marketing_preference','suppression_obligation','policy_tbd','preference_change','retain_minimal_suppression','suppression_survives_erasure',false),
  ('privacy_request','legal_privacy_operations','policy_tbd','case_closed','retain_case_outcome','restrict_if_required',true),
  ('partner_campaign_event','commercial_audit','policy_tbd','campaign_closed','aggregate_or_delete_detail','respect_suppression',true)
ON CONFLICT (category) DO UPDATE
SET retention_basis = EXCLUDED.retention_basis,
    retention_period = EXCLUDED.retention_period,
    trigger_event = EXCLUDED.trigger_event,
    deletion_method = EXCLUDED.deletion_method,
    restriction_rule = EXCLUDED.restriction_rule,
    legal_hold_allowed = EXCLUDED.legal_hold_allowed;

CREATE TABLE IF NOT EXISTS public.legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.privacy_data_rights_cases(id) ON DELETE SET NULL,
  scope_type text NOT NULL,
  scope_id text,
  reason_code text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  review_at timestamptz,
  expires_at timestamptz,
  removed_at timestamptz,
  removed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT legal_holds_status_check CHECK (status IN ('active','removed','expired')),
  CONSTRAINT legal_holds_scope_check CHECK (scope_type IN ('user','wallet','estate_case','privacy_case','organisation','campaign','record'))
);

CREATE INDEX IF NOT EXISTS legal_holds_subject_active_idx
  ON public.legal_holds (subject_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.retention_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  classification text NOT NULL REFERENCES public.retention_classifications(category),
  resource_type text NOT NULL,
  resource_id text,
  retention_state text NOT NULL DEFAULT 'active',
  eligible_at timestamptz,
  legal_hold_id uuid REFERENCES public.legal_holds(id) ON DELETE SET NULL,
  decision_reason text,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT retention_items_state_check CHECK (retention_state IN ('active','eligible_for_deletion','restricted','legal_hold','deletion_pending','deleted','retained_by_policy'))
);

CREATE INDEX IF NOT EXISTS retention_items_subject_state_idx
  ON public.retention_items (subject_user_id, retention_state, eligible_at);

CREATE TABLE IF NOT EXISTS public.privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  partner_organisation_id uuid REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'in_app',
  scope text NOT NULL DEFAULT 'global',
  status text NOT NULL,
  notice_version text NOT NULL,
  notice_reference text NOT NULL,
  source text NOT NULL DEFAULT 'contextual_notice',
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  withdrawn_at timestamptz,
  synthetic_run_marker text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT privacy_consents_status_check CHECK (status IN ('given','withdrawn','objected','not_required')),
  CONSTRAINT privacy_consents_channel_check CHECK (channel IN ('email','sms','push','in_app','phone','post','other'))
);

CREATE INDEX IF NOT EXISTS privacy_consents_user_purpose_idx
  ON public.privacy_consents (user_id, purpose, channel, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.marketing_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_organisation_id uuid REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'all',
  suppression_type text NOT NULL DEFAULT 'global_objection',
  status text NOT NULL DEFAULT 'active',
  reason text NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  revoked_at timestamptz,
  CONSTRAINT marketing_suppressions_status_check CHECK (status IN ('active','revoked')),
  CONSTRAINT marketing_suppressions_channel_check CHECK (channel IN ('all','email','sms','push','in_app','phone','post','other')),
  CONSTRAINT marketing_suppressions_type_check CHECK (suppression_type IN ('global_objection','partner_opt_out','channel_opt_out','campaign_suppression','frequency_cap','cooling_off'))
);

CREATE INDEX IF NOT EXISTS marketing_suppressions_user_active_idx
  ON public.marketing_suppressions (user_id, partner_organisation_id, channel, status);

CREATE TABLE IF NOT EXISTS public.partner_cohort_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  cohort_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_filter_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  prohibited_filter_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  analytical_eligible_count integer,
  marketing_eligible_count integer,
  minimum_cohort integer NOT NULL DEFAULT 5,
  threshold_result text NOT NULL DEFAULT 'not_evaluated',
  policy_result text NOT NULL DEFAULT 'blocked',
  evaluated_at timestamptz,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT partner_cohort_status_check CHECK (status IN ('submitted','validated','rejected','evaluated','cancelled','expired')),
  CONSTRAINT partner_cohort_result_check CHECK (threshold_result IN ('not_evaluated','passed','blocked') AND policy_result IN ('allowed','blocked')),
  CONSTRAINT partner_cohort_no_sensitive_filters CHECK (cohort_definition::text !~* '(asset_value|beneficiar|will_content|vault_content|document_text|medical|death_certificate|identity_evidence|document_number)')
);

CREATE INDEX IF NOT EXISTS partner_cohort_requests_org_idx
  ON public.partner_cohort_requests (organisation_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.partner_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  cohort_request_id uuid REFERENCES public.partner_cohort_requests(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  purpose text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'draft',
  aggregate_only boolean NOT NULL DEFAULT true,
  raw_audience_export_allowed boolean NOT NULL DEFAULT false,
  sent_count integer NOT NULL DEFAULT 0,
  suppressed_count integer NOT NULL DEFAULT 0,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT partner_campaigns_status_check CHECK (status IN ('draft','approved','sending','sent','paused','cancelled','closed')),
  CONSTRAINT partner_campaigns_channel_check CHECK (channel IN ('email','sms','push','in_app','post','other')),
  CONSTRAINT partner_campaigns_aggregate_boundary CHECK (aggregate_only = true AND raw_audience_export_allowed = false)
);

CREATE TABLE IF NOT EXISTS public.partner_campaign_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.partner_campaigns(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  opaque_subject_ref text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  analytical_eligible boolean NOT NULL DEFAULT false,
  marketing_eligible boolean NOT NULL DEFAULT false,
  suppression_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_status text NOT NULL DEFAULT 'not_sent',
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT partner_campaign_audiences_status_check CHECK (delivery_status IN ('not_sent','suppressed','queued','sent','delivered','opened','clicked','converted','failed')),
  CONSTRAINT partner_campaign_audiences_opaque_check CHECK (opaque_subject_ref !~* '@')
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_campaign_audience_ref_idx
  ON public.partner_campaign_audiences (campaign_id, opaque_subject_ref);

CREATE OR REPLACE FUNCTION public.is_active_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users admin_user
    WHERE admin_user.user_id = auth.uid()
      AND admin_user.status = 'active'
  );
$$;

CREATE TABLE IF NOT EXISTS public.partner_aggregate_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.enterprise_organisations(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.partner_campaigns(id) ON DELETE SET NULL,
  report_type text NOT NULL DEFAULT 'campaign_summary',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  minimum_cohort integer NOT NULL DEFAULT 5,
  threshold_result text NOT NULL DEFAULT 'not_evaluated',
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT partner_aggregate_reports_threshold_check CHECK (threshold_result IN ('not_evaluated','passed','blocked'))
);

CREATE TABLE IF NOT EXISTS public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_reference text NOT NULL UNIQUE DEFAULT ('INC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  detected_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  affected_domain text NOT NULL,
  affected_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity text NOT NULL DEFAULT 'medium',
  containment_state text NOT NULL DEFAULT 'open',
  notification_decision text NOT NULL DEFAULT 'under_review',
  investigation_notes text,
  closed_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  synthetic_run_marker text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT security_incidents_domain_check CHECK (affected_domain IN ('identity','vault','estate','privacy','partner','enterprise','platform')),
  CONSTRAINT security_incidents_severity_check CHECK (severity IN ('low','medium','high','critical')),
  CONSTRAINT security_incidents_state_check CHECK (containment_state IN ('open','triage','contained','notification_review','closed'))
);

CREATE OR REPLACE FUNCTION public.lf_partner_campaign_user_marketing_eligible(
  p_user_id uuid,
  p_organisation_id uuid,
  p_channel text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.marketing_suppressions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND (s.partner_organisation_id IS NULL OR s.partner_organisation_id = p_organisation_id)
      AND (s.channel = 'all' OR s.channel = p_channel)
  )
  AND EXISTS (
    SELECT 1
    FROM public.privacy_consents c
    WHERE c.user_id = p_user_id
      AND c.status = 'given'
      AND c.purpose IN ('marketing','partner_campaign')
      AND (c.partner_organisation_id IS NULL OR c.partner_organisation_id = p_organisation_id)
      AND (c.channel = p_channel OR c.channel = 'in_app')
  );
$$;

CREATE OR REPLACE FUNCTION public.lf_validate_partner_cohort_definition(p_definition jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_definition::text, '') !~* '(asset_value|beneficiar|will_content|vault_content|document_text|medical|death_certificate|identity_evidence|document_number|raw_sql|select | from )';
$$;

CREATE OR REPLACE FUNCTION public.lf_privacy_export_is_downloadable(p_export_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.privacy_data_exports e
    WHERE e.id = p_export_id
      AND e.subject_user_id = auth.uid()
      AND e.status IN ('created','released')
      AND e.expires_at > timezone('utc', now())
  );
$$;

CREATE OR REPLACE FUNCTION public.lf_retention_item_effective_state(p_item_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.retention_items i
      JOIN public.legal_holds h ON h.id = i.legal_hold_id OR (h.subject_user_id = i.subject_user_id AND h.status = 'active')
      WHERE i.id = p_item_id AND h.status = 'active'
    ) THEN 'legal_hold'
    ELSE coalesce((SELECT retention_state FROM public.retention_items WHERE id = p_item_id), 'active')
  END;
$$;

CREATE OR REPLACE FUNCTION public.lf_recovery_access_quorum_met(p_request_id uuid, p_required_approvals integer DEFAULT 2)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT count(DISTINCT approval.approver_user_id)
    FROM public.recovery_approval_events approval
    JOIN public.recovery_access_requests request ON request.id = approval.recovery_access_request_id
    WHERE approval.recovery_access_request_id = p_request_id
      AND approval.decision = 'approved'
      AND approval.approver_user_id <> request.requested_by_user_id
  ) >= greatest(1, p_required_approvals);
$$;

CREATE OR REPLACE FUNCTION public.lf_reject_recovery_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
BEGIN
  SELECT requested_by_user_id INTO v_requester
  FROM public.recovery_access_requests
  WHERE id = NEW.recovery_access_request_id;

  IF v_requester IS NOT NULL AND NEW.approver_user_id = v_requester THEN
    RAISE EXCEPTION 'recovery requester cannot self-approve';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recovery_access_no_self_approval ON public.recovery_approval_events;
CREATE TRIGGER recovery_access_no_self_approval
  BEFORE INSERT ON public.recovery_approval_events
  FOR EACH ROW EXECUTE FUNCTION public.lf_reject_recovery_self_approval();

ALTER TABLE public.vault_key_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_encrypted_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_data_rights_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_cohort_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_campaign_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_aggregate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vault_key_envelopes_owner_metadata_select ON public.vault_key_envelopes;
CREATE POLICY vault_key_envelopes_owner_metadata_select ON public.vault_key_envelopes
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS vault_encrypted_payloads_owner_select ON public.vault_encrypted_payloads;
CREATE POLICY vault_encrypted_payloads_owner_select ON public.vault_encrypted_payloads
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS privacy_cases_subject_or_requester_select ON public.privacy_data_rights_cases;
CREATE POLICY privacy_cases_subject_or_requester_select ON public.privacy_data_rights_cases
  FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR subject_user_id = auth.uid() OR public.is_active_admin_user());

DROP POLICY IF EXISTS privacy_cases_user_insert_own ON public.privacy_data_rights_cases;
CREATE POLICY privacy_cases_user_insert_own ON public.privacy_data_rights_cases
  FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid() AND subject_user_id = auth.uid());

DROP POLICY IF EXISTS privacy_case_events_case_participant_select ON public.privacy_case_events;
CREATE POLICY privacy_case_events_case_participant_select ON public.privacy_case_events
  FOR SELECT TO authenticated
  USING (
    public.is_active_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.privacy_data_rights_cases c
      WHERE c.id = privacy_case_events.case_id
        AND (c.requester_user_id = auth.uid() OR c.subject_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS privacy_exports_subject_select ON public.privacy_data_exports;
CREATE POLICY privacy_exports_subject_select ON public.privacy_data_exports
  FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid() OR public.is_active_admin_user());

DROP POLICY IF EXISTS retention_classifications_read ON public.retention_classifications;
CREATE POLICY retention_classifications_read ON public.retention_classifications
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS legal_holds_subject_or_admin_select ON public.legal_holds;
CREATE POLICY legal_holds_subject_or_admin_select ON public.legal_holds
  FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid() OR public.is_active_admin_user());

DROP POLICY IF EXISTS retention_items_subject_or_admin_select ON public.retention_items;
CREATE POLICY retention_items_subject_or_admin_select ON public.retention_items
  FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid() OR public.is_active_admin_user());

DROP POLICY IF EXISTS privacy_consents_user_select ON public.privacy_consents;
CREATE POLICY privacy_consents_user_select ON public.privacy_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_active_admin_user());

DROP POLICY IF EXISTS privacy_consents_user_insert ON public.privacy_consents;
CREATE POLICY privacy_consents_user_insert ON public.privacy_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS marketing_suppressions_user_select ON public.marketing_suppressions;
CREATE POLICY marketing_suppressions_user_select ON public.marketing_suppressions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_active_admin_user());

DROP POLICY IF EXISTS marketing_suppressions_user_insert ON public.marketing_suppressions;
CREATE POLICY marketing_suppressions_user_insert ON public.marketing_suppressions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'active');

DROP POLICY IF EXISTS partner_cohorts_enterprise_scope_select ON public.partner_cohort_requests;
CREATE POLICY partner_cohorts_enterprise_scope_select ON public.partner_cohort_requests
  FOR SELECT TO authenticated
  USING (
    public.is_active_enterprise_operator()
    OR EXISTS (
      SELECT 1 FROM public.enterprise_memberships m
      WHERE m.organisation_id = partner_cohort_requests.organisation_id
        AND m.user_id = auth.uid()
        AND m.membership_status = 'active'
        AND m.organisation_role IN ('organisation_admin','organisation_reporting_viewer','organisation_auditor','reporting_viewer','read_only_auditor')
    )
  );

DROP POLICY IF EXISTS partner_campaigns_enterprise_scope_select ON public.partner_campaigns;
CREATE POLICY partner_campaigns_enterprise_scope_select ON public.partner_campaigns
  FOR SELECT TO authenticated
  USING (
    public.is_active_enterprise_operator()
    OR EXISTS (
      SELECT 1 FROM public.enterprise_memberships m
      WHERE m.organisation_id = partner_campaigns.organisation_id
        AND m.user_id = auth.uid()
        AND m.membership_status = 'active'
        AND m.organisation_role IN ('organisation_admin','organisation_reporting_viewer','organisation_auditor','reporting_viewer','read_only_auditor')
    )
  );

DROP POLICY IF EXISTS partner_audience_system_only_select ON public.partner_campaign_audiences;
CREATE POLICY partner_audience_system_only_select ON public.partner_campaign_audiences
  FOR SELECT TO authenticated
  USING (public.is_active_admin_user());

DROP POLICY IF EXISTS partner_reports_enterprise_scope_select ON public.partner_aggregate_reports;
CREATE POLICY partner_reports_enterprise_scope_select ON public.partner_aggregate_reports
  FOR SELECT TO authenticated
  USING (
    public.is_active_enterprise_operator()
    OR EXISTS (
      SELECT 1 FROM public.enterprise_memberships m
      WHERE m.organisation_id = partner_aggregate_reports.organisation_id
        AND m.user_id = auth.uid()
        AND m.membership_status = 'active'
        AND m.organisation_role IN ('organisation_admin','organisation_reporting_viewer','organisation_auditor','reporting_viewer','read_only_auditor')
    )
  );

DROP POLICY IF EXISTS security_incidents_admin_only_select ON public.security_incidents;
CREATE POLICY security_incidents_admin_only_select ON public.security_incidents
  FOR SELECT TO authenticated
  USING (public.is_active_admin_user());

DROP POLICY IF EXISTS privacy_exports_storage_owner_select ON storage.objects;
CREATE POLICY privacy_exports_storage_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'privacy-data-exports'
    AND EXISTS (
      SELECT 1
      FROM public.privacy_data_exports e
      WHERE e.storage_bucket = storage.objects.bucket_id
        AND e.storage_path = storage.objects.name
        AND public.lf_privacy_export_is_downloadable(e.id)
    )
  );

DROP POLICY IF EXISTS privacy_exports_storage_owner_insert ON storage.objects;
CREATE POLICY privacy_exports_storage_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'privacy-data-exports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

REVOKE ALL ON FUNCTION public.lf_partner_campaign_user_marketing_eligible(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.lf_privacy_export_is_downloadable(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.lf_retention_item_effective_state(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.lf_recovery_access_quorum_met(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.lf_reject_recovery_self_approval() FROM anon;
REVOKE ALL ON FUNCTION public.is_active_admin_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_partner_campaign_user_marketing_eligible(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_privacy_export_is_downloadable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_retention_item_effective_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_recovery_access_quorum_met(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_validate_partner_cohort_definition(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin_user() TO authenticated;

COMMIT;
