-- Document suggestions for Legal records (Wills, LPAs, trusts...). Those are stored in
-- public.records with files in public.attachments, not assets/documents. This extends
-- suggestions and links to that pair while keeping every existing rule: owner checks,
-- Vault-lock check, duplicate-person protection, immutable provenance and audit.

-- 1. Suggestions can point at an asset document OR a record attachment.
ALTER TABLE public.extraction_suggestions DROP CONSTRAINT IF EXISTS extraction_suggestions_record_id_fkey;
ALTER TABLE public.extraction_suggestions
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'asset',
  ADD COLUMN IF NOT EXISTS attachment_id uuid REFERENCES public.attachments(id) ON DELETE CASCADE;
ALTER TABLE public.extraction_suggestions ALTER COLUMN document_id DROP NOT NULL;
ALTER TABLE public.extraction_suggestions DROP CONSTRAINT IF EXISTS extraction_suggestions_record_type_check;
ALTER TABLE public.extraction_suggestions ADD CONSTRAINT extraction_suggestions_record_type_check CHECK (record_type IN ('asset','record'));
ALTER TABLE public.extraction_suggestions DROP CONSTRAINT IF EXISTS extraction_suggestions_source_check;
ALTER TABLE public.extraction_suggestions ADD CONSTRAINT extraction_suggestions_source_check CHECK (
  (record_type = 'asset' AND document_id IS NOT NULL AND attachment_id IS NULL)
  OR (record_type = 'record' AND attachment_id IS NOT NULL AND document_id IS NULL)
);
DROP INDEX IF EXISTS extraction_suggestions_owner_record_idx;
CREATE INDEX extraction_suggestions_owner_record_idx
  ON public.extraction_suggestions (owner_user_id, record_type, record_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION lf_linked_people_private.validate_suggestion()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'Suggestions start pending until owner review';
  END IF;
  IF NEW.record_type = 'asset' THEN
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
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.attachments t JOIN public.records r ON r.id = t.record_id
    WHERE t.id = NEW.attachment_id AND t.owner_user_id = NEW.owner_user_id
      AND t.record_id = NEW.record_id AND r.owner_user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'Suggestion document and record must belong to the same owner';
  END IF;
  IF NEW.match_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contacts p WHERE p.id = NEW.match_person_id AND p.owner_user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'Suggested person must belong to the same owner';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.owner_user_id, NEW.record_type, NEW.document_id, NEW.attachment_id, NEW.record_id, NEW.page, NEW.created_at)
       IS DISTINCT FROM
       (OLD.owner_user_id, OLD.record_type, OLD.document_id, OLD.attachment_id, OLD.record_id, OLD.page, OLD.created_at) THEN
      RAISE EXCEPTION 'Suggestion provenance is immutable';
    END IF;
    IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'A decided suggestion cannot change state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Links can carry an attachment as their document source.
ALTER TABLE public.record_links
  ADD COLUMN IF NOT EXISTS source_attachment_id uuid REFERENCES public.attachments(id) ON DELETE RESTRICT;
ALTER TABLE public.record_links DROP CONSTRAINT IF EXISTS record_links_provenance_check;
ALTER TABLE public.record_links ADD CONSTRAINT record_links_provenance_check CHECK (
  (source = 'manual' AND manual_origin IS NOT NULL AND source_document_id IS NULL AND source_attachment_id IS NULL
    AND source_page IS NULL AND suggestion_id IS NULL)
  OR (source = 'extraction' AND manual_origin IS NULL AND source_page IS NOT NULL AND suggestion_id IS NOT NULL
    AND ((source_document_id IS NOT NULL AND source_attachment_id IS NULL) OR (source_document_id IS NULL AND source_attachment_id IS NOT NULL)))
);

