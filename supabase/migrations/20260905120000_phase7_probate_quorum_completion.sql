-- Phase 7: complete the existing estate sensitive-action quorum safely.
-- This extends the Phase 4 approval primitive; it does not create a second case engine.

ALTER TABLE public.sensitive_action_approvals
  DROP CONSTRAINT IF EXISTS sensitive_action_approvals_decision_check;
ALTER TABLE public.sensitive_action_approvals
  ADD CONSTRAINT sensitive_action_approvals_decision_check
  CHECK (decision IN ('approved','rejected','revoked','expired'));

ALTER TABLE public.sensitive_action_approvals
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

CREATE INDEX IF NOT EXISTS sensitive_action_approvals_request_decision_idx
  ON public.sensitive_action_approvals (request_id, decision, created_at DESC);

CREATE OR REPLACE FUNCTION public.lf_sensitive_action_quorum_summary(p_request_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'required', request.required_approvals,
    'approved', COALESCE((
      SELECT count(DISTINCT approval.approver_user_id)
      FROM public.sensitive_action_approvals approval
      WHERE approval.request_id = request.id
        AND approval.decision = 'approved'
        AND approval.revoked_at IS NULL
        AND approval.approver_user_id <> request.requester_user_id
        AND approval.created_at <= request.expires_at
    ), 0),
    'expired', request.expires_at <= timezone('utc', now()),
    'remaining', GREATEST(0, request.required_approvals - COALESCE((
      SELECT count(DISTINCT approval.approver_user_id)
      FROM public.sensitive_action_approvals approval
      WHERE approval.request_id = request.id
        AND approval.decision = 'approved'
        AND approval.revoked_at IS NULL
        AND approval.approver_user_id <> request.requester_user_id
        AND approval.created_at <= request.expires_at
    ), 0))
  )
  FROM public.sensitive_action_requests request
  WHERE request.id = p_request_id;
$$;

CREATE OR REPLACE FUNCTION public.lf_reject_sensitive_action_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
  v_owner uuid;
BEGIN
  SELECT requester_user_id, owner_user_id INTO v_requester, v_owner
  FROM public.sensitive_action_requests
  WHERE id = NEW.request_id;
  IF v_requester IS NOT NULL AND (v_requester = NEW.approver_user_id OR v_owner = NEW.approver_user_id) THEN
    RAISE EXCEPTION 'sensitive_action_self_approval_denied';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lf_sensitive_action_quorum_met(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((public.lf_sensitive_action_quorum_summary(p_request_id)->>'approved')::integer >= (public.lf_sensitive_action_quorum_summary(p_request_id)->>'required')::integer, false)
    AND COALESCE((public.lf_sensitive_action_quorum_summary(p_request_id)->>'expired')::boolean, true) = false;
$$;

REVOKE ALL ON FUNCTION public.lf_sensitive_action_quorum_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_sensitive_action_quorum_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.lf_sensitive_action_quorum_summary(uuid) TO authenticated;
