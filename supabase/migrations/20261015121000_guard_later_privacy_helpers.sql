-- The 22 August privacy migration revokes anon but leaves PUBLIC's default
-- EXECUTE grant, and its argument-taking helpers can expose another user's
-- consent, retention or recovery state. Guard direct calls as well as grants.

CREATE OR REPLACE FUNCTION public.lf_partner_campaign_user_marketing_eligible(
  p_user_id uuid,
  p_organisation_id uuid,
  p_channel text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR (auth.role() = 'authenticated' AND p_user_id = auth.uid())
    THEN NOT EXISTS (
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
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.lf_retention_item_effective_state(p_item_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR (auth.role() = 'authenticated' AND EXISTS (
        SELECT 1 FROM public.retention_items i
        WHERE i.id = p_item_id AND i.subject_user_id = auth.uid()
      ))
    THEN CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.retention_items i
        JOIN public.legal_holds h ON h.id = i.legal_hold_id OR (h.subject_user_id = i.subject_user_id AND h.status = 'active')
        WHERE i.id = p_item_id AND h.status = 'active'
      ) THEN 'legal_hold'
      ELSE COALESCE((SELECT retention_state FROM public.retention_items WHERE id = p_item_id), 'active')
    END
    ELSE NULL::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.lf_recovery_access_quorum_met(p_request_id uuid, p_required_approvals integer DEFAULT 2)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role'
      OR (auth.role() = 'authenticated' AND EXISTS (
        SELECT 1 FROM public.recovery_access_requests request
        WHERE request.id = p_request_id AND request.requested_by_user_id = auth.uid()
      ))
    THEN (
      SELECT count(DISTINCT approval.approver_user_id)
      FROM public.recovery_approval_events approval
      JOIN public.recovery_access_requests request ON request.id = approval.recovery_access_request_id
      WHERE approval.recovery_access_request_id = p_request_id
        AND approval.decision = 'approved'
        AND approval.approver_user_id <> request.requested_by_user_id
    ) >= greatest(1, p_required_approvals)
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.lf_partner_campaign_user_marketing_eligible(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_retention_item_effective_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_recovery_access_quorum_met(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_privacy_export_is_downloadable(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_admin_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_enterprise_operator(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_partner_campaign_user_marketing_eligible(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lf_retention_item_effective_state(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lf_recovery_access_quorum_met(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lf_privacy_export_is_downloadable(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_admin_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_enterprise_operator(text[]) TO authenticated, service_role;
