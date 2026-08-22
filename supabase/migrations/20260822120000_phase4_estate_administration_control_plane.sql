-- Phase 4: estate administration workspace, explicit estate permissions,
-- sensitive-action dual control, and recovery-control metadata.
-- Additive. Historic deceased vault data remains immutable and ordinary linked
-- access remains governed by the Phase 1/3 live vault-state gates.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.estate_security_actions
  DROP CONSTRAINT IF EXISTS estate_security_actions_type_check;
ALTER TABLE public.estate_security_actions
  ADD CONSTRAINT estate_security_actions_type_check CHECK (action_type IN (
    'death_report_started',
    'death_report_submitted',
    'death_evidence_uploaded',
    'death_report_reviewed',
    'death_report_rejected',
    'death_confirmed',
    'protective_lock_applied',
    'estate_lock_applied',
    'death_status_disputed',
    'owner_recovery_started',
    'owner_recovery_verified',
    'owner_recovery_approved',
    'owner_active_restored',
    'estate_claim_submitted',
    'estate_claim_identity_verified',
    'estate_authority_submitted',
    'estate_claim_approved',
    'estate_claim_rejected',
    'estate_access_suspended',
    'estate_access_revoked',
    'estate_document_added',
    'estate_case_opened',
    'estate_case_closed',
    'estate_case_reopened',
    'estate_permission_granted',
    'estate_permission_changed',
    'estate_task_changed',
    'estate_valuation_added',
    'estate_liability_added',
    'estate_distribution_recorded',
    'sensitive_action_requested',
    'sensitive_action_approved',
    'sensitive_action_rejected',
    'sensitive_action_executed',
    'estate_downloads_frozen',
    'estate_contributions_frozen',
    'estate_reverification_required',
    'estate_recovery_requested',
    'estate_recovery_approved',
    'estate_recovery_executed',
    'estate_security_action'
  ));

ALTER TABLE public.death_report_events
  DROP CONSTRAINT IF EXISTS death_report_events_type_check;
ALTER TABLE public.death_report_events
  ADD CONSTRAINT death_report_events_type_check CHECK (event_type IN (
    'death_report_started',
    'death_report_submitted',
    'death_evidence_uploaded',
    'death_report_reviewed',
    'death_report_rejected',
    'death_confirmed',
    'protective_lock_applied',
    'estate_lock_applied',
    'death_status_disputed',
    'owner_recovery_started',
    'owner_recovery_verified',
    'owner_recovery_approved',
    'owner_active_restored',
    'estate_claim_submitted',
    'estate_claim_identity_verified',
    'estate_authority_submitted',
    'estate_claim_approved',
    'estate_claim_rejected',
    'estate_access_suspended',
    'estate_access_revoked',
    'estate_document_added',
    'estate_case_opened',
    'estate_case_closed',
    'estate_case_reopened',
    'estate_permission_granted',
    'estate_permission_changed',
    'estate_task_changed',
    'estate_valuation_added',
    'estate_liability_added',
    'estate_distribution_recorded',
    'sensitive_action_requested',
    'sensitive_action_approved',
    'sensitive_action_rejected',
    'sensitive_action_executed',
    'estate_downloads_frozen',
    'estate_contributions_frozen',
    'estate_reverification_required',
    'estate_recovery_requested',
    'estate_recovery_approved',
    'estate_recovery_executed',
    'estate_security_action'
  ));

CREATE TABLE IF NOT EXISTS public.estate_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  death_report_id uuid REFERENCES public.death_reports(id) ON DELETE SET NULL,
  probate_case_id uuid REFERENCES public.probate_cases(id) ON DELETE SET NULL,
  case_reference text NOT NULL DEFAULT ('EST-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  status text NOT NULL DEFAULT 'open',
  vault_state_at_open text NOT NULL DEFAULT 'ESTATE_LOCKED',
  opened_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  closed_at timestamptz,
  closure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_cases_status_check CHECK (status IN ('open','awaiting_authority','authority_under_review','administration_active','distribution_pending','completion_review','closed','suspended','disputed')),
  CONSTRAINT estate_cases_vault_state_check CHECK (vault_state_at_open IN ('DEATH_REPORTED','PROTECTIVE_LOCK','ESTATE_LOCKED','DEATH_STATUS_DISPUTED','OWNER_RECOVERY'))
);

