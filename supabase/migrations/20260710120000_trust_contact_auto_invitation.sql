-- Trust contact automatic invitation support.
-- Additive/remediation migration: keeps saved Trust contacts separate from vault unlock.

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_invite_status_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_invite_status_check
  CHECK (invite_status IN ('not_invited','invite_sent','accepted','rejected','failed','revoked'))
  NOT VALID;

ALTER TABLE public.contact_invitations
  DROP CONSTRAINT IF EXISTS contact_invitations_status_check;

ALTER TABLE public.contact_invitations
  ADD CONSTRAINT contact_invitations_status_check
  CHECK (invitation_status IN ('pending','accepted','rejected','failed','revoked'))
  NOT VALID;

ALTER TABLE public.contact_invitations
  DROP CONSTRAINT IF EXISTS contact_invitations_role_check;

ALTER TABLE public.contact_invitations
  ADD CONSTRAINT contact_invitations_role_check
  CHECK (assigned_role IN (
    'professional_advisor',
    'accountant',
    'financial_advisor',
    'lawyer',
    'trustee',
    'executor',
    'power_of_attorney',
    'friend_or_family'
  ))
  NOT VALID;

ALTER TABLE public.account_access_grants
  DROP CONSTRAINT IF EXISTS account_access_grants_role_check;

ALTER TABLE public.account_access_grants
  ADD CONSTRAINT account_access_grants_role_check
  CHECK (assigned_role IN (
    'professional_advisor',
    'accountant',
    'financial_advisor',
    'lawyer',
    'trustee',
    'executor',
    'power_of_attorney',
    'friend_or_family'
  ))
  NOT VALID;

CREATE OR REPLACE FUNCTION public.copy_role_assignment_permissions_to_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions jsonb;
BEGIN
  SELECT permissions_override INTO v_permissions
  FROM public.role_assignments
  WHERE invitation_id = NEW.invitation_id
  LIMIT 1;

  IF v_permissions IS NOT NULL
    AND (NEW.permissions_override IS NULL OR NEW.permissions_override = '{}'::jsonb) THEN
    NEW.permissions_override := v_permissions;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_access_grants_copy_permissions ON public.account_access_grants;
CREATE TRIGGER account_access_grants_copy_permissions
  BEFORE INSERT OR UPDATE ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.copy_role_assignment_permissions_to_grant();

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
      AND COALESCE((g.permissions_override ->> 'requires_unlock_approval')::boolean, false) IS NOT TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.has_linked_account_access(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_linked_account_access(uuid, text[]) TO authenticated, anon;

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
      AND g.activation_status = ANY(ARRAY['accepted','verified','active'])
      AND COALESCE((g.permissions_override ->> 'requires_unlock_approval')::boolean, false) IS NOT TRUE
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
      AND g.activation_status = ANY(ARRAY['accepted','verified','active'])
      AND COALESCE((g.permissions_override ->> 'requires_unlock_approval')::boolean, false) IS NOT TRUE
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
      AND g.activation_status = ANY(ARRAY['accepted','verified','active'])
      AND COALESCE((g.permissions_override ->> 'requires_unlock_approval')::boolean, false) IS NOT TRUE
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
