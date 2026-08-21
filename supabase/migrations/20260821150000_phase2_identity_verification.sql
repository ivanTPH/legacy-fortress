-- Phase 2: identity verification, evidence isolation, and step-up assurance.
-- Additive only. Evidence belongs outside ordinary vault documents.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-verification-evidence',
  'identity-verification-evidence',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.identity_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_purpose text NOT NULL,
  provider_key text NOT NULL,
  provider_reference text,
  status text NOT NULL DEFAULT 'draft',
  requested_identity_level integer NOT NULL DEFAULT 2,
  achieved_identity_level integer,
  related_invitation_id uuid REFERENCES public.contact_invitations(id) ON DELETE SET NULL,
  related_access_grant_id uuid REFERENCES public.account_access_grants(id) ON DELETE SET NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  manual_review_required boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  verified_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  evidence_retention_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT identity_verification_requests_level_check CHECK (requested_identity_level IN (2, 3) AND (achieved_identity_level IS NULL OR achieved_identity_level IN (2, 3))),
  CONSTRAINT identity_verification_requests_purpose_check CHECK (verification_purpose IN ('linked_access','registration_required','step_up_presence','admin_review')),
  CONSTRAINT identity_verification_requests_status_check CHECK (status IN (
    'draft',
    'started',
    'document_required',
    'document_uploaded',
    'document_processing',
    'document_extracted',
    'camera_required',
    'camera_captured',
    'comparison_processing',
    'review_required',
    'verified',
    'failed',
    'expired',
    'cancelled'
  ))
);

CREATE INDEX IF NOT EXISTS identity_verification_requests_user_created_idx
  ON public.identity_verification_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS identity_verification_requests_status_created_idx
  ON public.identity_verification_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS identity_verification_requests_grant_idx
  ON public.identity_verification_requests (related_access_grant_id);

ALTER TABLE public.account_access_grants
  DROP CONSTRAINT IF EXISTS account_access_grants_activation_status_check;
ALTER TABLE public.account_access_grants
  ADD CONSTRAINT account_access_grants_activation_status_check
  CHECK (activation_status IN (
    'invited',
    'accepted',
    'identity_required',
    'pending_verification',
    'verification_submitted',
    'verified',
    'active',
    'rejected',
    'revoked'
  ));

ALTER TABLE public.role_assignments
  DROP CONSTRAINT IF EXISTS role_assignments_activation_status_check;
ALTER TABLE public.role_assignments
  ADD CONSTRAINT role_assignments_activation_status_check
  CHECK (activation_status IN (
    'invited',
    'accepted',
    'identity_required',
    'pending_verification',
    'verification_submitted',
    'verified',
    'active',
    'rejected',
    'revoked'
  ));

CREATE TABLE IF NOT EXISTS public.identity_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.identity_verification_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_side text NOT NULL DEFAULT 'front',
  document_type text,
  document_country text,
  storage_bucket text NOT NULL DEFAULT 'identity-verification-evidence',
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  sha256_hash text NOT NULL,
  extraction_status text NOT NULL DEFAULT 'pending',
  extracted_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_confidence numeric,
  extraction_warnings text[] NOT NULL DEFAULT ARRAY[]::text[],
  portrait_reference text,
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT identity_verification_documents_side_check CHECK (document_side IN ('front','back')),
  CONSTRAINT identity_verification_documents_extraction_check CHECK (extraction_status IN ('pending','processing','extracted','failed','deleted'))
);

CREATE INDEX IF NOT EXISTS identity_verification_documents_request_idx
  ON public.identity_verification_documents (request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.identity_presence_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.identity_verification_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_type text NOT NULL DEFAULT 'active_camera_prompt',
  challenge_prompt text NOT NULL,
  challenge_nonce_hash text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  storage_bucket text DEFAULT 'identity-verification-evidence',
  storage_path text,
  liveness_status text,
  liveness_confidence numeric,
  issued_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  captured_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT timezone('utc', now()) + interval '10 minutes',
  retention_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT identity_presence_challenges_status_check CHECK (status IN ('issued','captured','passed','failed','expired','cancelled')),
  CONSTRAINT identity_presence_challenges_liveness_check CHECK (liveness_status IS NULL OR liveness_status IN ('passed','failed','review_required'))
);

