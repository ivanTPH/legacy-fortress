-- Phase 1: canonical verified-access and vault-state security foundation.
-- Additive/schema-safe migration. Production execution still requires explicit approval.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.identity_assurance_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_level integer NOT NULL DEFAULT 1,
  provider_key text NOT NULL DEFAULT 'lf_account_session',
  provider_assurance_class text NOT NULL DEFAULT 'level_1_authenticated',
  verified_at timestamptz,
  presence_reverified_at timestamptz,
  expires_at timestamptz,
  evidence_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT identity_assurance_states_level_check CHECK (identity_level IN (1, 2, 3))
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_assurance_states_user_uidx
  ON public.identity_assurance_states (user_id);

ALTER TABLE public.identity_assurance_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_assurance_states_owner_select ON public.identity_assurance_states;
CREATE POLICY identity_assurance_states_owner_select ON public.identity_assurance_states
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS vault_lifecycle_state text NOT NULL DEFAULT 'OWNER_ACTIVE',
  ADD COLUMN IF NOT EXISTS vault_lifecycle_changed_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'wallets'
      AND c.conname = 'wallets_vault_lifecycle_state_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_vault_lifecycle_state_check
      CHECK (vault_lifecycle_state IN (
        'OWNER_ACTIVE',
        'DEATH_REPORTED',
        'PROTECTIVE_LOCK',
        'ESTATE_LOCKED',
        'DEATH_STATUS_DISPUTED',
        'OWNER_RECOVERY'
      ))
      NOT VALID
    $sql$;
  END IF;
END $$;

ALTER TABLE public.account_access_grants
  ADD COLUMN IF NOT EXISTS required_identity_level integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS vault_lifecycle_state text NOT NULL DEFAULT 'OWNER_ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'account_access_grants'
      AND c.conname = 'account_access_grants_required_identity_level_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.account_access_grants
      ADD CONSTRAINT account_access_grants_required_identity_level_check
      CHECK (required_identity_level IN (1, 2, 3))
      NOT VALID
    $sql$;
  END IF;
END $$;

ALTER TABLE public.contact_invitations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_status text NOT NULL DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS permissions_override jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.contact_invitations
SET expires_at = COALESCE(expires_at, COALESCE(sent_at, invited_at, created_at, timezone('utc', now())) + interval '30 days')
WHERE expires_at IS NULL;

DROP INDEX IF EXISTS contact_invitations_owner_email_unique_pending_idx;
CREATE UNIQUE INDEX IF NOT EXISTS contact_invitations_owner_email_unique_active_idx
  ON public.contact_invitations (owner_user_id, contact_email, assigned_role)
  WHERE invitation_status IN ('pending', 'accepted');

ALTER TABLE public.contact_invitations
  DROP CONSTRAINT IF EXISTS contact_invitations_status_check;

ALTER TABLE public.contact_invitations
  ADD CONSTRAINT contact_invitations_status_check
  CHECK (invitation_status IN (
    'draft',
    'pending',
    'sent',
    'accepted',
    'identity_required',
    'verification_submitted',
    'verified',
    'active',
    'delivery_failed',
    'failed',
    'expired',
    'revoked',
    'rejected'
  ))
  NOT VALID;

CREATE OR REPLACE FUNCTION public.lf_identity_assurance_level(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT i.identity_level
      FROM public.identity_assurance_states i
      WHERE i.user_id = p_user_id
        AND (i.expires_at IS NULL OR i.expires_at > timezone('utc', now()))
      LIMIT 1
    ),
    1
  );
$$;

CREATE OR REPLACE FUNCTION public.lf_vault_lifecycle_state(p_owner_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT w.vault_lifecycle_state
      FROM public.wallets w
      WHERE w.owner_user_id = p_owner_user_id
        AND w.status = 'active'
      ORDER BY w.updated_at DESC
      LIMIT 1
    ),
    'OWNER_ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.lf_vault_allows_owner_mutation(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.lf_vault_lifecycle_state(p_owner_user_id) IN ('OWNER_ACTIVE', 'OWNER_RECOVERY');
$$;

CREATE OR REPLACE FUNCTION public.lf_linked_grant_satisfies_identity(p_grant public.account_access_grants)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p_grant.linked_user_id = auth.uid()
    AND p_grant.activation_status = ANY(ARRAY['verified','active'])
    AND public.lf_identity_assurance_level(p_grant.linked_user_id) >= COALESCE(p_grant.required_identity_level, 2)
    AND public.lf_vault_lifecycle_state(p_grant.owner_user_id) = 'OWNER_ACTIVE';
