-- PR 4: owner review of an existing, evidence-backed suggestion. This does not
-- ingest or extract documents and does not alter access grants or legacy links.
CREATE FUNCTION public.lf_review_linked_person_suggestion(
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
  IF NOT EXISTS (
    SELECT 1 FROM public.documents d JOIN public.assets a ON a.id = d.asset_id
    WHERE d.id = v_suggestion.document_id AND d.owner_user_id = v_owner
      AND d.asset_id = v_suggestion.record_id AND d.deleted_at IS NULL
      AND a.owner_user_id = v_owner AND a.deleted_at IS NULL
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
    WHERE l.owner_user_id = v_owner AND l.record_type = 'asset'
      AND l.record_id = v_suggestion.record_id AND l.person_id = v_person
      AND l.removed_at IS NULL;
  IF v_link IS NULL THEN
    INSERT INTO public.record_links (owner_user_id, record_type, record_id,
      person_id, role, role_other_text, source, source_document_id, source_page,
      suggestion_id, created_by)
    VALUES (v_owner, 'asset', v_suggestion.record_id, v_person, v_role,
      CASE WHEN lower(v_role) = 'other' THEN v_other ELSE NULL END,
      'extraction', v_suggestion.document_id, v_suggestion.page, p_suggestion_id, v_owner)
    RETURNING id INTO v_link;
  END IF;
  RETURN QUERY SELECT v_person, v_link, v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.lf_review_linked_person_suggestion(uuid,text,text,uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_review_linked_person_suggestion(uuid,text,text,uuid,text,text,text,text,text) TO authenticated;
