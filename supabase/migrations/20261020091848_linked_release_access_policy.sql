-- Forward-only, fail-closed separation of designation from release.
-- Old grants remain intact for review, but none receive living or estate access.
ALTER TABLE public.account_access_grants
  ADD COLUMN access_state text NOT NULL DEFAULT 'DESIGNATED_LOCKED',
  ADD COLUMN release_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN release_claim_id uuid REFERENCES public.estate_access_claims(id),
  ADD COLUMN release_authorized_at timestamptz,
  ADD COLUMN release_authorized_by uuid REFERENCES auth.users(id),
  ADD COLUMN attorney_authority_verified_at timestamptz,
  ADD COLUMN attorney_authority_verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN attorney_owner_authorized_at timestamptz,
  ADD COLUMN attorney_authority_expires_at timestamptz,
  ADD COLUMN attorney_authority_reference text,
  ADD COLUMN attorney_identification jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.account_access_grants ADD CONSTRAINT account_access_grants_access_state_check
  CHECK (access_state IN ('DESIGNATED_LOCKED', 'ATTORNEY_LIMITED', 'ESTATE_RELEASED', 'REVOKED'));
UPDATE public.account_access_grants SET access_state = 'REVOKED'
WHERE activation_status = 'revoked';
INSERT INTO public.audit_events
  (category, action, result, actor_user_id, resource_type, resource_id, route, metadata)
SELECT 'access', 'existing_grant_classified', 'success', NULL,
  'account_access_grant', g.id::text, 'migration:linked_release_access_policy',
  pg_catalog.jsonb_build_object('state', g.access_state, 'prior_activation_status', g.activation_status)
FROM public.account_access_grants g;

CREATE FUNCTION public.lf_guard_linked_release_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user NOT IN ('postgres', 'service_role') THEN
      NEW.access_state := 'DESIGNATED_LOCKED';
      NEW.release_scope := '{}'::jsonb;
      NEW.release_claim_id := NULL;
      NEW.release_authorized_at := NULL;
      NEW.release_authorized_by := NULL;
      NEW.attorney_authority_verified_at := NULL;
      NEW.attorney_authority_verified_by := NULL;
      NEW.attorney_owner_authorized_at := NULL;
      NEW.attorney_authority_expires_at := NULL;
      NEW.attorney_authority_reference := NULL;
      NEW.attorney_identification := '[]'::jsonb;
    END IF;
  ELSE
    IF NEW.activation_status = 'revoked' THEN NEW.access_state := 'REVOKED'; END IF;
    IF current_user NOT IN ('postgres', 'service_role') AND (
      (NEW.access_state IS DISTINCT FROM OLD.access_state
        AND NOT (NEW.access_state = 'REVOKED' AND NEW.activation_status = 'revoked'))
      OR NEW.release_scope IS DISTINCT FROM OLD.release_scope
      OR NEW.release_claim_id IS DISTINCT FROM OLD.release_claim_id
      OR NEW.release_authorized_at IS DISTINCT FROM OLD.release_authorized_at
      OR NEW.release_authorized_by IS DISTINCT FROM OLD.release_authorized_by
      OR NEW.attorney_authority_verified_at IS DISTINCT FROM OLD.attorney_authority_verified_at
      OR NEW.attorney_authority_verified_by IS DISTINCT FROM OLD.attorney_authority_verified_by
      OR NEW.attorney_owner_authorized_at IS DISTINCT FROM OLD.attorney_owner_authorized_at
      OR NEW.attorney_authority_expires_at IS DISTINCT FROM OLD.attorney_authority_expires_at
      OR NEW.attorney_authority_reference IS DISTINCT FROM OLD.attorney_authority_reference
      OR NEW.attorney_identification IS DISTINCT FROM OLD.attorney_identification
    ) THEN
      RAISE EXCEPTION 'Release authority is staff-controlled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_guard_linked_release_columns() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lf_guard_linked_release_columns
  BEFORE INSERT OR UPDATE ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.lf_guard_linked_release_columns();