$$;

CREATE OR REPLACE FUNCTION public.lf_probate_evidence_grant_satisfies_identity(p_grant public.account_access_grants)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p_grant.linked_user_id = auth.uid()
    AND p_grant.activation_status = ANY(ARRAY['verified','active'])
    AND public.lf_identity_assurance_level(p_grant.linked_user_id) >= COALESCE(p_grant.required_identity_level, 2);
$$;

CREATE OR REPLACE FUNCTION public.has_linked_account_access(
  p_owner_user_id uuid,
  p_allowed_statuses text[] DEFAULT ARRAY['verified', 'active']
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND g.activation_status = ANY(COALESCE(p_allowed_statuses, ARRAY['verified', 'active']))
      AND public.lf_linked_grant_satisfies_identity(g)
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_asset(
  p_owner_user_id uuid,
  p_asset_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND (
        COALESCE(g.permissions_override -> 'asset_ids', '[]'::jsonb) ? p_asset_id::text
        OR EXISTS (
          SELECT 1
          FROM public.contact_links cl
          WHERE cl.owner_user_id = p_owner_user_id
            AND cl.contact_id = g.contact_id
            AND cl.source_kind = 'asset'
            AND cl.source_id = p_asset_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_record(
  p_owner_user_id uuid,
  p_record_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND (
        COALESCE(g.permissions_override -> 'record_ids', '[]'::jsonb) ? p_record_id::text
        OR EXISTS (
          SELECT 1
          FROM public.record_contacts rc
          WHERE rc.owner_user_id = p_owner_user_id
            AND rc.contact_id = g.contact_id
            AND rc.record_id = p_record_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_section_entry(
  p_owner_user_id uuid,
  p_entry_id uuid,
  p_section_key text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND (
        COALESCE(g.permissions_override -> 'section_entry_ids', '[]'::jsonb) ? p_entry_id::text
        OR COALESCE(g.permissions_override -> 'record_ids', '[]'::jsonb) ? p_entry_id::text
      )
      AND (
        COALESCE(g.permissions_override -> 'allowed_sections', '[]'::jsonb) = '[]'::jsonb
        OR COALESCE(g.permissions_override -> 'allowed_sections', '[]'::jsonb) ? COALESCE(p_section_key, '')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_document(
  p_owner_user_id uuid,
  p_document_id uuid,
  p_asset_id uuid,
  p_storage_bucket text,
  p_storage_path text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.linked_grant_allows_asset(p_owner_user_id, p_asset_id)
    OR EXISTS (
      SELECT 1
      FROM public.probate_case_evidence evidence
      JOIN public.probate_cases probate_case ON probate_case.id = evidence.case_id
      JOIN public.account_access_grants g ON g.id = probate_case.access_grant_id
      WHERE evidence.owner_user_id = p_owner_user_id
        AND evidence.deleted_at IS NULL
        AND probate_case.status = 'approved'
        AND g.owner_user_id = p_owner_user_id
        AND public.lf_probate_evidence_grant_satisfies_identity(g)
        AND (
          evidence.document_id = p_document_id
          OR (
            evidence.storage_bucket = COALESCE(p_storage_bucket, '')
            AND evidence.storage_path = COALESCE(p_storage_path, '')
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_storage_object(
  p_bucket_id text,
  p_object_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_owner_text text;
  v_owner_user_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_bucket_id <> 'vault-docs' THEN
    RETURN false;
  END IF;

  IF split_part(COALESCE(p_object_name, ''), '/', 1) <> 'users' THEN
    RETURN false;
  END IF;

  v_owner_text := split_part(COALESCE(p_object_name, ''), '/', 2);
  IF v_owner_text = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_owner_user_id := v_owner_text::uuid;
  EXCEPTION
    WHEN others THEN
      RETURN false;
  END;

  IF v_owner_user_id = auth.uid() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.owner_user_id = v_owner_user_id
      AND d.storage_bucket = p_bucket_id
      AND d.storage_path = p_object_name
      AND public.linked_grant_allows_document(d.owner_user_id, d.id, d.asset_id, d.storage_bucket, d.storage_path)
  )
  OR EXISTS (
    SELECT 1
    FROM public.attachments a
    WHERE a.owner_user_id = v_owner_user_id
      AND a.storage_bucket = p_bucket_id
      AND a.storage_path = p_object_name
      AND public.linked_grant_allows_record(a.owner_user_id, a.record_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.probate_case_evidence evidence
    JOIN public.probate_cases probate_case ON probate_case.id = evidence.case_id
    JOIN public.account_access_grants g ON g.id = probate_case.access_grant_id
    WHERE evidence.owner_user_id = v_owner_user_id
      AND evidence.storage_bucket = p_bucket_id
      AND evidence.storage_path = p_object_name
      AND evidence.deleted_at IS NULL
      AND probate_case.status = 'approved'
      AND public.lf_probate_evidence_grant_satisfies_identity(g)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_linked_vault_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.linked_grant_allows_storage_object('vault-docs', p_object_name);
$$;

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
    COALESCE(ra.activation_status, ci.activation_status, 'invited') AS activation_status,
    COALESCE(NULLIF(trim(up.display_name), ''), NULLIF(trim(ci_owner.display_name), ''), split_part(COALESCE(owner_user.email, ''), '@', 1), 'Account holder') AS account_holder_name,
    c.relationship
  FROM public.contact_invitations ci
  LEFT JOIN public.contacts c ON c.id = ci.contact_id
  LEFT JOIN public.role_assignments ra ON ra.invitation_id = ci.id
  LEFT JOIN public.user_profiles up ON up.user_id = ci.owner_user_id
  LEFT JOIN public.profiles ci_owner ON ci_owner.user_id = ci.owner_user_id
  LEFT JOIN auth.users owner_user ON owner_user.id = ci.owner_user_id
  WHERE ci.id = p_invitation_id
    AND ci.invite_token_hash = v_token_hash
    AND ci.invitation_status IN ('pending', 'sent')
    AND ci.token_consumed_at IS NULL
    AND COALESCE(ci.expires_at, timezone('utc', now()) + interval '1 second') > timezone('utc', now());
END;
$$;

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
  v_next_activation text := 'pending_verification';
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
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invitation link is invalid or has expired';
  END IF;

  IF v_invitation.token_consumed_at IS NOT NULL OR v_invitation.invitation_status NOT IN ('pending', 'sent') THEN
    RAISE EXCEPTION 'This invitation has already been used or is no longer active';
  END IF;

  IF COALESCE(v_invitation.expires_at, timezone('utc', now()) - interval '1 second') <= timezone('utc', now()) THEN
    UPDATE public.contact_invitations
    SET invitation_status = 'expired', updated_at = timezone('utc', now())
    WHERE id = v_invitation.id;
    INSERT INTO public.invitation_events (owner_user_id, invitation_id, event_type, payload)
    VALUES (v_invitation.owner_user_id, v_invitation.id, 'expired', '{}'::jsonb);
    RAISE EXCEPTION 'Invitation link is invalid or has expired';
  END IF;

  IF lower(trim(COALESCE(v_invitation.contact_email, ''))) <> v_user_email THEN
    RAISE EXCEPTION 'This invitation is for %', v_invitation.contact_email;
  END IF;

  SELECT * INTO v_role_assignment
  FROM public.role_assignments ra
  WHERE ra.invitation_id = v_invitation.id
  LIMIT 1;

  IF v_role_assignment.activation_status IN ('verified', 'active')
     AND public.lf_identity_assurance_level(v_user_id) >= 2 THEN
    v_next_activation := v_role_assignment.activation_status;
  END IF;

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
        'pending_verification',
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

  UPDATE public.contacts
  SET
    linked_user_id = v_user_id,
    invite_status = 'accepted',
    verification_status = CASE
      WHEN v_next_activation IN ('verified', 'active') THEN 'verified'
      ELSE 'pending_verification'
    END,
    updated_at = timezone('utc', now())
  WHERE id = v_contact.id
  RETURNING * INTO v_contact;

  UPDATE public.contact_invitations
  SET
    contact_id = v_contact.id,
    invitation_status = 'accepted',
    activation_status = v_next_activation,
    accepted_at = timezone('utc', now()),
    token_consumed_at = timezone('utc', now()),
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
      permissions_override,
      updated_at
    ) VALUES (
      v_invitation.owner_user_id,
      v_invitation.id,
      v_invitation.assigned_role,
      v_next_activation,
      COALESCE(v_invitation.permissions_override, '{}'::jsonb),
      timezone('utc', now())
    )
    RETURNING * INTO v_role_assignment;
  ELSE
    UPDATE public.role_assignments
    SET
      assigned_role = v_invitation.assigned_role,
      activation_status = v_next_activation,
      permissions_override = COALESCE(NULLIF(v_role_assignment.permissions_override, '{}'::jsonb), COALESCE(v_invitation.permissions_override, '{}'::jsonb)),
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
    permissions_override,
    required_identity_level,
    vault_lifecycle_state,
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
    COALESCE(v_role_assignment.permissions_override, v_invitation.permissions_override, '{}'::jsonb),
    2,
    public.lf_vault_lifecycle_state(v_invitation.owner_user_id),
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
    permissions_override = EXCLUDED.permissions_override,
    required_identity_level = EXCLUDED.required_identity_level,
    vault_lifecycle_state = EXCLUDED.vault_lifecycle_state,
    updated_at = timezone('utc', now()),
    last_accessed_at = timezone('utc', now())
  RETURNING * INTO v_grant;

  INSERT INTO public.invitation_events (owner_user_id, invitation_id, event_type, payload)
  VALUES
    (
      v_invitation.owner_user_id,
      v_invitation.id,
      'accepted',
      jsonb_build_object('accepted_user_id', v_user_id, 'contact_id', v_contact.id, 'assigned_role', v_invitation.assigned_role)
    ),
    (
      v_invitation.owner_user_id,
      v_invitation.id,
      'access_activation_blocked_pending_verification',
      jsonb_build_object('grant_id', v_grant.id, 'required_identity_level', 2, 'activation_status', v_next_activation)
    );

  SELECT
    COALESCE(NULLIF(trim(up.display_name), ''), split_part(COALESCE(owner_user.email, ''), '@', 1), 'Account holder')
  INTO v_owner_name
  FROM auth.users owner_user
  LEFT JOIN public.user_profiles up ON up.user_id = owner_user.id
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

REVOKE ALL ON FUNCTION public.lf_identity_assurance_level(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_vault_lifecycle_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_vault_allows_owner_mutation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_linked_grant_satisfies_identity(public.account_access_grants) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lf_probate_evidence_grant_satisfies_identity(public.account_access_grants) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_linked_account_access(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_asset(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_record(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_section_entry(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_document(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_storage_object(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_linked_vault_object(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_contact_invitation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_contact_invitation(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.lf_identity_assurance_level(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_vault_lifecycle_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_vault_allows_owner_mutation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_linked_grant_satisfies_identity(public.account_access_grants) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_probate_evidence_grant_satisfies_identity(public.account_access_grants) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_linked_account_access(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_asset(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_record(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_section_entry(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_document(uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_storage_object(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_linked_vault_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_contact_invitation(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.accept_contact_invitation(uuid, text) TO authenticated;

DROP POLICY IF EXISTS organisations_linked_select ON public.organisations;
DROP POLICY IF EXISTS wallets_linked_select ON public.wallets;
DROP POLICY IF EXISTS assets_linked_select ON public.assets;
DROP POLICY IF EXISTS documents_linked_select ON public.documents;
DROP POLICY IF EXISTS records_linked_select ON public.records;
DROP POLICY IF EXISTS attachments_linked_select ON public.attachments;
DROP POLICY IF EXISTS record_contacts_linked_select ON public.record_contacts;
DROP POLICY IF EXISTS contacts_linked_select ON public.contacts;
DROP POLICY IF EXISTS contact_links_linked_select ON public.contact_links;
DROP POLICY IF EXISTS section_entries_linked_select ON public.section_entries;
DROP POLICY IF EXISTS user_profiles_linked_select ON public.user_profiles;
DROP POLICY IF EXISTS vault_docs_linked_select ON storage.objects;

CREATE POLICY organisations_linked_select ON public.organisations
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.organisation_id = organisations.id AND public.linked_grant_allows_asset(a.owner_user_id, a.id)));

CREATE POLICY wallets_linked_select ON public.wallets
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.wallet_id = wallets.id AND public.linked_grant_allows_asset(a.owner_user_id, a.id)));

CREATE POLICY assets_linked_select ON public.assets
  FOR SELECT USING (public.linked_grant_allows_asset(owner_user_id, id));

CREATE POLICY documents_linked_select ON public.documents
  FOR SELECT USING (public.linked_grant_allows_document(owner_user_id, id, asset_id, storage_bucket, storage_path));

CREATE POLICY records_linked_select ON public.records
  FOR SELECT USING (public.linked_grant_allows_record(owner_user_id, id));

CREATE POLICY attachments_linked_select ON public.attachments
  FOR SELECT USING (public.linked_grant_allows_record(owner_user_id, record_id));

CREATE POLICY record_contacts_linked_select ON public.record_contacts
  FOR SELECT USING (public.linked_grant_allows_record(owner_user_id, record_id));

CREATE POLICY contacts_linked_select ON public.contacts
  FOR SELECT USING (EXISTS (
    SELECT 1
    FROM public.account_access_grants g
    WHERE g.owner_user_id = contacts.owner_user_id
      AND g.linked_user_id = auth.uid()
      AND g.contact_id = contacts.id
      AND public.lf_linked_grant_satisfies_identity(g)
  ));

CREATE POLICY contact_links_linked_select ON public.contact_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.account_access_grants g
      WHERE g.owner_user_id = contact_links.owner_user_id
        AND g.linked_user_id = auth.uid()
        AND g.contact_id = contact_links.contact_id
        AND public.lf_linked_grant_satisfies_identity(g)
    )
    AND (
      (contact_links.source_kind = 'asset' AND public.linked_grant_allows_asset(owner_user_id, source_id))
      OR (contact_links.source_kind = 'record' AND public.linked_grant_allows_record(owner_user_id, source_id))
    )
  );

CREATE POLICY section_entries_linked_select ON public.section_entries
  FOR SELECT USING (public.linked_grant_allows_section_entry(user_id, id, section_key));

CREATE POLICY user_profiles_linked_select ON public.user_profiles
  FOR SELECT USING (public.has_linked_account_access(user_id, ARRAY['verified','active']));

CREATE POLICY vault_docs_linked_select ON storage.objects
  FOR SELECT USING (bucket_id = 'vault-docs' AND public.linked_grant_allows_storage_object(bucket_id, name));

DROP POLICY IF EXISTS assets_owner_rw ON public.assets;
DROP POLICY IF EXISTS documents_owner_rw ON public.documents;
DROP POLICY IF EXISTS records_owner_rw ON public.records;
DROP POLICY IF EXISTS attachments_owner_rw ON public.attachments;
DROP POLICY IF EXISTS section_entries_owner_rw ON public.section_entries;
DROP POLICY IF EXISTS vault_docs_owner_insert ON storage.objects;
DROP POLICY IF EXISTS vault_docs_owner_update ON storage.objects;
DROP POLICY IF EXISTS vault_docs_owner_delete ON storage.objects;

CREATE POLICY assets_owner_select ON public.assets
  FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY assets_owner_insert ON public.assets
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY assets_owner_update ON public.assets
  FOR UPDATE USING (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id))
  WITH CHECK (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY assets_owner_delete ON public.assets
  FOR DELETE USING (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));

CREATE POLICY documents_owner_select ON public.documents
  FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY documents_owner_insert ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY documents_owner_update ON public.documents
  FOR UPDATE USING (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id))
  WITH CHECK (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY documents_owner_delete ON public.documents
  FOR DELETE USING (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));

CREATE POLICY records_owner_select ON public.records
  FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY records_owner_insert ON public.records
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY records_owner_update ON public.records
  FOR UPDATE USING (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id))
  WITH CHECK (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY records_owner_delete ON public.records
  FOR DELETE USING (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));

CREATE POLICY attachments_owner_select ON public.attachments
  FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY attachments_owner_insert ON public.attachments
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY attachments_owner_update ON public.attachments
  FOR UPDATE USING (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id))
  WITH CHECK (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY attachments_owner_delete ON public.attachments
  FOR DELETE USING (auth.uid() = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));

CREATE POLICY section_entries_owner_select ON public.section_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY section_entries_owner_insert ON public.section_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.lf_vault_allows_owner_mutation(user_id));
CREATE POLICY section_entries_owner_update ON public.section_entries
  FOR UPDATE USING (auth.uid() = user_id AND public.lf_vault_allows_owner_mutation(user_id))
  WITH CHECK (auth.uid() = user_id AND public.lf_vault_allows_owner_mutation(user_id));
CREATE POLICY section_entries_owner_delete ON public.section_entries
  FOR DELETE USING (auth.uid() = user_id AND public.lf_vault_allows_owner_mutation(user_id));

CREATE POLICY vault_docs_owner_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vault-docs'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
    AND public.lf_vault_allows_owner_mutation(auth.uid())
  );
CREATE POLICY vault_docs_owner_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'vault-docs'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
    AND public.lf_vault_allows_owner_mutation(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'vault-docs'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
    AND public.lf_vault_allows_owner_mutation(auth.uid())
  );
CREATE POLICY vault_docs_owner_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vault-docs'
    AND split_part(name, '/', 1) = 'users'
    AND split_part(name, '/', 2) = auth.uid()::text
    AND public.lf_vault_allows_owner_mutation(auth.uid())
  );
