-- Linked People: timed Undo after unlinking, and re-review of a document suggestion
-- after an incorrect link is removed. Removed links and decided suggestions stay
-- immutable: both actions add a NEW row that points back to the original, so history
-- and evidence are preserved. No invitation or access grant is created.

ALTER TABLE public.record_links
  ADD COLUMN IF NOT EXISTS restored_from_link_id uuid REFERENCES public.record_links(id) ON DELETE RESTRICT;
ALTER TABLE public.extraction_suggestions
  ADD COLUMN IF NOT EXISTS reopened_from_suggestion_id uuid REFERENCES public.extraction_suggestions(id) ON DELETE RESTRICT;

-- Undo: within 2 minutes of removal (the UI offers 10 seconds), restore by creating a new
-- active link with the same person, role and provenance. SECURITY INVOKER: RLS and the
-- existing validation trigger apply.
CREATE OR REPLACE FUNCTION public.lf_undo_record_link_removal(p_link_id uuid)
RETURNS TABLE (link_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_old public.record_links%ROWTYPE;
  v_new uuid;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Sign in to undo.' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_old FROM public.record_links l WHERE l.id = p_link_id AND l.owner_user_id = v_owner;
  IF NOT FOUND OR v_old.removed_at IS NULL THEN
    RAISE EXCEPTION 'This link cannot be restored.' USING ERRCODE = '42501';
  END IF;
  IF v_old.removed_at < timezone('utc', now()) - interval '2 minutes' THEN
    RAISE EXCEPTION 'Undo is no longer available. Add the person again.' USING ERRCODE = '22023';
  END IF;
  SELECT l.id INTO v_new FROM public.record_links l
    WHERE l.owner_user_id = v_owner AND l.record_type = v_old.record_type AND l.record_id = v_old.record_id
      AND l.person_id = v_old.person_id AND l.removed_at IS NULL;
  IF v_new IS NULL THEN
    INSERT INTO public.record_links (owner_user_id, record_type, record_id, person_id, role, role_other_text,
      source, manual_origin, source_document_id, source_attachment_id, source_page, suggestion_id, created_by, restored_from_link_id)
    VALUES (v_owner, v_old.record_type, v_old.record_id, v_old.person_id, v_old.role, v_old.role_other_text,
      v_old.source, v_old.manual_origin, v_old.source_document_id, v_old.source_attachment_id, v_old.source_page, v_old.suggestion_id, v_owner, v_old.id)
    RETURNING id INTO v_new;
  END IF;
  RETURN QUERY SELECT v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_undo_record_link_removal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lf_undo_record_link_removal(uuid) TO authenticated;

-- Re-review: after the owner removes a link that came from a document, they can put the
-- finding back in "We found in this document" as a fresh pending suggestion (no match
-- pre-selected). There is no client INSERT policy on suggestions, so this is SECURITY
-- DEFINER with explicit owner checks; the suggestion validation trigger still runs.
CREATE OR REPLACE FUNCTION public.lf_reopen_linked_person_suggestion(p_link_id uuid)
RETURNS TABLE (suggestion_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_link public.record_links%ROWTYPE;
  v_original public.extraction_suggestions%ROWTYPE;
  v_new uuid;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Sign in to review suggestions.' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_link FROM public.record_links l WHERE l.id = p_link_id AND l.owner_user_id = v_owner;
  IF NOT FOUND OR v_link.removed_at IS NULL OR v_link.source <> 'extraction' OR v_link.suggestion_id IS NULL THEN
    RAISE EXCEPTION 'Only a removed link from a document can be reviewed again.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_original FROM public.extraction_suggestions s WHERE s.id = v_link.suggestion_id AND s.owner_user_id = v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'The original suggestion is unavailable.' USING ERRCODE = '42501'; END IF;
  SELECT s.id INTO v_new FROM public.extraction_suggestions s
    WHERE s.owner_user_id = v_owner AND s.reopened_from_suggestion_id = v_original.id AND s.status = 'pending';
  IF v_new IS NULL THEN
    INSERT INTO public.extraction_suggestions (owner_user_id, record_type, document_id, attachment_id, record_id, page, extracted_name,
      extracted_role, match_person_id, match_kind, reopened_from_suggestion_id)
    VALUES (v_owner, v_original.record_type, v_original.document_id, v_original.attachment_id, v_original.record_id, v_original.page, v_original.extracted_name,
      v_original.extracted_role, NULL, 'none', v_original.id)
    RETURNING id INTO v_new;
    INSERT INTO public.audit_events (category, action, result, actor_user_id, resource_type, resource_id, route, policy_decision, metadata)
    VALUES ('linked_people', 'suggestion.reopened', 'success', v_owner, v_original.record_type, v_original.record_id::text, 'linked_people', 'allowed',
      jsonb_build_object('suggestion_id', v_new, 'reopened_from', v_original.id, 'document_id', v_original.document_id, 'page', v_original.page));
  END IF;
  RETURN QUERY SELECT v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_reopen_linked_person_suggestion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_reopen_linked_person_suggestion(uuid) TO authenticated;