-- Historical record selections do not count as attorney consent. Only the
-- authenticated Vault owner may opt in or withdraw this specific purpose.
CREATE FUNCTION public.lf_set_attorney_owner_authorization(p_grant_id uuid, p_authorized boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_grant public.account_access_grants%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_authorized IS NULL THEN RAISE EXCEPTION 'Owner decision required'; END IF;
  SELECT * INTO v_grant FROM public.account_access_grants WHERE id = p_grant_id FOR UPDATE;
  IF NOT FOUND OR v_grant.owner_user_id <> auth.uid()
    OR v_grant.assigned_role <> 'power_of_attorney'
    OR v_grant.activation_status = 'revoked' THEN
    RAISE EXCEPTION 'Owner attorney authorization denied';
  END IF;
  UPDATE public.account_access_grants
  SET attorney_owner_authorized_at = CASE WHEN p_authorized THEN pg_catalog.now() ELSE NULL END,
    access_state = CASE WHEN NOT p_authorized AND access_state = 'ATTORNEY_LIMITED'
      THEN 'DESIGNATED_LOCKED' ELSE access_state END,
    attorney_identification = CASE WHEN p_authorized THEN attorney_identification ELSE '[]'::jsonb END,
    updated_at = pg_catalog.now()
  WHERE id = p_grant_id;
  INSERT INTO public.audit_events
    (category, action, result, actor_user_id, resource_type, resource_id, route, metadata)
  VALUES ('access', 'attorney_owner_authorization', 'success', auth.uid(),
    'account_access_grant', p_grant_id::text, 'database:lf_set_attorney_owner_authorization',
    pg_catalog.jsonb_build_object('authorized', p_authorized));
  RETURN p_authorized;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_set_attorney_owner_authorization(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_set_attorney_owner_authorization(uuid, boolean) TO authenticated;

-- A designated record is not a released record. This single predicate is used
-- by the existing asset, record, document and storage policy helpers.
CREATE OR REPLACE FUNCTION public.lf_linked_grant_satisfies_identity(p_grant public.account_access_grants)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_access_grants g
    WHERE g.id = p_grant.id
    AND g.linked_user_id = auth.uid()
    AND g.activation_status IN ('verified', 'active')
    AND g.access_state = 'ESTATE_RELEASED'
    AND g.release_authorized_at IS NOT NULL
    AND g.release_authorized_by IS NOT NULL
    AND public.lf_identity_assurance_level(g.linked_user_id) >= g.required_identity_level
    AND public.lf_vault_lifecycle_state(g.owner_user_id) = 'ESTATE_LOCKED'
    AND EXISTS (
      SELECT 1 FROM public.estate_access_claims c
      JOIN public.death_reports d ON d.id = c.death_report_id
      WHERE c.id = g.release_claim_id
        AND c.access_grant_id = g.id
        AND c.owner_user_id = g.owner_user_id
        AND c.claimant_user_id = g.linked_user_id
        AND c.status = 'active'
        AND c.authority_evidence_status = 'accepted'
        AND c.approved_at IS NOT NULL
        AND c.approved_by_user_id IS NOT NULL
        AND c.revoked_at IS NULL
        AND d.status = 'confirmed'
        AND d.owner_user_id = g.owner_user_id
        AND d.claimant_user_id = g.linked_user_id
    ));
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_asset(p_owner_user_id uuid, p_asset_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND COALESCE(g.release_scope -> 'asset_ids', '[]'::jsonb) ? p_asset_id::text
      AND COALESCE(g.permissions_override -> 'asset_ids', '[]'::jsonb) ? p_asset_id::text
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_record(p_owner_user_id uuid, p_record_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND COALESCE(g.release_scope -> 'record_ids', '[]'::jsonb) ? p_record_id::text
      AND COALESCE(g.permissions_override -> 'record_ids', '[]'::jsonb) ? p_record_id::text
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_section_entry(
  p_owner_user_id uuid, p_entry_id uuid, p_section_key text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND COALESCE(g.release_scope -> 'record_ids', '[]'::jsonb) ? p_entry_id::text
      AND COALESCE(g.permissions_override -> 'record_ids', '[]'::jsonb) ? p_entry_id::text
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_document(
  p_owner_user_id uuid, p_document_id uuid, p_asset_id uuid,
  p_storage_bucket text, p_storage_path text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_access_grants g
    WHERE g.owner_user_id = p_owner_user_id
      AND g.linked_user_id = auth.uid()
      AND public.lf_linked_grant_satisfies_identity(g)
      AND COALESCE(g.release_scope -> 'document_ids', '[]'::jsonb) ? p_document_id::text
      AND COALESCE(g.permissions_override -> 'document_ids', '[]'::jsonb) ? p_document_id::text
  );
$$;

CREATE OR REPLACE FUNCTION public.linked_grant_allows_storage_object(
  p_bucket_id text, p_object_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR p_bucket_id <> 'vault-docs'
     OR pg_catalog.split_part(COALESCE(p_object_name, ''), '/', 1) <> 'users' THEN
    RETURN false;
  END IF;
  BEGIN
    v_owner := pg_catalog.split_part(p_object_name, '/', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  IF v_owner = auth.uid() THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.owner_user_id = v_owner AND d.storage_bucket = p_bucket_id
      AND d.storage_path = p_object_name
      AND public.linked_grant_allows_document(d.owner_user_id, d.id, d.asset_id, d.storage_bucket, d.storage_path)
  ) OR EXISTS (
    SELECT 1 FROM public.attachments a
    WHERE a.owner_user_id = v_owner AND a.storage_bucket = p_bucket_id
      AND a.storage_path = p_object_name
      AND public.linked_grant_allows_record(a.owner_user_id, a.record_id)
  );
END;
$$;

-- Direct grant rows contain designation IDs and owner notes. The recipient
-- uses a narrow relationship RPC instead of selecting those private fields.
DROP POLICY IF EXISTS account_access_grants_linked_select ON public.account_access_grants;
-- Relationship metadata is served by the narrow RPC below. Legacy linked
-- policies on owner profiles/contacts reveal more than a released record.
DROP POLICY IF EXISTS user_profiles_linked_select ON public.user_profiles;
DROP POLICY IF EXISTS contact_details_linked_select ON public.contact_details;
DROP POLICY IF EXISTS addresses_linked_select ON public.addresses;
DROP POLICY IF EXISTS contacts_linked_select ON public.contacts;
DROP POLICY IF EXISTS contact_links_linked_select ON public.contact_links;
DROP POLICY IF EXISTS record_contacts_linked_select ON public.record_contacts;
CREATE OR REPLACE FUNCTION public.lf_linked_relationships()
RETURNS TABLE (
  id uuid, owner_user_id uuid, linked_user_id uuid, contact_id uuid,
  invitation_id uuid, assigned_role text, relationship text,
  activation_status text, permissions_override jsonb,
  required_identity_level integer, vault_lifecycle_state text,
  access_state text, account_holder_name text, last_accessed_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT g.id, g.owner_user_id, g.linked_user_id, g.contact_id,
    g.invitation_id, g.assigned_role, g.relationship, g.activation_status,
    CASE WHEN public.lf_linked_grant_satisfies_identity(g)
      THEN g.release_scope ELSE '{}'::jsonb END,
    g.required_identity_level, public.lf_vault_lifecycle_state(g.owner_user_id),
    CASE WHEN g.activation_status = 'revoked' THEN 'REVOKED'
      WHEN g.access_state = 'ESTATE_RELEASED' AND public.lf_linked_grant_satisfies_identity(g) THEN 'ESTATE_RELEASED'
      WHEN g.access_state = 'ATTORNEY_LIMITED' AND g.assigned_role = 'power_of_attorney'
        AND g.attorney_owner_authorized_at IS NOT NULL
        AND g.activation_status IN ('verified', 'active')
        AND g.attorney_authority_verified_at IS NOT NULL
        AND g.attorney_authority_verified_by IS NOT NULL
        AND g.attorney_authority_expires_at > pg_catalog.now()
        AND public.lf_identity_assurance_level(g.linked_user_id) >= g.required_identity_level
        AND public.lf_vault_lifecycle_state(g.owner_user_id) = 'OWNER_ACTIVE'
      THEN 'ATTORNEY_LIMITED' ELSE 'DESIGNATED_LOCKED' END,
    COALESCE(NULLIF(pg_catalog.btrim(up.display_name), ''), 'Account holder'),
    g.last_accessed_at, g.updated_at
  FROM public.account_access_grants g
  LEFT JOIN public.user_profiles up ON up.user_id = g.owner_user_id
  WHERE auth.uid() IS NOT NULL AND g.linked_user_id = auth.uid()
    AND g.activation_status <> 'revoked' AND g.access_state <> 'REVOKED';
$$;
REVOKE ALL ON FUNCTION public.lf_linked_relationships() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_linked_relationships() TO authenticated;

-- The attorney endpoint returns a reviewed identification list, never asset rows.
CREATE FUNCTION public.lf_linked_attorney_identifications(p_grant_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'category', item ->> 'category', 'institution', item ->> 'institution'))
    FROM pg_catalog.jsonb_array_elements(g.attorney_identification) AS entries(item)
    WHERE COALESCE(g.permissions_override -> 'asset_ids', '[]'::jsonb) ? (item ->> 'asset_id')
  ), '[]'::jsonb)
  FROM public.account_access_grants g
  WHERE g.id = p_grant_id AND g.linked_user_id = auth.uid()
    AND g.assigned_role = 'power_of_attorney'
    AND g.activation_status IN ('verified', 'active')
    AND g.access_state = 'ATTORNEY_LIMITED'
    AND g.attorney_owner_authorized_at IS NOT NULL
    AND g.attorney_authority_verified_at IS NOT NULL
    AND g.attorney_authority_verified_by IS NOT NULL
    AND g.attorney_authority_expires_at > pg_catalog.now()
    AND public.lf_identity_assurance_level(g.linked_user_id) >= g.required_identity_level
    AND public.lf_vault_lifecycle_state(g.owner_user_id) = 'OWNER_ACTIVE';
$$;
REVOKE ALL ON FUNCTION public.lf_linked_attorney_identifications(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_linked_attorney_identifications(uuid) TO authenticated;

-- Only the protected staff API's service-role client may record a reviewed
-- authority decision. The actor must also have an active, appropriate role.
CREATE FUNCTION public.lf_authorize_linked_release(
  p_grant_id uuid, p_state text, p_scope jsonb, p_claim_id uuid,
  p_authority_expires_at timestamptz, p_authority_reference text,
  p_actor_user_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_grant public.account_access_grants%ROWTYPE;
  v_claim public.estate_access_claims%ROWTYPE;
  v_role text;
  v_key text;
  v_id text;
  v_item jsonb;
  v_clean_identification jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Staff service role required';
  END IF;
  IF pg_catalog.length(pg_catalog.btrim(COALESCE(p_reason, ''))) < 12 THEN
    RAISE EXCEPTION 'Documented review reason required';
  END IF;
  SELECT role INTO v_role FROM public.admin_users
  WHERE user_id = p_actor_user_id AND status = 'active';
  IF v_role IS NULL OR
    (p_state IN ('ESTATE_RELEASED', 'REVOKED') AND v_role NOT IN ('super_admin', 'probate_reviewer')) OR
    (p_state = 'ATTORNEY_LIMITED' AND v_role NOT IN ('super_admin', 'verification_reviewer')) THEN
    RAISE EXCEPTION 'Reviewer role is not authorised';
  END IF;
  IF p_state NOT IN ('ESTATE_RELEASED', 'ATTORNEY_LIMITED', 'REVOKED') THEN
    RAISE EXCEPTION 'Invalid release decision';
  END IF;
  SELECT * INTO v_grant FROM public.account_access_grants WHERE id = p_grant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Grant not found'; END IF;
  IF p_state = 'REVOKED' AND v_grant.access_state = 'REVOKED' THEN RETURN p_grant_id; END IF;
  IF v_grant.activation_status NOT IN ('verified', 'active') THEN
    RAISE EXCEPTION 'Verified active grant required';
  END IF;
  IF p_state = 'REVOKED' THEN
    UPDATE public.account_access_grants SET access_state = 'REVOKED',
      activation_status = 'revoked', updated_at = pg_catalog.now() WHERE id = p_grant_id;
  ELSIF p_state = 'ESTATE_RELEASED' THEN
    IF p_claim_id IS NULL OR pg_catalog.jsonb_typeof(p_scope) <> 'object'
       OR public.lf_vault_lifecycle_state(v_grant.owner_user_id) <> 'ESTATE_LOCKED' THEN
      RAISE EXCEPTION 'Confirmed estate and explicit scope required';
    END IF;
    SELECT * INTO v_claim FROM public.estate_access_claims WHERE id = p_claim_id;
    IF NOT FOUND OR v_claim.access_grant_id IS DISTINCT FROM p_grant_id
      OR v_claim.owner_user_id IS DISTINCT FROM v_grant.owner_user_id
      OR v_claim.claimant_user_id IS DISTINCT FROM v_grant.linked_user_id
      OR v_claim.status <> 'active' OR v_claim.authority_evidence_status <> 'accepted'
      OR v_claim.approved_at IS NULL OR v_claim.approved_by_user_id IS NULL
      OR v_claim.revoked_at IS NOT NULL
      OR NOT EXISTS (SELECT 1 FROM public.death_reports d
        WHERE d.id = v_claim.death_report_id AND d.status = 'confirmed'
          AND d.owner_user_id = v_grant.owner_user_id
          AND d.claimant_user_id = v_grant.linked_user_id) THEN
      RAISE EXCEPTION 'Verified death and approved legal authority required';
    END IF;
    IF p_scope - 'asset_ids' - 'record_ids' - 'document_ids' <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Unsupported release scope';
    END IF;
    FOREACH v_key IN ARRAY ARRAY['asset_ids', 'record_ids', 'document_ids'] LOOP
      IF pg_catalog.jsonb_typeof(COALESCE(p_scope -> v_key, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'Release scope must be arrays';
      END IF;
      FOR v_id IN SELECT item FROM pg_catalog.jsonb_array_elements_text(
        COALESCE(p_scope -> v_key, '[]'::jsonb)) AS entries(item) LOOP
        IF NOT (COALESCE(v_grant.permissions_override -> v_key, '[]'::jsonb) ? v_id)
          OR (v_key = 'asset_ids' AND NOT EXISTS
            (SELECT 1 FROM public.assets a WHERE a.id = v_id::uuid AND a.owner_user_id = v_grant.owner_user_id))
          OR (v_key = 'record_ids' AND NOT EXISTS
            (SELECT 1 FROM public.records r WHERE r.id = v_id::uuid AND r.owner_user_id = v_grant.owner_user_id)
            AND NOT EXISTS (SELECT 1 FROM public.section_entries e
              WHERE e.id = v_id::uuid AND e.user_id = v_grant.owner_user_id))
          OR (v_key = 'document_ids' AND NOT EXISTS
            (SELECT 1 FROM public.documents d WHERE d.id = v_id::uuid AND d.owner_user_id = v_grant.owner_user_id))
        THEN RAISE EXCEPTION 'Released record must be owner-designated and owned'; END IF;
      END LOOP;
    END LOOP;
    IF COALESCE(pg_catalog.jsonb_array_length(COALESCE(p_scope -> 'asset_ids', '[]'::jsonb)), 0)
       + COALESCE(pg_catalog.jsonb_array_length(COALESCE(p_scope -> 'record_ids', '[]'::jsonb)), 0)
       + COALESCE(pg_catalog.jsonb_array_length(COALESCE(p_scope -> 'document_ids', '[]'::jsonb)), 0) = 0 THEN
      RAISE EXCEPTION 'At least one specific record must be released';
    END IF;
    UPDATE public.account_access_grants SET access_state = 'ESTATE_RELEASED',
      release_scope = p_scope, release_claim_id = p_claim_id,
      release_authorized_at = pg_catalog.now(), release_authorized_by = p_actor_user_id,
      updated_at = pg_catalog.now() WHERE id = p_grant_id;
  ELSE
    IF v_grant.assigned_role <> 'power_of_attorney' OR p_claim_id IS NOT NULL
       OR v_grant.attorney_owner_authorized_at IS NULL
       OR pg_catalog.jsonb_typeof(p_scope) <> 'array'
       OR p_authority_expires_at IS NULL OR p_authority_expires_at <= pg_catalog.now()
       OR COALESCE(pg_catalog.btrim(p_authority_reference), '') = ''
       OR public.lf_vault_lifecycle_state(v_grant.owner_user_id) <> 'OWNER_ACTIVE' THEN
      RAISE EXCEPTION 'Current Property and Financial Affairs authority required';
    END IF;
    FOR v_item IN SELECT item FROM pg_catalog.jsonb_array_elements(p_scope) AS entries(item) LOOP
      v_id := v_item ->> 'asset_id';
      IF v_id IS NULL OR NOT (COALESCE(v_grant.permissions_override -> 'asset_ids', '[]'::jsonb) ? v_id)
        OR NOT EXISTS (SELECT 1 FROM public.assets a
          WHERE a.id = v_id::uuid AND a.owner_user_id = v_grant.owner_user_id
            AND a.provider_name = (v_item ->> 'institution'))
        OR COALESCE(pg_catalog.btrim(v_item ->> 'category'), '') = ''
        OR v_item ->> 'category' NOT IN ('Bank', 'Pension', 'Investment', 'Insurance', 'Property', 'Business')
        OR COALESCE(pg_catalog.btrim(v_item ->> 'institution'), '') = ''
        OR pg_catalog.length(v_item ->> 'institution') > 80
        OR (v_item ->> 'institution') ~ '[0-9@/\\]' THEN
        RAISE EXCEPTION 'Attorney identification must be approved and privacy-safe';
      END IF;
      v_clean_identification := v_clean_identification || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('asset_id', v_id, 'category', v_item ->> 'category',
          'institution', v_item ->> 'institution'));
    END LOOP;
    IF pg_catalog.jsonb_array_length(v_clean_identification) = 0 THEN
      RAISE EXCEPTION 'Specific attorney identification is required';
    END IF;
    UPDATE public.account_access_grants SET access_state = 'ATTORNEY_LIMITED',
      release_scope = '{}'::jsonb, release_claim_id = NULL,
      attorney_identification = v_clean_identification,
      attorney_authority_verified_at = pg_catalog.now(),
      attorney_authority_verified_by = p_actor_user_id,
      attorney_authority_expires_at = p_authority_expires_at,
      attorney_authority_reference = pg_catalog.left(p_authority_reference, 160),
      updated_at = pg_catalog.now() WHERE id = p_grant_id;
  END IF;
  INSERT INTO public.audit_events
    (category, action, result, actor_user_id, resource_type, resource_id, route, metadata)
  VALUES ('access', 'linked_release_decision', 'success', p_actor_user_id,
    'account_access_grant', p_grant_id::text, 'database:lf_authorize_linked_release',
    pg_catalog.jsonb_build_object('state', p_state, 'claim_id', p_claim_id,
      'reason', pg_catalog.left(p_reason, 500),
      'scope_count', CASE WHEN p_state = 'ESTATE_RELEASED'
        THEN pg_catalog.jsonb_array_length(COALESCE(p_scope -> 'asset_ids', '[]'::jsonb))
           + pg_catalog.jsonb_array_length(COALESCE(p_scope -> 'record_ids', '[]'::jsonb))
           + pg_catalog.jsonb_array_length(COALESCE(p_scope -> 'document_ids', '[]'::jsonb))
        ELSE pg_catalog.jsonb_array_length(v_clean_identification) END));
  RETURN p_grant_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_authorize_linked_release(
  uuid, text, jsonb, uuid, timestamptz, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lf_authorize_linked_release(
  uuid, text, jsonb, uuid, timestamptz, text, uuid, text) TO service_role;

-- The earlier notification migration records owner selections. Label those
-- selections honestly: they designate possible access and never unlock it.
CREATE FUNCTION public.lf_label_recipient_designation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.payload ->> 'source' = 'grant_commit' THEN
    IF NEW.event_type = 'recipient_record_access_updated' THEN
      NEW.event_type := 'recipient_records_designated';
    ELSIF NEW.event_type = 'recipient_record_access_revoked' THEN
      NEW.event_type := 'recipient_designation_revoked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_label_recipient_designation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lf_label_recipient_designation
  BEFORE INSERT ON public.invitation_events
  FOR EACH ROW EXECUTE FUNCTION public.lf_label_recipient_designation();

CREATE FUNCTION public.lf_notify_linked_release_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invitation_id uuid; v_event_id uuid; v_type text;
BEGIN
  IF OLD.access_state IS NOT DISTINCT FROM NEW.access_state THEN RETURN NEW; END IF;
  SELECT ci.id INTO v_invitation_id FROM public.contact_invitations ci
  WHERE ci.owner_user_id = NEW.owner_user_id
    AND ci.accepted_user_id = NEW.linked_user_id
    AND (NEW.access_state = 'REVOKED'
      OR (ci.invitation_status = 'accepted' AND ci.revoked_at IS NULL))
    AND (NEW.invitation_id IS NULL OR ci.id = NEW.invitation_id)
  ORDER BY ci.accepted_at DESC NULLS LAST LIMIT 1;
  IF v_invitation_id IS NULL THEN RETURN NEW; END IF;
  v_type := CASE NEW.access_state
    WHEN 'ESTATE_RELEASED' THEN 'recipient_estate_released'
    WHEN 'ATTORNEY_LIMITED' THEN 'recipient_attorney_limited'
    WHEN 'REVOKED' THEN 'recipient_release_revoked'
    ELSE 'recipient_release_locked' END;
  INSERT INTO public.invitation_events (owner_user_id, invitation_id, event_type, payload)
  VALUES (NEW.linked_user_id, v_invitation_id, v_type,
    pg_catalog.jsonb_build_object('source', 'release_state_commit',
      'in_app_status', 'available', 'email_status', 'not_configured'))
  RETURNING id INTO v_event_id;
  INSERT INTO public.audit_events
    (category, action, result, actor_user_id, resource_type, resource_id, route, metadata)
  VALUES ('access', 'recipient_release_notification_created', 'success',
    auth.uid(), 'account_access_grant', NEW.id::text,
    'database:account_access_grants', pg_catalog.jsonb_build_object(
      'notification_id', v_event_id, 'state', NEW.access_state,
      'in_app_status', 'available', 'email_status', 'not_configured'));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_notify_linked_release_state() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lf_notify_linked_release_state
  AFTER UPDATE ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.lf_notify_linked_release_state();
