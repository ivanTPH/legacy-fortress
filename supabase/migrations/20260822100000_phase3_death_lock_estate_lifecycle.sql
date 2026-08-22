-- Phase 3: death report, estate lock, estate administration, and owner recovery.
-- Additive lifecycle layer. Ordinary linked vault access remains Phase 1 OWNER_ACTIVE-only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estate-administration-evidence',
  'estate-administration-evidence',
  false,
  15728640,
  ARRAY['application/pdf','image/jpeg','image/png','text/plain']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.death_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimant_role text NOT NULL,
  relationship text,
  status text NOT NULL DEFAULT 'draft',
  date_of_death date,
  declaration_accepted boolean NOT NULL DEFAULT false,
  claimant_identity_level integer NOT NULL DEFAULT 1,
  claimant_presence_verified_at timestamptz,
  vault_state_at_report text NOT NULL DEFAULT 'OWNER_ACTIVE',
  related_probate_case_id uuid REFERENCES public.probate_cases(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_reason text,
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT death_reports_role_check CHECK (claimant_role IN ('executor','family_member','professional_representative','administrator','authorised_admin','other')),
  CONSTRAINT death_reports_status_check CHECK (status IN (
    'draft',
    'submitted',
    'evidence_required',
    'under_review',
    'protective_lock_applied',
    'confirmed',
    'rejected',
    'disputed',
    'cancelled',
    'owner_recovery_required',
    'closed'
  )),
  CONSTRAINT death_reports_identity_level_check CHECK (claimant_identity_level IN (1, 2, 3)),
  CONSTRAINT death_reports_vault_state_check CHECK (vault_state_at_report IN ('OWNER_ACTIVE','DEATH_REPORTED','PROTECTIVE_LOCK','ESTATE_LOCKED','DEATH_STATUS_DISPUTED','OWNER_RECOVERY'))
);