CREATE OR REPLACE FUNCTION lf_linked_people_private.validate_record_link()
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
  IF NEW.source = 'extraction' AND NOT EXISTS (
    SELECT 1 FROM public.extraction_suggestions s
    WHERE s.id = NEW.suggestion_id AND s.owner_user_id = NEW.owner_user_id
      AND s.record_type = NEW.record_type AND s.record_id = NEW.record_id
      AND s.document_id IS NOT DISTINCT FROM NEW.source_document_id
      AND s.attachment_id IS NOT DISTINCT FROM NEW.source_attachment_id
      AND s.page = NEW.source_page AND s.status IN ('accepted','edited')
  ) THEN
    RAISE EXCEPTION 'Only an owner-confirmed suggestion can become a link';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.owner_user_id, NEW.record_id, NEW.record_type, NEW.person_id,
        NEW.source, NEW.manual_origin, NEW.source_document_id, NEW.source_attachment_id, NEW.source_page, NEW.suggestion_id,
        NEW.created_by, NEW.created_at)
       IS DISTINCT FROM
       (OLD.owner_user_id, OLD.record_id, OLD.record_type, OLD.person_id,
        OLD.source, OLD.manual_origin, OLD.source_document_id, OLD.source_attachment_id, OLD.source_page, OLD.suggestion_id,
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

-- 3. Owner review works for both kinds of source. Same checks as PR 4.
CREATE OR REPLACE FUNCTION public.lf_review_linked_person_suggestion(
  p_suggestion_id uuid,
  p_decision text,
  p_choice text DEFAULT NULL,
  p_person_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_role_other_text text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
) RETURNS TABLE (person_id uuid, link_id uuid, decision_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_suggestion public.extraction_suggestions%ROWTYPE;
  v_name text := btrim(p_name);
  v_role text := btrim(p_role);
  v_other text := NULLIF(btrim(p_role_other_text), '');
  v_email text := NULLIF(lower(btrim(p_email)), '');
  v_phone text := NULLIF(btrim(p_phone), '');
  v_person uuid;
  v_link uuid;
  v_status text;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_suggestion FROM public.extraction_suggestions s
    WHERE s.id = p_suggestion_id AND s.owner_user_id = v_owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion unavailable to this owner'; END IF;
  IF v_suggestion.status <> 'pending' THEN RAISE EXCEPTION 'Suggestion was already reviewed'; END IF;
  IF NOT public.lf_vault_allows_owner_mutation(v_owner) THEN
    RAISE EXCEPTION 'Vault is locked or unavailable for changes';
  END IF;
  IF v_suggestion.record_type = 'asset' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.documents d JOIN public.assets a ON a.id = d.asset_id
      WHERE d.id = v_suggestion.document_id AND d.owner_user_id = v_owner
        AND d.asset_id = v_suggestion.record_id AND d.deleted_at IS NULL
        AND a.owner_user_id = v_owner AND a.deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'Source document or record is unavailable'; END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.attachments t JOIN public.records r ON r.id = t.record_id
    WHERE t.id = v_suggestion.attachment_id AND t.owner_user_id = v_owner
      AND t.record_id = v_suggestion.record_id AND r.owner_user_id = v_owner
  ) THEN RAISE EXCEPTION 'Source document or record is unavailable'; END IF;

  IF p_decision = 'dismiss' THEN
    UPDATE public.extraction_suggestions SET status = 'dismissed',
      decided_by = v_owner, decided_at = timezone('utc', now())
      WHERE id = p_suggestion_id;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, 'dismissed'::text;
    RETURN;
  END IF;
  IF p_decision <> 'confirm' OR p_choice NOT IN ('existing', 'new') THEN
    RAISE EXCEPTION 'Choose an explicit review action';
  END IF;
  IF v_role IS NULL OR length(v_role) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Choose a role for this record';
  END IF;
  IF lower(v_role) = 'other' AND (v_other IS NULL OR length(v_other) > 60) THEN
    RAISE EXCEPTION 'Describe the other role';
  END IF;
  IF p_choice = 'existing' THEN
    IF p_person_id IS NULL OR v_email IS NOT NULL OR v_phone IS NOT NULL THEN
      RAISE EXCEPTION 'Choose an existing person without changing their contact details';
    END IF;
    SELECT c.id INTO v_person FROM public.contacts c
      WHERE c.id = p_person_id AND c.owner_user_id = v_owner;
    IF v_person IS NULL THEN RAISE EXCEPTION 'Person unavailable to this owner'; END IF;
  ELSE
    IF p_person_id IS NOT NULL OR v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Enter a name for the new person';
    END IF;
    IF v_email IS NOT NULL AND (length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
      RAISE EXCEPTION 'Enter a valid email address';
    END IF;
    IF v_phone IS NOT NULL AND (v_phone !~ '^\+?[0-9]{7,15}$') THEN
      RAISE EXCEPTION 'Enter a telephone number with 7 to 15 digits';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.contacts c WHERE c.owner_user_id = v_owner
      AND ((v_email IS NOT NULL AND c.email_normalized = v_email)
        OR lower(btrim(c.full_name)) = lower(v_name))
    ) THEN RAISE EXCEPTION 'A matching person exists in People; review and select them'; END IF;
    INSERT INTO public.contacts (owner_user_id, full_name, email, email_normalized,
      phone, source_type, invite_status, verification_status)
    VALUES (v_owner, v_name, v_email, v_email, v_phone, 'manual', 'not_invited', 'not_verified')
    RETURNING id INTO v_person;
  END IF;

  v_status := CASE WHEN p_choice = 'new' AND v_name = v_suggestion.extracted_name
    AND v_role = COALESCE(v_suggestion.extracted_role, '') THEN 'accepted' ELSE 'edited' END;
  UPDATE public.extraction_suggestions SET status = v_status,
    decided_by = v_owner, decided_at = timezone('utc', now())
    WHERE id = p_suggestion_id;
  SELECT l.id INTO v_link FROM public.record_links l
    WHERE l.owner_user_id = v_owner AND l.record_type = v_suggestion.record_type
      AND l.record_id = v_suggestion.record_id AND l.person_id = v_person
      AND l.removed_at IS NULL;
  IF v_link IS NULL THEN
    INSERT INTO public.record_links (owner_user_id, record_type, record_id,
      person_id, role, role_other_text, source, source_document_id, source_attachment_id, source_page,
      suggestion_id, created_by)
    VALUES (v_owner, v_suggestion.record_type, v_suggestion.record_id, v_person, v_role,
      CASE WHEN lower(v_role) = 'other' THEN v_other ELSE NULL END,
      'extraction', v_suggestion.document_id, v_suggestion.attachment_id, v_suggestion.page, p_suggestion_id, v_owner)
    RETURNING id INTO v_link;
  END IF;
  RETURN QUERY SELECT v_person, v_link, v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_review_linked_person_suggestion(uuid,text,text,uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_review_linked_person_suggestion(uuid,text,text,uuid,text,text,text,text,text) TO authenticated;