CREATE INDEX IF NOT EXISTS identity_presence_challenges_request_idx
  ON public.identity_presence_challenges (request_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS public.identity_verification_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.identity_verification_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  provider_assurance_class text NOT NULL,
  decision text NOT NULL,
  decision_reason_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  requested_identity_level integer NOT NULL,
  achieved_identity_level integer,
  face_match_score numeric,
  face_match_threshold numeric,
  liveness_result text,
  document_confidence numeric,
  requires_manual_review boolean NOT NULL DEFAULT false,
  evidence_references jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT identity_verification_decisions_decision_check CHECK (decision IN ('verified','failed','review_required')),
  CONSTRAINT identity_verification_decisions_level_check CHECK (requested_identity_level IN (2, 3) AND (achieved_identity_level IS NULL OR achieved_identity_level IN (2, 3)))
);

CREATE INDEX IF NOT EXISTS identity_verification_decisions_request_idx
  ON public.identity_verification_decisions (request_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS public.identity_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.identity_verification_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user',
  provider_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT identity_verification_events_type_check CHECK (event_type IN (
    'verification_started',
    'document_uploaded',
    'document_processed',
    'document_extraction_failed',
    'camera_started',
    'camera_captured',
    'liveness_passed',
    'liveness_failed',
    'face_match_passed',
    'face_match_failed',
    'review_required',
    'verification_verified',
    'verification_failed',
    'verification_expired',
    'verification_cancelled',
    'manual_review_approved',
    'manual_review_rejected',
    'identity_level_changed',
    'presence_reverified',
    'evidence_deleted'
  )),
  CONSTRAINT identity_verification_events_actor_type_check CHECK (actor_type IN ('user','admin','system','provider'))
);

CREATE INDEX IF NOT EXISTS identity_verification_events_request_created_idx
  ON public.identity_verification_events (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS identity_verification_events_user_created_idx
  ON public.identity_verification_events (user_id, created_at DESC);

ALTER TABLE public.identity_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_presence_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_verification_requests_owner_select ON public.identity_verification_requests;
CREATE POLICY identity_verification_requests_owner_select ON public.identity_verification_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS identity_verification_documents_owner_select ON public.identity_verification_documents;
CREATE POLICY identity_verification_documents_owner_select ON public.identity_verification_documents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS identity_presence_challenges_owner_select ON public.identity_presence_challenges;
CREATE POLICY identity_presence_challenges_owner_select ON public.identity_presence_challenges
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS identity_verification_decisions_owner_select ON public.identity_verification_decisions;
CREATE POLICY identity_verification_decisions_owner_select ON public.identity_verification_decisions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS identity_verification_events_owner_select ON public.identity_verification_events;
CREATE POLICY identity_verification_events_owner_select ON public.identity_verification_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS identity_evidence_owner_select ON storage.objects;
CREATE POLICY identity_evidence_owner_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'identity-verification-evidence'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

DROP POLICY IF EXISTS identity_evidence_owner_insert ON storage.objects;
CREATE POLICY identity_evidence_owner_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'identity-verification-evidence'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

DROP POLICY IF EXISTS identity_evidence_owner_delete ON storage.objects;
CREATE POLICY identity_evidence_owner_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'identity-verification-evidence'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.lf_identity_presence_level(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.identity_assurance_states s
      WHERE s.user_id = p_user_id
        AND s.identity_level >= 3
        AND COALESCE(s.expires_at, timezone('utc', now()) - interval '1 second') > timezone('utc', now())
        AND COALESCE(s.presence_reverified_at, s.verified_at) >= timezone('utc', now()) - interval '15 minutes'
    ) THEN 3
    ELSE public.lf_identity_assurance_level(p_user_id)
  END;
$$;

REVOKE ALL ON FUNCTION public.lf_identity_presence_level(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_identity_presence_level(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_identity_presence_level(uuid) TO authenticated;