CREATE INDEX IF NOT EXISTS death_reports_owner_status_idx
  ON public.death_reports (owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS death_reports_claimant_idx
  ON public.death_reports (claimant_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.death_report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  death_report_id uuid NOT NULL REFERENCES public.death_reports(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_type text NOT NULL DEFAULT 'other_supporting_evidence',
  storage_bucket text NOT NULL DEFAULT 'estate-administration-evidence',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  sha256_hash text,
  source_context text NOT NULL DEFAULT 'death_report',
  review_status text NOT NULL DEFAULT 'submitted',
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  retained boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT death_report_evidence_type_check CHECK (evidence_type IN ('death_certificate','medical_confirmation','registry_reference','relationship_statement','professional_attestation','other_supporting_evidence')),
  CONSTRAINT death_report_evidence_review_check CHECK (review_status IN ('submitted','accepted','rejected','removed'))
);

CREATE INDEX IF NOT EXISTS death_report_evidence_report_idx
  ON public.death_report_evidence (death_report_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.estate_access_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  death_report_id uuid REFERENCES public.death_reports(id) ON DELETE SET NULL,
  probate_case_id uuid REFERENCES public.probate_cases(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_grant_id uuid REFERENCES public.account_access_grants(id) ON DELETE SET NULL,
  role_claimed text NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  required_identity_level integer NOT NULL DEFAULT 2,
  authority_evidence_status text NOT NULL DEFAULT 'required',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz,
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  suspended_at timestamptz,
  suspended_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_access_claims_status_check CHECK (status IN (
    'claimed',
    'identity_required',
    'identity_verified',
    'authority_evidence_required',
    'authority_under_review',
    'approved',
    'active',
    'suspended',
    'revoked',
    'rejected'
  )),
  CONSTRAINT estate_access_claims_identity_level_check CHECK (required_identity_level IN (2, 3)),
  CONSTRAINT estate_access_claims_authority_check CHECK (authority_evidence_status IN ('required','submitted','under_review','accepted','rejected'))
);

CREATE INDEX IF NOT EXISTS estate_access_claims_owner_status_idx
  ON public.estate_access_claims (owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS estate_access_claims_claimant_idx
  ON public.estate_access_claims (claimant_user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.estate_access_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_claim_id uuid NOT NULL REFERENCES public.estate_access_claims(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL,
  decided_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_access_decisions_check CHECK (decision IN ('approved','rejected','suspended','revoked','retry_requested'))
);

CREATE TABLE IF NOT EXISTS public.estate_administration_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  death_report_id uuid REFERENCES public.death_reports(id) ON DELETE SET NULL,
  estate_claim_id uuid REFERENCES public.estate_access_claims(id) ON DELETE SET NULL,
  probate_case_id uuid REFERENCES public.probate_cases(id) ON DELETE SET NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  source_context text NOT NULL DEFAULT 'estate_administration',
  storage_bucket text NOT NULL DEFAULT 'estate-administration-evidence',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  prior_version_id uuid REFERENCES public.estate_administration_documents(id) ON DELETE SET NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  retained boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_admin_document_type_check CHECK (document_type IN ('death_certificate','grant_of_probate','letters_of_administration','estate_valuation','hmrc_correspondence','executor_correspondence','creditor_claim','distribution_record','professional_report','other_estate_document'))
);

CREATE INDEX IF NOT EXISTS estate_admin_documents_claim_idx
  ON public.estate_administration_documents (estate_claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS estate_admin_documents_owner_idx
  ON public.estate_administration_documents (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.estate_security_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  death_report_id uuid REFERENCES public.death_reports(id) ON DELETE SET NULL,
  estate_claim_id uuid REFERENCES public.estate_access_claims(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'admin',
  reason text NOT NULL,
  previous_vault_state text,
  new_vault_state text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT estate_security_actions_type_check CHECK (action_type IN (
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
    'estate_security_action'
  )),
  CONSTRAINT estate_security_actions_actor_type_check CHECK (actor_type IN ('owner','claimant','admin','system'))
);

CREATE INDEX IF NOT EXISTS estate_security_actions_owner_created_idx
  ON public.estate_security_actions (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.death_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  death_report_id uuid REFERENCES public.death_reports(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'system',
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT death_report_events_type_check CHECK (event_type IN (
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
    'estate_security_action'
  ))
);

CREATE INDEX IF NOT EXISTS death_report_events_report_created_idx
  ON public.death_report_events (death_report_id, created_at DESC);

ALTER TABLE public.death_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.death_report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_access_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_access_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_administration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estate_security_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.death_report_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS death_reports_claimant_owner_select ON public.death_reports;
CREATE POLICY death_reports_claimant_owner_select ON public.death_reports
  FOR SELECT USING (auth.uid() = claimant_user_id OR auth.uid() = owner_user_id);

DROP POLICY IF EXISTS death_report_evidence_uploader_select ON public.death_report_evidence;
CREATE POLICY death_report_evidence_uploader_select ON public.death_report_evidence
  FOR SELECT USING (auth.uid() = uploaded_by_user_id OR auth.uid() = owner_user_id);

DROP POLICY IF EXISTS estate_access_claims_claimant_owner_select ON public.estate_access_claims;
CREATE POLICY estate_access_claims_claimant_owner_select ON public.estate_access_claims
  FOR SELECT USING (auth.uid() = claimant_user_id OR auth.uid() = owner_user_id);

DROP POLICY IF EXISTS estate_access_decisions_claimant_owner_select ON public.estate_access_decisions;
CREATE POLICY estate_access_decisions_claimant_owner_select ON public.estate_access_decisions
  FOR SELECT USING (auth.uid() = claimant_user_id OR auth.uid() = owner_user_id);

DROP POLICY IF EXISTS estate_admin_documents_estate_claim_select ON public.estate_administration_documents;
CREATE POLICY estate_admin_documents_estate_claim_select ON public.estate_administration_documents
  FOR SELECT USING (
    auth.uid() = owner_user_id
    OR EXISTS (
      SELECT 1
      FROM public.estate_access_claims claim
      WHERE claim.id = estate_claim_id
        AND claim.claimant_user_id = auth.uid()
        AND claim.status = 'active'
        AND public.lf_identity_assurance_level(claim.claimant_user_id) >= claim.required_identity_level
        AND COALESCE(claim.permissions -> 'estate_document_ids', '[]'::jsonb) ? id::text
    )
  );

DROP POLICY IF EXISTS estate_security_actions_owner_claimant_select ON public.estate_security_actions;
CREATE POLICY estate_security_actions_owner_claimant_select ON public.estate_security_actions
  FOR SELECT USING (auth.uid() = owner_user_id OR EXISTS (
    SELECT 1 FROM public.estate_access_claims claim
    WHERE claim.id = estate_claim_id AND claim.claimant_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS death_report_events_owner_claimant_select ON public.death_report_events;
CREATE POLICY death_report_events_owner_claimant_select ON public.death_report_events
  FOR SELECT USING (auth.uid() = owner_user_id OR auth.uid() = actor_user_id);

CREATE OR REPLACE FUNCTION public.lf_valid_vault_lifecycle_transition(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_from, p_to) IN (
    ('OWNER_ACTIVE', 'DEATH_REPORTED'),
    ('DEATH_REPORTED', 'PROTECTIVE_LOCK'),
    ('DEATH_REPORTED', 'DEATH_STATUS_DISPUTED'),
    ('PROTECTIVE_LOCK', 'ESTATE_LOCKED'),
    ('PROTECTIVE_LOCK', 'DEATH_STATUS_DISPUTED'),
    ('ESTATE_LOCKED', 'DEATH_STATUS_DISPUTED'),
    ('DEATH_STATUS_DISPUTED', 'OWNER_RECOVERY'),
    ('OWNER_RECOVERY', 'OWNER_ACTIVE')
  );
$$;

CREATE OR REPLACE FUNCTION public.lf_transition_vault_lifecycle(
  p_owner_user_id uuid,
  p_to_state text,
  p_actor_user_id uuid,
  p_reason text,
  p_death_report_id uuid DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_state text;
  v_action text;
BEGIN
  IF p_owner_user_id IS NULL OR p_actor_user_id IS NULL OR COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'vault_transition_requires_actor_reason';
  END IF;

  v_from_state := public.lf_vault_lifecycle_state(p_owner_user_id);
  IF v_from_state = p_to_state THEN
    RETURN v_from_state;
  END IF;
  IF NOT public.lf_valid_vault_lifecycle_transition(v_from_state, p_to_state) THEN
    RAISE EXCEPTION 'invalid_vault_lifecycle_transition:%->%', v_from_state, p_to_state;
  END IF;

  UPDATE public.wallets
  SET vault_lifecycle_state = p_to_state,
      vault_lifecycle_changed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE owner_user_id = p_owner_user_id
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active_wallet_not_found_for_transition';
  END IF;

  v_action := CASE p_to_state
    WHEN 'DEATH_REPORTED' THEN 'death_report_submitted'
    WHEN 'PROTECTIVE_LOCK' THEN 'protective_lock_applied'
    WHEN 'ESTATE_LOCKED' THEN 'estate_lock_applied'
    WHEN 'DEATH_STATUS_DISPUTED' THEN 'death_status_disputed'
    WHEN 'OWNER_RECOVERY' THEN 'owner_recovery_started'
    WHEN 'OWNER_ACTIVE' THEN 'owner_active_restored'
    ELSE 'estate_security_action'
  END;

  INSERT INTO public.estate_security_actions (
    owner_user_id,
    death_report_id,
    action_type,
    actor_user_id,
    actor_type,
    reason,
    previous_vault_state,
    new_vault_state,
    metadata
  )
  VALUES (
    p_owner_user_id,
    p_death_report_id,
    v_action,
    p_actor_user_id,
    COALESCE(p_context ->> 'actor_type', 'system'),
    p_reason,
    v_from_state,
    p_to_state,
    p_context
  );

  IF p_death_report_id IS NOT NULL THEN
    INSERT INTO public.death_report_events (
      death_report_id,
      owner_user_id,
      actor_user_id,
      actor_type,
      event_type,
      metadata
    )
    VALUES (
      p_death_report_id,
      p_owner_user_id,
      p_actor_user_id,
      COALESCE(p_context ->> 'actor_type', 'system'),
      v_action,
      jsonb_build_object('from', v_from_state, 'to', p_to_state)
    );
  END IF;

  RETURN p_to_state;
END;
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
    AND EXISTS (
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
    );
$$;

DROP POLICY IF EXISTS estate_evidence_owner_service_select ON storage.objects;
CREATE POLICY estate_evidence_owner_service_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'estate-administration-evidence'
    AND (
      (
        split_part(name, '/', 1) = 'users'
        AND split_part(name, '/', 2) = auth.uid()::text
      )
      OR public.lf_estate_claim_allows_storage_object(bucket_id, name)
    )
  );

DROP POLICY IF EXISTS estate_evidence_owner_insert ON storage.objects;
CREATE POLICY estate_evidence_owner_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'estate-administration-evidence'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

REVOKE ALL ON FUNCTION public.lf_valid_vault_lifecycle_transition(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lf_valid_vault_lifecycle_transition(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.lf_transition_vault_lifecycle(uuid, text, uuid, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_transition_vault_lifecycle(uuid, text, uuid, text, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.lf_transition_vault_lifecycle(uuid, text, uuid, text, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.lf_transition_vault_lifecycle(uuid, text, uuid, text, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.lf_estate_claim_allows_document(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_estate_claim_allows_document(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_estate_claim_allows_document(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.lf_estate_claim_allows_storage_object(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_estate_claim_allows_storage_object(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_estate_claim_allows_storage_object(text, text) TO authenticated;
