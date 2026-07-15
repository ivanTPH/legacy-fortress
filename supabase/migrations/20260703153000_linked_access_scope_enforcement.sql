-- Phase 4 security remediation: linked-access scope enforcement.
--
-- Threat addressed:
-- Previously, linked users with any active owner grant could read broad owner rows
-- through REST/RLS even when the UI filtered down to a probate-case scope.
--
-- Grant-scope rule:
-- Linked reads are now allowed only for explicitly scoped assets/records/documents
-- listed in permissions_override or linked to the grant contact through canonical
-- contact_links / record_contacts.
--
-- Revocation behaviour:
-- All helpers require activation_status in accepted/verified/active. Revoked,
-- rejected, pending and expired grants stop matching immediately at RLS level.
--
-- Affected policies:
-- organisations, wallets, assets, documents, records, attachments,
-- record_contacts, contacts, contact_links, section_entries, storage.objects,
-- contact_details and addresses linked-select policies.

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
        AND g.linked_user_id = auth.uid()
        AND g.activation_status = ANY(ARRAY['accepted','verified','active'])
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
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF p_bucket_id <> 'vault-docs' THEN
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
      AND g.linked_user_id = auth.uid()
      AND g.activation_status = ANY(ARRAY['accepted','verified','active'])
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

REVOKE ALL ON FUNCTION public.linked_grant_allows_asset(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_record(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_section_entry(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_document(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.linked_grant_allows_storage_object(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_asset(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_record(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_section_entry(uuid, uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_document(uuid, uuid, uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.linked_grant_allows_storage_object(text, text) TO authenticated, anon;

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
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.organisation_id = organisations.id
        AND public.linked_grant_allows_asset(a.owner_user_id, a.id)
    )
  );

CREATE POLICY wallets_linked_select ON public.wallets
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.wallet_id = wallets.id
        AND public.linked_grant_allows_asset(a.owner_user_id, a.id)
    )
  );

CREATE POLICY assets_linked_select ON public.assets
  FOR SELECT USING (
    public.linked_grant_allows_asset(owner_user_id, id)
  );

CREATE POLICY documents_linked_select ON public.documents
  FOR SELECT USING (
    public.linked_grant_allows_document(owner_user_id, id, asset_id, storage_bucket, storage_path)
  );

CREATE POLICY records_linked_select ON public.records
  FOR SELECT USING (
    public.linked_grant_allows_record(owner_user_id, id)
  );

CREATE POLICY attachments_linked_select ON public.attachments
  FOR SELECT USING (
    public.linked_grant_allows_record(owner_user_id, record_id)
  );

CREATE POLICY record_contacts_linked_select ON public.record_contacts
  FOR SELECT USING (
    public.linked_grant_allows_record(owner_user_id, record_id)
  );

CREATE POLICY contacts_linked_select ON public.contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.account_access_grants g
      WHERE g.owner_user_id = contacts.owner_user_id
        AND g.linked_user_id = auth.uid()
        AND g.contact_id = contacts.id
        AND g.activation_status = ANY(ARRAY['accepted','verified','active'])
    )
  );

CREATE POLICY contact_links_linked_select ON public.contact_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.account_access_grants g
      WHERE g.owner_user_id = contact_links.owner_user_id
        AND g.linked_user_id = auth.uid()
        AND g.contact_id = contact_links.contact_id
        AND g.activation_status = ANY(ARRAY['accepted','verified','active'])
    )
    AND (
      (contact_links.source_kind = 'asset' AND public.linked_grant_allows_asset(owner_user_id, source_id))
      OR (contact_links.source_kind = 'record' AND public.linked_grant_allows_record(owner_user_id, source_id))
    )
  );

CREATE POLICY section_entries_linked_select ON public.section_entries
  FOR SELECT USING (
    public.linked_grant_allows_section_entry(user_id, id, section_key)
  );

CREATE POLICY user_profiles_linked_select ON public.user_profiles
  FOR SELECT USING (
    public.has_linked_account_access(user_id, ARRAY['accepted','verified','active'])
  );

CREATE POLICY vault_docs_linked_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'vault-docs'
    AND public.linked_grant_allows_storage_object(bucket_id, name)
  );

DO $$
BEGIN
  IF to_regclass('public.contact_details') IS NOT NULL THEN
    DROP POLICY IF EXISTS contact_details_linked_select ON public.contact_details;
  END IF;
  IF to_regclass('public.addresses') IS NOT NULL THEN
    DROP POLICY IF EXISTS addresses_linked_select ON public.addresses;
  END IF;
END $$;
