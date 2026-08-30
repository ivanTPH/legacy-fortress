-- Phase 7: operational identity-verification review metadata.
-- Additive only. This does not grant access or expose identity evidence.

ALTER TABLE public.identity_verification_requests
  ADD COLUMN IF NOT EXISTS assigned_reviewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_reason_code text,
  ADD COLUMN IF NOT EXISTS policy_version text NOT NULL DEFAULT 'idv-phase7-v1';

CREATE INDEX IF NOT EXISTS identity_verification_requests_review_queue_idx
  ON public.identity_verification_requests (status, manual_review_required, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.identity_verification_review_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.identity_verification_requests(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (length(trim(note)) BETWEEN 1 AND 4000),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS identity_verification_review_notes_request_idx
  ON public.identity_verification_review_notes (request_id, created_at DESC);

ALTER TABLE public.identity_verification_review_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_verification_review_notes FROM anon;
REVOKE ALL ON public.identity_verification_review_notes FROM authenticated;

ALTER TABLE public.identity_verification_events
  ADD COLUMN IF NOT EXISTS provider_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS identity_verification_events_provider_event_uidx
  ON public.identity_verification_events (provider_key, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

ALTER TABLE public.identity_verification_events
  DROP CONSTRAINT IF EXISTS identity_verification_events_type_check;
ALTER TABLE public.identity_verification_events
  ADD CONSTRAINT identity_verification_events_type_check CHECK (event_type IN (
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
    'evidence_deleted',
    'identity_verification_retry_requested',
    'identity_review_assigned',
    'identity_review_note_added',
    'identity_review_escalated',
    'document_verification_completed',
    'liveness_verification_completed',
    'face_match_completed',
    'identity_verification_retry_requested',
    'identity_verification_review_required',
    'identity_verification_verified',
    'identity_verification_failed'
  ));