CREATE UNIQUE INDEX IF NOT EXISTS estate_cases_reference_uidx ON public.estate_cases (case_reference);
CREATE INDEX IF NOT EXISTS estate_cases_owner_status_idx ON public.estate_cases (owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS estate_cases_death_report_idx ON public.estate_cases (death_report_id);

ALTER TABLE public.estate_administration_documents
  ADD COLUMN IF NOT EXISTS estate_case_id uuid REFERENCES public.estate_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_category text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'submitted';

CREATE INDEX IF NOT EXISTS estate_admin_documents_case_idx
  ON public.estate_administration_documents (estate_case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.estate_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_case_id uuid NOT NULL REFERENCES public.estate_cases(id) ON DELETE CASCADE,
  estate_claim_id uuid REFERENCES public.estate_access_claims(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_role text NOT NULL,
  person_type text NOT NULL DEFAULT 'individual',
  status text NOT NULL DEFAULT 'active',
  required_identity_level integer NOT NULL DEFAULT 2,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  suspended_at timestamptz,
  revoked_at timestamptz,
  decision_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_participants_role_check CHECK (participant_role IN ('executor','administrator','co_executor','solicitor','accountant','tax_adviser','valuer','trustee','beneficiary','authorised_representative','other')),
  CONSTRAINT estate_participants_status_check CHECK (status IN ('invited','identity_required','authority_required','active','suspended','revoked','rejected')),
  CONSTRAINT estate_participants_identity_level_check CHECK (required_identity_level IN (2, 3))
);

CREATE UNIQUE INDEX IF NOT EXISTS estate_participants_case_user_role_uidx
  ON public.estate_participants (estate_case_id, user_id, participant_role)
  WHERE status <> 'revoked';
CREATE INDEX IF NOT EXISTS estate_participants_user_status_idx
  ON public.estate_participants (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.estate_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_case_id uuid NOT NULL REFERENCES public.estate_cases(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  responsible_participant_id uuid REFERENCES public.estate_participants(id) ON DELETE SET NULL,
  due_date date,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'not_started',
  related_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  related_document_id uuid REFERENCES public.estate_administration_documents(id) ON DELETE SET NULL,
  completion_notes text,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_tasks_status_check CHECK (status IN ('not_started','in_progress','waiting_external','blocked','completed','cancelled')),
  CONSTRAINT estate_tasks_priority_check CHECK (priority IN ('low','normal','high','urgent'))
);

CREATE INDEX IF NOT EXISTS estate_tasks_case_status_idx ON public.estate_tasks (estate_case_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.estate_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_case_id uuid NOT NULL REFERENCES public.estate_cases(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  valuation_amount_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'GBP',
  valuation_date date,
  valuer_name text,
  methodology_notes text,
  source_document_id uuid REFERENCES public.estate_administration_documents(id) ON DELETE SET NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_status text NOT NULL DEFAULT 'submitted',
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.estate_liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_case_id uuid NOT NULL REFERENCES public.estate_cases(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creditor_name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  claimed_amount_minor bigint NOT NULL DEFAULT 0,
  admitted_amount_minor bigint,
  currency_code text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'submitted',
  due_date date,
  settlement_reference text,
  notes text,
  source_document_id uuid REFERENCES public.estate_administration_documents(id) ON DELETE SET NULL,
  recorded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_liabilities_status_check CHECK (status IN ('submitted','under_review','admitted','rejected','settled','disputed'))
);

CREATE TABLE IF NOT EXISTS public.estate_beneficiary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_case_id uuid NOT NULL REFERENCES public.estate_cases(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficiary_label text NOT NULL,
  historic_source_reference text,
  working_interpretation text,
  review_status text NOT NULL DEFAULT 'draft',
  recorded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.estate_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_case_id uuid NOT NULL REFERENCES public.estate_cases(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficiary_record_id uuid REFERENCES public.estate_beneficiary_records(id) ON DELETE SET NULL,
  source_entitlement_reference text,
  asset_or_cash_description text NOT NULL,
  amount_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'GBP',
  proposed_date date,
  approved_date date,
  completed_date date,
  status text NOT NULL DEFAULT 'draft',
  evidence_document_id uuid REFERENCES public.estate_administration_documents(id) ON DELETE SET NULL,
  authorised_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_distributions_status_check CHECK (status IN ('draft','proposed','approved','paid_transferred','cancelled','disputed'))
);

CREATE TABLE IF NOT EXISTS public.sensitive_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_case_id uuid REFERENCES public.estate_cases(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  status text NOT NULL DEFAULT 'requested',
  justification text NOT NULL,
  risk_level text NOT NULL DEFAULT 'high',
  required_approvals integer NOT NULL DEFAULT 2,
  level3_required boolean NOT NULL DEFAULT true,
  requester_presence_verified_at timestamptz,
  execution_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (timezone('utc', now()) + interval '24 hours'),
  executed_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT sensitive_action_requests_status_check CHECK (status IN ('requested','pending_approval','approved','rejected','expired','cancelled','executed')),
  CONSTRAINT sensitive_action_requests_risk_check CHECK (risk_level IN ('medium','high','critical')),
  CONSTRAINT sensitive_action_requests_approval_check CHECK (required_approvals >= 1)
);

CREATE TABLE IF NOT EXISTS public.sensitive_action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.sensitive_action_requests(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL,
  reason text NOT NULL,
  approver_presence_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT sensitive_action_approvals_decision_check CHECK (decision IN ('approved','rejected')),
  UNIQUE (request_id, approver_user_id)
);

CREATE TABLE IF NOT EXISTS public.recovery_key_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_version text NOT NULL,
  algorithm text NOT NULL,
  kms_key_reference text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  rotated_at timestamptz,
  CONSTRAINT recovery_key_versions_status_check CHECK (status IN ('active','rotated','retired','disabled'))
);

CREATE TABLE IF NOT EXISTS public.vault_recovery_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_version_id uuid REFERENCES public.recovery_key_versions(id) ON DELETE SET NULL,
  wrapped_material_reference text NOT NULL,
  algorithm text NOT NULL,
  kms_key_reference text NOT NULL,
  material_state text NOT NULL DEFAULT 'available',
  last_validation_at timestamptz,
  validation_status text NOT NULL DEFAULT 'not_checked',
  validation_error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vault_recovery_material_state_check CHECK (material_state IN ('available','rotated','disabled','destroyed')),
  CONSTRAINT vault_recovery_material_validation_check CHECK (validation_status IN ('not_checked','valid','warning','failed'))
);

CREATE TABLE IF NOT EXISTS public.recovery_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensitive_action_request_id uuid REFERENCES public.sensitive_action_requests(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recovery_material_id uuid REFERENCES public.vault_recovery_material(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested',
  requested_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  execution_mode text NOT NULL DEFAULT 'test_adapter',
  execution_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT recovery_access_requests_status_check CHECK (status IN ('requested','pending_approval','approved','rejected','executed','cancelled')),
  CONSTRAINT recovery_access_requests_no_plaintext CHECK (
    execution_result IS NULL OR NOT (
      execution_result ? 'plaintext_key'
      OR execution_result ? 'dek'
      OR execution_result ? 'kek'
      OR execution_result ? 'secret'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.recovery_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_access_request_id uuid NOT NULL REFERENCES public.recovery_access_requests(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT recovery_approval_events_decision_check CHECK (decision IN ('approved','rejected'))
);

CREATE TABLE IF NOT EXISTS public.estate_notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_case_id uuid REFERENCES public.estate_cases(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'queued',
  safe_summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_notification_events_status_check CHECK (delivery_status IN ('queued','sent','failed','suppressed'))
);

CREATE INDEX IF NOT EXISTS estate_participants_case_status_idx ON public.estate_participants (estate_case_id, status);
CREATE INDEX IF NOT EXISTS estate_valuations_case_idx ON public.estate_valuations (estate_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS estate_liabilities_case_idx ON public.estate_liabilities (estate_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS estate_distributions_case_idx ON public.estate_distributions (estate_case_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS sensitive_action_case_status_idx ON public.sensitive_action_requests (estate_case_id, status, updated_at DESC);

ALTER TABLE public.estate_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_beneficiary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitive_action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitive_action_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_key_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_recovery_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_notification_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.lf_estate_case_status(p_estate_case_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT status FROM public.estate_cases WHERE id = p_estate_case_id), 'not_found');
$$;

CREATE OR REPLACE FUNCTION public.lf_estate_participant_has_permission(p_estate_case_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.estate_participants participant
    JOIN public.estate_cases estate_case ON estate_case.id = participant.estate_case_id
    WHERE participant.estate_case_id = p_estate_case_id
      AND participant.user_id = auth.uid()
      AND participant.status = 'active'
      AND estate_case.status NOT IN ('suspended')
      AND public.lf_identity_assurance_level(participant.user_id) >= participant.required_identity_level
      AND (
        COALESCE(participant.permissions -> 'capabilities', '[]'::jsonb) ? p_permission
        OR COALESCE(participant.permissions, '{}'::jsonb) ? p_permission
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.lf_estate_claim_allows_document(p_document_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.estate_administration_documents doc
    JOIN public.estate_access_claims claim ON claim.id = doc.estate_claim_id
    WHERE doc.id = p_document_id
      AND doc.deleted_at IS NULL
      AND claim.claimant_user_id = auth.uid()
      AND claim.status = 'active'
      AND public.lf_identity_assurance_level(claim.claimant_user_id) >= claim.required_identity_level
      AND COALESCE(claim.permissions -> 'estate_document_ids', '[]'::jsonb) ? doc.id::text
  )
  OR EXISTS (
    SELECT 1
    FROM public.estate_administration_documents doc
    WHERE doc.id = p_document_id
      AND doc.deleted_at IS NULL
      AND doc.estate_case_id IS NOT NULL
      AND public.lf_estate_participant_has_permission(doc.estate_case_id, 'view_estate_documents')
      AND COALESCE(
        (
          SELECT participant.permissions -> 'estate_document_ids'
          FROM public.estate_participants participant
          WHERE participant.estate_case_id = doc.estate_case_id
            AND participant.user_id = auth.uid()
            AND participant.status = 'active'
          LIMIT 1
        ),
        '[]'::jsonb
      ) ? doc.id::text
  );
$$;

CREATE OR REPLACE FUNCTION public.lf_estate_claim_allows_storage_object(p_bucket_id text, p_object_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p_bucket_id = 'estate-administration-evidence'
    AND (
      EXISTS (
        SELECT 1
        FROM public.estate_administration_documents doc
        JOIN public.estate_access_claims claim ON claim.id = doc.estate_claim_id
        WHERE doc.storage_bucket = p_bucket_id
          AND doc.storage_path = p_object_name
          AND doc.deleted_at IS NULL
          AND claim.claimant_user_id = auth.uid()
          AND claim.status = 'active'
          AND public.lf_identity_assurance_level(claim.claimant_user_id) >= claim.required_identity_level
          AND COALESCE(claim.permissions -> 'estate_document_ids', '[]'::jsonb) ? doc.id::text
      )
      OR EXISTS (
        SELECT 1
        FROM public.estate_administration_documents doc
        JOIN public.estate_participants participant ON participant.estate_case_id = doc.estate_case_id
        WHERE doc.storage_bucket = p_bucket_id
          AND doc.storage_path = p_object_name
          AND doc.deleted_at IS NULL
          AND participant.user_id = auth.uid()
          AND participant.status = 'active'
          AND public.lf_identity_assurance_level(participant.user_id) >= participant.required_identity_level
          AND COALESCE(participant.permissions -> 'capabilities', '[]'::jsonb) ? 'download_estate_documents'
          AND COALESCE(participant.permissions -> 'estate_document_ids', '[]'::jsonb) ? doc.id::text
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.lf_sensitive_action_quorum_met(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sensitive_action_requests request
    WHERE request.id = p_request_id
      AND request.status IN ('pending_approval','approved')
      AND request.expires_at > timezone('utc', now())
      AND (
        SELECT count(DISTINCT approval.approver_user_id)
        FROM public.sensitive_action_approvals approval
        WHERE approval.request_id = request.id
          AND approval.decision = 'approved'
          AND approval.approver_user_id <> request.requester_user_id
      ) >= request.required_approvals
  );
$$;

CREATE OR REPLACE FUNCTION public.lf_reject_sensitive_action_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
BEGIN
  SELECT requester_user_id INTO v_requester
  FROM public.sensitive_action_requests
  WHERE id = NEW.request_id;
  IF v_requester IS NOT NULL AND v_requester = NEW.approver_user_id THEN
    RAISE EXCEPTION 'sensitive_action_self_approval_denied';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sensitive_action_no_self_approval ON public.sensitive_action_approvals;
CREATE TRIGGER sensitive_action_no_self_approval
  BEFORE INSERT OR UPDATE ON public.sensitive_action_approvals
  FOR EACH ROW EXECUTE FUNCTION public.lf_reject_sensitive_action_self_approval();

DROP POLICY IF EXISTS estate_cases_participant_select ON public.estate_cases;
CREATE POLICY estate_cases_participant_select ON public.estate_cases
  FOR SELECT USING (auth.uid() = owner_user_id OR public.lf_estate_participant_has_permission(id, 'view_estate_case'));

DROP POLICY IF EXISTS estate_participants_case_select ON public.estate_participants;
CREATE POLICY estate_participants_case_select ON public.estate_participants
  FOR SELECT USING (user_id = auth.uid() OR public.lf_estate_participant_has_permission(estate_case_id, 'manage_estate_collaborator'));

DROP POLICY IF EXISTS estate_tasks_participant_select ON public.estate_tasks;
CREATE POLICY estate_tasks_participant_select ON public.estate_tasks
  FOR SELECT USING (public.lf_estate_participant_has_permission(estate_case_id, 'view_estate_case'));

DROP POLICY IF EXISTS estate_tasks_participant_insert ON public.estate_tasks;
CREATE POLICY estate_tasks_participant_insert ON public.estate_tasks
  FOR INSERT WITH CHECK (created_by_user_id = auth.uid() AND public.lf_estate_participant_has_permission(estate_case_id, 'create_estate_task'));

DROP POLICY IF EXISTS estate_tasks_participant_update ON public.estate_tasks;
CREATE POLICY estate_tasks_participant_update ON public.estate_tasks
  FOR UPDATE USING (public.lf_estate_participant_has_permission(estate_case_id, 'update_estate_task'))
  WITH CHECK (public.lf_estate_participant_has_permission(estate_case_id, 'update_estate_task'));

DROP POLICY IF EXISTS estate_working_records_select ON public.estate_valuations;
CREATE POLICY estate_working_records_select ON public.estate_valuations
  FOR SELECT USING (public.lf_estate_participant_has_permission(estate_case_id, 'view_estate_case'));
DROP POLICY IF EXISTS estate_valuations_insert ON public.estate_valuations;
CREATE POLICY estate_valuations_insert ON public.estate_valuations
  FOR INSERT WITH CHECK (uploaded_by_user_id = auth.uid() AND public.lf_estate_participant_has_permission(estate_case_id, 'submit_valuation'));

DROP POLICY IF EXISTS estate_liabilities_select ON public.estate_liabilities;
CREATE POLICY estate_liabilities_select ON public.estate_liabilities
  FOR SELECT USING (public.lf_estate_participant_has_permission(estate_case_id, 'view_estate_case'));
DROP POLICY IF EXISTS estate_liabilities_insert ON public.estate_liabilities;
CREATE POLICY estate_liabilities_insert ON public.estate_liabilities
  FOR INSERT WITH CHECK (recorded_by_user_id = auth.uid() AND public.lf_estate_participant_has_permission(estate_case_id, 'record_liability'));

DROP POLICY IF EXISTS estate_beneficiary_records_select ON public.estate_beneficiary_records;
CREATE POLICY estate_beneficiary_records_select ON public.estate_beneficiary_records
  FOR SELECT USING (public.lf_estate_participant_has_permission(estate_case_id, 'view_estate_case'));
DROP POLICY IF EXISTS estate_distributions_select ON public.estate_distributions;
CREATE POLICY estate_distributions_select ON public.estate_distributions
  FOR SELECT USING (public.lf_estate_participant_has_permission(estate_case_id, 'view_estate_case'));
DROP POLICY IF EXISTS estate_distributions_insert ON public.estate_distributions;
CREATE POLICY estate_distributions_insert ON public.estate_distributions
  FOR INSERT WITH CHECK (recorded_by_user_id = auth.uid() AND public.lf_estate_participant_has_permission(estate_case_id, 'record_distribution'));
DROP POLICY IF EXISTS estate_distributions_update ON public.estate_distributions;
CREATE POLICY estate_distributions_update ON public.estate_distributions
  FOR UPDATE USING (public.lf_estate_participant_has_permission(estate_case_id, 'approve_sensitive_action'))
  WITH CHECK (public.lf_estate_participant_has_permission(estate_case_id, 'approve_sensitive_action'));

DROP POLICY IF EXISTS sensitive_actions_participant_select ON public.sensitive_action_requests;
CREATE POLICY sensitive_actions_participant_select ON public.sensitive_action_requests
  FOR SELECT USING (requester_user_id = auth.uid() OR public.lf_estate_participant_has_permission(estate_case_id, 'approve_sensitive_action'));
DROP POLICY IF EXISTS sensitive_actions_participant_insert ON public.sensitive_action_requests;
CREATE POLICY sensitive_actions_participant_insert ON public.sensitive_action_requests
  FOR INSERT WITH CHECK (requester_user_id = auth.uid() AND public.lf_estate_participant_has_permission(estate_case_id, 'request_sensitive_action'));

DROP POLICY IF EXISTS sensitive_action_approvals_select ON public.sensitive_action_approvals;
CREATE POLICY sensitive_action_approvals_select ON public.sensitive_action_approvals
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.sensitive_action_requests request
    WHERE request.id = request_id
      AND (request.requester_user_id = auth.uid() OR public.lf_estate_participant_has_permission(request.estate_case_id, 'approve_sensitive_action'))
  ));
DROP POLICY IF EXISTS sensitive_action_approvals_insert ON public.sensitive_action_approvals;
CREATE POLICY sensitive_action_approvals_insert ON public.sensitive_action_approvals
  FOR INSERT WITH CHECK (approver_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.sensitive_action_requests request
    WHERE request.id = request_id
      AND public.lf_estate_participant_has_permission(request.estate_case_id, 'approve_sensitive_action')
  ));

DROP POLICY IF EXISTS recovery_material_owner_metadata_select ON public.vault_recovery_material;
CREATE POLICY recovery_material_owner_metadata_select ON public.vault_recovery_material
  FOR SELECT USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS estate_notifications_recipient_select ON public.estate_notification_events;
CREATE POLICY estate_notifications_recipient_select ON public.estate_notification_events
  FOR SELECT USING (auth.uid() = recipient_user_id OR public.lf_estate_participant_has_permission(estate_case_id, 'view_estate_case'));

REVOKE ALL ON FUNCTION public.lf_estate_case_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_estate_case_status(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_estate_case_status(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.lf_estate_participant_has_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_estate_participant_has_permission(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_estate_participant_has_permission(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.lf_sensitive_action_quorum_met(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_sensitive_action_quorum_met(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_sensitive_action_quorum_met(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.lf_reject_sensitive_action_self_approval() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_reject_sensitive_action_self_approval() FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_reject_sensitive_action_self_approval() TO service_role;
