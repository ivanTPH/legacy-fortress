-- Phase 3 correction: vault lifecycle transitions are system/admin-service only.
-- Authenticated users must use audited application routes; they must not call the
-- SECURITY DEFINER transition RPC directly.

REVOKE ALL ON FUNCTION public.lf_transition_vault_lifecycle(uuid, text, uuid, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_transition_vault_lifecycle(uuid, text, uuid, text, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.lf_transition_vault_lifecycle(uuid, text, uuid, text, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.lf_transition_vault_lifecycle(uuid, text, uuid, text, uuid, jsonb) TO service_role;
