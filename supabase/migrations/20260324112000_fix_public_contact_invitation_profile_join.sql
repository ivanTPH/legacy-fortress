CREATE OR REPLACE FUNCTION public.get_public_contact_invitation(
  p_invitation_id uuid,
  p_token text
)
RETURNS TABLE (
  invitation_id uuid,
  contact_id uuid,
  contact_name text,
  contact_email text,
  assigned_role text,
  invitation_status text,
  activation_status text,
  account_holder_name text,
  relationship text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
BEGIN
  IF p_invitation_id IS NULL OR COALESCE(trim(p_token), '') = '' THEN
    RETURN;
  END IF;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  RETURN QUERY
  SELECT
    ci.id,
    ci.contact_id,
    ci.contact_name,
    ci.contact_email,
    ci.assigned_role,
    ci.invitation_status,
    COALESCE(ra.activation_status, 'invited') AS activation_status,
    COALESCE(
      NULLIF(trim(up.display_name), ''),
      split_part(COALESCE(owner_user.email, ''), '@', 1),
      'Account holder'
    ) AS account_holder_name,
    c.relationship
  FROM public.contact_invitations ci
  LEFT JOIN public.contacts c
    ON c.id = ci.contact_id
  LEFT JOIN public.role_assignments ra
    ON ra.invitation_id = ci.id
  LEFT JOIN public.user_profiles up
    ON up.user_id = ci.owner_user_id
  LEFT JOIN auth.users owner_user
    ON owner_user.id = ci.owner_user_id
  WHERE ci.id = p_invitation_id
    AND ci.invite_token_hash = v_token_hash
    AND ci.invitation_status IN ('pending', 'accepted');
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_contact_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contact_invitation(uuid, text) TO authenticated, anon;
