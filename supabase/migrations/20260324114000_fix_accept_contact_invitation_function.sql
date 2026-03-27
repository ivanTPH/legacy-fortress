CREATE OR REPLACE FUNCTION public.accept_contact_invitation(
  p_invitation_id uuid,
  p_token text
)
RETURNS TABLE (
  grant_id uuid,
  owner_user_id uuid,
  linked_user_id uuid,
  contact_id uuid,
  assigned_role text,
  activation_status text,
  account_holder_name text,
  contact_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_token_hash text;
  v_invitation public.contact_invitations%ROWTYPE;
  v_role_assignment public.role_assignments%ROWTYPE;
  v_contact_id uuid;
  v_contact public.contacts%ROWTYPE;
  v_owner_name text;
  v_next_activation text;
  v_grant public.account_access_grants%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_invitation_id IS NULL OR COALESCE(trim(p_token), '') = '' THEN
    RAISE EXCEPTION 'Invitation link is incomplete';
  END IF;

  SELECT lower(trim(u.email)) INTO v_user_email
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF COALESCE(v_user_email, '') = '' THEN
    RAISE EXCEPTION 'Signed-in account has no email address';
  END IF;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_invitation
  FROM public.contact_invitations ci
  WHERE ci.id = p_invitation_id
    AND ci.invite_token_hash = v_token_hash
  LIMIT 1;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invitation link is invalid or has expired';
  END IF;

  IF lower(trim(COALESCE(v_invitation.contact_email, ''))) <> v_user_email THEN
    RAISE EXCEPTION 'This invitation is for %', v_invitation.contact_email;
  END IF;

  IF v_invitation.invitation_status IN ('rejected', 'revoked') THEN
    RAISE EXCEPTION 'This invitation is no longer active';
  END IF;

  SELECT * INTO v_role_assignment
  FROM public.role_assignments ra
  WHERE ra.invitation_id = v_invitation.id
  LIMIT 1;

  v_contact_id := v_invitation.contact_id;

  IF v_contact_id IS NOT NULL THEN
    SELECT * INTO v_contact
    FROM public.contacts c
    WHERE c.id = v_contact_id
      AND c.owner_user_id = v_invitation.owner_user_id
    LIMIT 1;
  END IF;

  IF v_contact.id IS NULL THEN
    SELECT * INTO v_contact
    FROM public.contacts c
    WHERE c.owner_user_id = v_invitation.owner_user_id
      AND c.email_normalized = lower(trim(v_invitation.contact_email))
    LIMIT 1;

    IF v_contact.id IS NULL THEN
      INSERT INTO public.contacts (
        owner_user_id,
        full_name,
        email,
        email_normalized,
        contact_role,
        relationship,
        linked_context,
        invite_status,
        verification_status,
        source_type,
        linked_user_id,
        updated_at
      ) VALUES (
        v_invitation.owner_user_id,
        v_invitation.contact_name,
        v_invitation.contact_email,
        lower(trim(v_invitation.contact_email)),
        v_invitation.assigned_role,
        NULL,
        '[]'::jsonb,
        'accepted',
        'accepted',
        'invitation',
        v_user_id,
        timezone('utc', now())
      )
      RETURNING * INTO v_contact;
    END IF;
  END IF;

  IF v_contact.linked_user_id IS NOT NULL AND v_contact.linked_user_id <> v_user_id THEN
    RAISE EXCEPTION 'This contact is already linked to another user';
  END IF;

  v_next_activation := CASE
    WHEN v_role_assignment.activation_status IN ('verified', 'active') THEN v_role_assignment.activation_status
    ELSE 'accepted'
  END;

  UPDATE public.contacts
  SET
    linked_user_id = v_user_id,
    invite_status = 'accepted',
    verification_status = CASE
      WHEN verification_status IN ('verified', 'active') THEN verification_status
      ELSE 'accepted'
    END,
    updated_at = timezone('utc', now())
  WHERE id = v_contact.id
  RETURNING * INTO v_contact;

  UPDATE public.contact_invitations
  SET
    contact_id = v_contact.id,
    invitation_status = 'accepted',
    accepted_at = timezone('utc', now()),
    accepted_user_id = v_user_id,
    updated_at = timezone('utc', now())
  WHERE id = v_invitation.id
  RETURNING * INTO v_invitation;

  IF v_role_assignment.id IS NULL THEN
    INSERT INTO public.role_assignments (
      owner_user_id,
      invitation_id,
      assigned_role,
      activation_status,
      updated_at
    ) VALUES (
      v_invitation.owner_user_id,
      v_invitation.id,
      v_invitation.assigned_role,
      v_next_activation,
      timezone('utc', now())
    )
    RETURNING * INTO v_role_assignment;
  ELSE
    UPDATE public.role_assignments
    SET
      assigned_role = v_invitation.assigned_role,
      activation_status = v_next_activation,
      updated_at = timezone('utc', now())
    WHERE id = v_role_assignment.id
    RETURNING * INTO v_role_assignment;
  END IF;

  INSERT INTO public.account_access_grants (
    owner_user_id,
    linked_user_id,
    contact_id,
    invitation_id,
    assigned_role,
    relationship,
    activation_status,
    updated_at,
    last_accessed_at
  ) VALUES (
    v_invitation.owner_user_id,
    v_user_id,
    v_contact.id,
    v_invitation.id,
    v_invitation.assigned_role,
    v_contact.relationship,
    v_next_activation,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (invitation_id)
  DO UPDATE SET
    linked_user_id = EXCLUDED.linked_user_id,
    contact_id = EXCLUDED.contact_id,
    assigned_role = EXCLUDED.assigned_role,
    relationship = EXCLUDED.relationship,
    activation_status = EXCLUDED.activation_status,
    updated_at = timezone('utc', now()),
    last_accessed_at = timezone('utc', now())
  RETURNING * INTO v_grant;

  INSERT INTO public.invitation_events (
    owner_user_id,
    invitation_id,
    event_type,
    payload
  ) VALUES (
    v_invitation.owner_user_id,
    v_invitation.id,
    'accepted',
    jsonb_build_object(
      'accepted_user_id', v_user_id,
      'contact_id', v_contact.id,
      'assigned_role', v_invitation.assigned_role
    )
  );

  SELECT
    COALESCE(
      NULLIF(trim(up.display_name), ''),
      split_part(COALESCE(owner_user.email, ''), '@', 1),
      'Account holder'
    )
  INTO v_owner_name
  FROM auth.users owner_user
  LEFT JOIN public.user_profiles up
    ON up.user_id = owner_user.id
  WHERE owner_user.id = v_invitation.owner_user_id;

  RETURN QUERY
  SELECT
    v_grant.id,
    v_grant.owner_user_id,
    v_grant.linked_user_id,
    v_grant.contact_id,
    v_grant.assigned_role,
    v_grant.activation_status,
    COALESCE(v_owner_name, 'Account holder'),
    COALESCE(v_contact.full_name, v_invitation.contact_name);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_contact_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_contact_invitation(uuid, text) TO authenticated;
