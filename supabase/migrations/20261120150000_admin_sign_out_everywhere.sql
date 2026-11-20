-- Support action "Sign out on every device" (owner decision 20 Nov 2026: low-risk support help for support agents
-- and super admins, with a reason, audited). Ends every session of one account, for example after a lost phone.
-- Deleting the sessions also removes their refresh tokens (refresh_tokens.session_id cascades), so no device can
-- stay signed in once its current access token runs out (at most an hour). Passwords, data and access are unchanged.
-- Only the service role may call it: the Admin API checks support:manage, asks for a reason and audits it first.
CREATE OR REPLACE FUNCTION public.lf_admin_sign_out_everywhere(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ended integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS ended = ROW_COUNT;
  RETURN ended;
END;
$$;

REVOKE ALL ON FUNCTION public.lf_admin_sign_out_everywhere(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_admin_sign_out_everywhere(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lf_admin_sign_out_everywhere(uuid) TO service_role;

COMMENT ON FUNCTION public.lf_admin_sign_out_everywhere(uuid) IS
  'Support action: end every session of one account. Service role only; called by the audited Admin API.';
