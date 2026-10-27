-- PR 1: additive, owner-scoped linked-person foundation. No invitation or grant is sent/created.
-- Existing contacts are the canonical People rows. Existing contact_links and record_contacts
-- remain untouched because their current uniqueness and legacy readers serve other flows.

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_invite_status_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_invite_status_check
  CHECK (invite_status IN (
    'not_invited','invite_sent','accepted','rejected','failed','revoked',
    'not_delivered','expired'
  )) NOT VALID;

-- Expired already exists on this table; retain all existing states and add Not delivered.
ALTER TABLE public.contact_invitations DROP CONSTRAINT IF EXISTS contact_invitations_status_check;
ALTER TABLE public.contact_invitations ADD CONSTRAINT contact_invitations_status_check
  CHECK (invitation_status IN (
    'draft','pending','sent','accepted','identity_required','verification_submitted',
    'verified','active','delivery_failed','failed','not_delivered','expired',
    'revoked','rejected'
  )) NOT VALID;

CREATE TABLE public.extraction_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  page integer NOT NULL CHECK (page > 0),
  extracted_name text NOT NULL CHECK (length(btrim(extracted_name)) BETWEEN 1 AND 120),
  extracted_role text CHECK (extracted_role IS NULL OR length(btrim(extracted_role)) BETWEEN 1 AND 60),
  match_person_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  match_kind text NOT NULL CHECK (match_kind IN ('exact','possible','none')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','edited','dismissed')),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT extraction_suggestion_decision_check CHECK (
    (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status <> 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE INDEX extraction_suggestions_owner_record_idx
  ON public.extraction_suggestions (owner_user_id, record_id, status, created_at DESC);

-- Canonical assets and legacy records share a UUID column but keep distinct owner checks.
-- Suggestions currently require canonical documents, which are attached to assets.
CREATE TABLE public.record_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id uuid NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('asset','record')),
  person_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (length(btrim(role)) BETWEEN 1 AND 60),
  role_other_text text CHECK (role_other_text IS NULL OR length(btrim(role_other_text)) BETWEEN 1 AND 60),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','extraction')),
  manual_origin text CHECK (manual_origin IS NULL OR manual_origin IN ('new','people')),
  source_document_id uuid REFERENCES public.documents(id) ON DELETE RESTRICT,
  source_page integer CHECK (source_page IS NULL OR source_page > 0),
  suggestion_id uuid REFERENCES public.extraction_suggestions(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  removed_at timestamptz,
  CONSTRAINT record_links_other_role_check CHECK (
    lower(btrim(role)) <> 'other' OR role_other_text IS NOT NULL
  ),
  CONSTRAINT record_links_provenance_check CHECK (
    (source = 'manual' AND manual_origin IS NOT NULL
      AND source_document_id IS NULL AND source_page IS NULL AND suggestion_id IS NULL)
    OR (source = 'extraction' AND manual_origin IS NULL
      AND source_document_id IS NOT NULL AND source_page IS NOT NULL AND suggestion_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX record_links_active_person_unique_idx
  ON public.record_links (owner_user_id, record_type, record_id, person_id)
  WHERE removed_at IS NULL;
CREATE INDEX record_links_owner_record_idx
  ON public.record_links (owner_user_id, record_type, record_id, created_at DESC);
CREATE INDEX record_links_owner_person_idx
  ON public.record_links (owner_user_id, person_id, created_at DESC);

CREATE SCHEMA IF NOT EXISTS lf_linked_people_private;
REVOKE ALL ON SCHEMA lf_linked_people_private FROM PUBLIC, anon, authenticated;

-- Trigger checks also protect privileged writes and keep polymorphic record IDs honest.
CREATE FUNCTION lf_linked_people_private.validate_suggestion()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'Suggestions start pending until owner review';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = NEW.document_id AND d.owner_user_id = NEW.owner_user_id
      AND d.asset_id = NEW.record_id AND d.deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.assets a
    WHERE a.id = NEW.record_id AND a.owner_user_id = NEW.owner_user_id AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Suggestion document and record must belong to the same owner';
  END IF;
  IF NEW.match_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contacts p WHERE p.id = NEW.match_person_id AND p.owner_user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'Suggested person must belong to the same owner';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.owner_user_id, NEW.document_id, NEW.record_id, NEW.page, NEW.created_at)
       IS DISTINCT FROM
       (OLD.owner_user_id, OLD.document_id, OLD.record_id, OLD.page, OLD.created_at) THEN
      RAISE EXCEPTION 'Suggestion provenance is immutable';
    END IF;
    IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'A decided suggestion cannot change state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER extraction_suggestions_validate
  BEFORE INSERT OR UPDATE ON public.extraction_suggestions
  FOR EACH ROW EXECUTE FUNCTION lf_linked_people_private.validate_suggestion();

CREATE FUNCTION lf_linked_people_private.validate_record_link()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'A new link cannot start removed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contacts p WHERE p.id = NEW.person_id AND p.owner_user_id = NEW.owner_user_id
  ) OR NEW.created_by <> NEW.owner_user_id THEN
    RAISE EXCEPTION 'Linked person and actor must belong to the owner';
  END IF;
  IF NEW.record_type = 'asset' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = NEW.record_id AND a.owner_user_id = NEW.owner_user_id AND a.deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'Asset is unavailable to this owner'; END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.records r WHERE r.id = NEW.record_id AND r.owner_user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'Record is unavailable to this owner';
  END IF;
  IF NEW.source = 'extraction' THEN
    IF NEW.record_type <> 'asset' OR NOT EXISTS (
      SELECT 1 FROM public.extraction_suggestions s
      WHERE s.id = NEW.suggestion_id AND s.owner_user_id = NEW.owner_user_id
        AND s.record_id = NEW.record_id AND s.document_id = NEW.source_document_id
        AND s.page = NEW.source_page AND s.status IN ('accepted','edited')
    ) THEN
      RAISE EXCEPTION 'Only an owner-confirmed suggestion can become a link';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.owner_user_id, NEW.record_id, NEW.record_type, NEW.person_id,
        NEW.source, NEW.manual_origin, NEW.source_document_id, NEW.source_page, NEW.suggestion_id,
        NEW.created_by, NEW.created_at)
       IS DISTINCT FROM
       (OLD.owner_user_id, OLD.record_id, OLD.record_type, OLD.person_id,
        OLD.source, OLD.manual_origin, OLD.source_document_id, OLD.source_page, OLD.suggestion_id,
        OLD.created_by, OLD.created_at) THEN
      RAISE EXCEPTION 'Linked person identity and provenance are immutable';
    END IF;
    IF OLD.removed_at IS NOT NULL
       AND (NEW.role, NEW.role_other_text, NEW.removed_at)
           IS DISTINCT FROM (OLD.role, OLD.role_other_text, OLD.removed_at) THEN
      RAISE EXCEPTION 'A removed link cannot be restored or changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_links_validate
  BEFORE INSERT OR UPDATE ON public.record_links
  FOR EACH ROW EXECUTE FUNCTION lf_linked_people_private.validate_record_link();

-- Append-only audit rows record the actor and record ID, never contact details or document text.
CREATE FUNCTION lf_linked_people_private.audit_linked_people()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_action text;
  v_record_type text;
  v_record_id uuid;
  v_metadata jsonb;
  v_actor uuid;
BEGIN
  IF TG_TABLE_NAME = 'record_links' THEN
    IF TG_OP = 'INSERT' THEN
      v_action := 'link.created';
    ELSIF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL THEN
      v_action := 'link.removed';
    ELSIF (OLD.role, OLD.role_other_text) IS DISTINCT FROM (NEW.role, NEW.role_other_text) THEN
      v_action := 'link.role_changed';
    ELSE
      RETURN NEW;
    END IF;
    v_record_type := NEW.record_type;
    v_record_id := NEW.record_id;
    v_actor := COALESCE(auth.uid(), NEW.created_by);
    v_metadata := jsonb_build_object(
      'link_id', NEW.id, 'source', NEW.source, 'manual_origin', NEW.manual_origin,
      'document_id', NEW.source_document_id, 'page', NEW.source_page
    );
  ELSE
    IF OLD.status = NEW.status THEN RETURN NEW; END IF;
    v_action := 'suggestion.' || NEW.status;
    v_record_type := 'asset';
    v_record_id := NEW.record_id;
    v_actor := COALESCE(auth.uid(), NEW.decided_by);
    v_metadata := jsonb_build_object(
      'suggestion_id', NEW.id, 'document_id', NEW.document_id, 'page', NEW.page
    );
  END IF;
  INSERT INTO public.audit_events (
    category, action, result, actor_user_id, resource_type, resource_id,
    route, policy_decision, metadata
  ) VALUES (
    'linked_people', v_action, 'success', v_actor, v_record_type,
    v_record_id::text, 'linked_people', 'allowed', v_metadata
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_links_audit
  AFTER INSERT OR UPDATE ON public.record_links
  FOR EACH ROW EXECUTE FUNCTION lf_linked_people_private.audit_linked_people();
CREATE TRIGGER extraction_suggestions_audit
  AFTER UPDATE OF status ON public.extraction_suggestions
  FOR EACH ROW EXECUTE FUNCTION lf_linked_people_private.audit_linked_people();

REVOKE ALL ON FUNCTION lf_linked_people_private.validate_suggestion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lf_linked_people_private.validate_record_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lf_linked_people_private.audit_linked_people() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.record_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY record_links_owner_select ON public.record_links
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY record_links_owner_insert ON public.record_links
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = owner_user_id
    AND created_by = owner_user_id
    AND public.lf_vault_allows_owner_mutation(owner_user_id)
  );
CREATE POLICY record_links_owner_update ON public.record_links
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id))
  WITH CHECK ((SELECT auth.uid()) = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
-- No DELETE policy: removal is a soft update of this link only.

CREATE POLICY extraction_suggestions_owner_select ON public.extraction_suggestions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_user_id);
-- No client INSERT/UPDATE/DELETE policy. A future permission-checked extraction API
-- must write suggestions; owner confirmation must be atomic with any person/link creation.
REVOKE INSERT, UPDATE, DELETE ON public.extraction_suggestions FROM anon, authenticated;
REVOKE ALL ON public.extraction_suggestions FROM anon;
GRANT SELECT ON public.extraction_suggestions TO authenticated;
REVOKE ALL ON public.record_links FROM anon;
REVOKE DELETE ON public.record_links FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.record_links TO authenticated;

-- Rollback before use: drop both tables and the private functions/schema; restore
-- the prior invitation CHECK lists. Never drop contacts, existing links or grants.
