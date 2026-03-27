CREATE TABLE IF NOT EXISTS public.account_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  invitation_id uuid UNIQUE REFERENCES public.contact_invitations(id) ON DELETE SET NULL,
  assigned_role text NOT NULL,
  relationship text,
  activation_status text NOT NULL DEFAULT 'accepted',
  permissions_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_accessed_at timestamptz
);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.contact_invitations
  ADD COLUMN IF NOT EXISTS accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_access_grants_owner_linked_contact_uidx
  ON public.account_access_grants (owner_user_id, linked_user_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_access_grants_owner_linked_role_uidx
  ON public.account_access_grants (owner_user_id, linked_user_id, assigned_role);

CREATE INDEX IF NOT EXISTS account_access_grants_linked_updated_idx
  ON public.account_access_grants (linked_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS contacts_linked_user_idx
  ON public.contacts (linked_user_id);

CREATE INDEX IF NOT EXISTS contact_invitations_accepted_user_idx
  ON public.contact_invitations (accepted_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'account_access_grants' AND c.conname = 'account_access_grants_role_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.account_access_grants
      ADD CONSTRAINT account_access_grants_role_check
      CHECK (assigned_role IN (
        'professional_advisor',
        'accountant',
        'financial_advisor',
        'lawyer',
        'executor',
        'power_of_attorney',
        'friend_or_family'
      ))
      NOT VALID
    $sql$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'account_access_grants' AND c.conname = 'account_access_grants_activation_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.account_access_grants
      ADD CONSTRAINT account_access_grants_activation_status_check
      CHECK (activation_status IN (
        'invited',
        'accepted',
        'pending_verification',
        'verification_submitted',
        'verified',
        'active',
        'rejected',
        'revoked'
      ))
      NOT VALID
    $sql$;
  END IF;
END$$;

ALTER TABLE public.account_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_linked_account_access(
  p_owner_user_id uuid,
  p_allowed_statuses text[] DEFAULT ARRAY['accepted', 'verified', 'active']
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
      AND g.activation_status = ANY(COALESCE(p_allowed_statuses, ARRAY['accepted', 'verified', 'active']))
  );
$$;

REVOKE ALL ON FUNCTION public.has_linked_account_access(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_linked_account_access(uuid, text[]) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.can_read_linked_vault_object(p_object_name text)
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
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF split_part(COALESCE(p_object_name, ''), '/', 1) <> 'users' THEN
    RETURN false;
  END IF;

  v_owner_text := split_part(p_object_name, '/', 2);
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

  RETURN public.has_linked_account_access(v_owner_user_id, ARRAY['accepted', 'verified', 'active']);
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_linked_vault_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_linked_vault_object(text) TO authenticated, anon;

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
    COALESCE(NULLIF(trim(up.display_name), ''), NULLIF(trim(ci_owner.display_name), ''), split_part(COALESCE(owner_user.email, ''), '@', 1), 'Account holder') AS account_holder_name,
    c.relationship
  FROM public.contact_invitations ci
  LEFT JOIN public.contacts c
    ON c.id = ci.contact_id
  LEFT JOIN public.role_assignments ra
    ON ra.invitation_id = ci.id
  LEFT JOIN public.user_profiles up
    ON up.user_id = ci.owner_user_id
  LEFT JOIN public.profiles ci_owner
    ON ci_owner.user_id = ci.owner_user_id
  LEFT JOIN auth.users owner_user
    ON owner_user.id = ci.owner_user_id
  WHERE ci.id = p_invitation_id
    AND ci.invite_token_hash = v_token_hash
    AND ci.invitation_status IN ('pending', 'accepted');
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_contact_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contact_invitation(uuid, text) TO authenticated, anon;

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

  SELECT lower(trim(email)) INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  IF COALESCE(v_user_email, '') = '' THEN
    RAISE EXCEPTION 'Signed-in account has no email address';
  END IF;

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_invitation
  FROM public.contact_invitations
  WHERE id = p_invitation_id
    AND invite_token_hash = v_token_hash
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
  FROM public.role_assignments
  WHERE invitation_id = v_invitation.id
  LIMIT 1;

  v_contact_id := v_invitation.contact_id;

  IF v_contact_id IS NOT NULL THEN
    SELECT * INTO v_contact
    FROM public.contacts
    WHERE id = v_contact_id
      AND owner_user_id = v_invitation.owner_user_id
    LIMIT 1;
  END IF;

  IF v_contact.id IS NULL THEN
    SELECT * INTO v_contact
    FROM public.contacts
    WHERE owner_user_id = v_invitation.owner_user_id
      AND email_normalized = lower(trim(v_invitation.contact_email))
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

  SELECT COALESCE(NULLIF(trim(up.display_name), ''), NULLIF(trim(owner_profile.display_name), ''), split_part(COALESCE(owner_user.email, ''), '@', 1), 'Account holder')
  INTO v_owner_name
  FROM auth.users owner_user
  LEFT JOIN public.user_profiles up
    ON up.user_id = owner_user.id
  LEFT JOIN public.profiles owner_profile
    ON owner_profile.user_id = owner_user.id
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
    v_contact.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_contact_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_contact_invitation(uuid, text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account_access_grants' AND policyname='account_access_grants_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY account_access_grants_owner_rw ON public.account_access_grants FOR ALL USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='account_access_grants' AND policyname='account_access_grants_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY account_access_grants_linked_select ON public.account_access_grants FOR SELECT USING (auth.uid() = linked_user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='organisations' AND policyname='organisations_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY organisations_linked_select ON public.organisations FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallets' AND policyname='wallets_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY wallets_linked_select ON public.wallets FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='assets' AND policyname='assets_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY assets_linked_select ON public.assets FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='documents_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY documents_linked_select ON public.documents FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='records' AND policyname='records_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY records_linked_select ON public.records FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attachments' AND policyname='attachments_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY attachments_linked_select ON public.attachments FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='record_contacts' AND policyname='record_contacts_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY record_contacts_linked_select ON public.record_contacts FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contacts' AND policyname='contacts_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY contacts_linked_select ON public.contacts FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contact_links' AND policyname='contact_links_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY contact_links_linked_select ON public.contact_links FOR SELECT USING (public.has_linked_account_access(owner_user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='section_entries' AND policyname='section_entries_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY section_entries_linked_select ON public.section_entries FOR SELECT USING (public.has_linked_account_access(user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_owner_rw'
  ) THEN
    EXECUTE 'CREATE POLICY user_profiles_owner_rw ON public.user_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='user_profiles_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY user_profiles_linked_select ON public.user_profiles FOR SELECT USING (public.has_linked_account_access(user_id, ARRAY[''accepted'',''verified'',''active'']))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vault_docs_owner_select'
  ) THEN
    EXECUTE 'CREATE POLICY vault_docs_owner_select ON storage.objects FOR SELECT USING (bucket_id = ''vault-docs'' AND split_part(name, ''/'', 1) = ''users'' AND split_part(name, ''/'', 2) = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vault_docs_owner_insert'
  ) THEN
    EXECUTE 'CREATE POLICY vault_docs_owner_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''vault-docs'' AND split_part(name, ''/'', 1) = ''users'' AND split_part(name, ''/'', 2) = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vault_docs_owner_update'
  ) THEN
    EXECUTE 'CREATE POLICY vault_docs_owner_update ON storage.objects FOR UPDATE USING (bucket_id = ''vault-docs'' AND split_part(name, ''/'', 1) = ''users'' AND split_part(name, ''/'', 2) = auth.uid()::text) WITH CHECK (bucket_id = ''vault-docs'' AND split_part(name, ''/'', 1) = ''users'' AND split_part(name, ''/'', 2) = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vault_docs_owner_delete'
  ) THEN
    EXECUTE 'CREATE POLICY vault_docs_owner_delete ON storage.objects FOR DELETE USING (bucket_id = ''vault-docs'' AND split_part(name, ''/'', 1) = ''users'' AND split_part(name, ''/'', 2) = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vault_docs_linked_select'
  ) THEN
    EXECUTE 'CREATE POLICY vault_docs_linked_select ON storage.objects FOR SELECT USING (bucket_id = ''vault-docs'' AND public.can_read_linked_vault_object(name))';
  END IF;
END$$;
