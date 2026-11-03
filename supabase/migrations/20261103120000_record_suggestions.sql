-- Suggested documents (V5.2 approval path 7a–7f; MOBILE_V5.1 › Approval path and Contributor workflow).
-- Owner decision 3 Nov 2026: people the owner shares with may suggest documents for chosen records.
-- Flow: Proposed → Pending approval → Approved / Rejected (or Withdrawn) → Applied.
--
-- Boundaries:
--  * Suggesting is a separate permission, chosen by the owner per person and record. It never lets the
--    person open the record, and viewing access never lets them suggest.
--  * The suggested file sits in a private bucket only the server can read. It is not part of the record
--    until the owner approves, and is never copied into history.
--  * Only the record's owner approves or rejects. A proposer can never decide their own suggestion.
--  * Every step goes to record history (names of files only, never contents or values).
--  * Notifications carry no record details.

-- 1. Private holding area for suggested files. No browser policies: only the server (service role) reads or writes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('record-suggestions', 'record-suggestions', false, 15728640,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp', 'text/plain'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Who may suggest documents for which record. Written only by the owner.
CREATE TABLE public.record_suggestion_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.account_access_grants(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (grant_id, asset_id)
);
CREATE INDEX record_suggestion_permissions_owner_idx ON public.record_suggestion_permissions (owner_user_id, asset_id);
ALTER TABLE public.record_suggestion_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.record_suggestion_permissions FROM anon;
REVOKE UPDATE ON public.record_suggestion_permissions FROM authenticated;
CREATE POLICY record_suggestion_permissions_owner_select ON public.record_suggestion_permissions
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY record_suggestion_permissions_owner_insert ON public.record_suggestion_permissions
  FOR INSERT TO authenticated WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.account_access_grants g WHERE g.id = grant_id AND g.owner_user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND a.owner_user_id = auth.uid() AND a.deleted_at IS NULL));
CREATE POLICY record_suggestion_permissions_owner_delete ON public.record_suggestion_permissions
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

-- 3. Suggestions and their comments. Read by the owner and the proposer only; written only through the functions below.
CREATE TABLE public.record_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  proposer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposer_name text CHECK (proposer_name IS NULL OR length(proposer_name) <= 120),
  record_title text CHECK (record_title IS NULL OR length(record_title) <= 160),
  kind text NOT NULL DEFAULT 'document' CHECK (kind = 'document'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'applied', 'rejected', 'withdrawn')),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  mime_type text NOT NULL CHECK (length(mime_type) <= 100),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  storage_path text NOT NULL UNIQUE,
  reject_reason text CHECK (reject_reason IS NULL OR reject_reason IN ('wrong_record', 'wrong_document', 'cant_read', 'other')),
  reject_comment text CHECK (reject_comment IS NULL OR length(reject_comment) <= 1000),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  applied_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  file_removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CHECK (proposer_user_id <> owner_user_id),
  CHECK (storage_path LIKE owner_user_id::text || '/' || proposer_user_id::text || '/%')
);
CREATE INDEX record_suggestions_owner_idx ON public.record_suggestions (owner_user_id, status, created_at DESC);
CREATE INDEX record_suggestions_proposer_idx ON public.record_suggestions (proposer_user_id, created_at DESC);
CREATE INDEX record_suggestions_asset_idx ON public.record_suggestions (asset_id, created_at DESC);
ALTER TABLE public.record_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.record_suggestions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.record_suggestions FROM authenticated;
CREATE POLICY record_suggestions_parties_select ON public.record_suggestions
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR proposer_user_id = auth.uid());

CREATE TABLE public.record_suggestion_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.record_suggestions(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text CHECK (author_name IS NULL OR length(author_name) <= 120),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX record_suggestion_comments_idx ON public.record_suggestion_comments (suggestion_id, created_at);
ALTER TABLE public.record_suggestion_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.record_suggestion_comments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.record_suggestion_comments FROM authenticated;
CREATE POLICY record_suggestion_comments_parties_select ON public.record_suggestion_comments
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.record_suggestions s
    WHERE s.id = suggestion_id AND (s.owner_user_id = auth.uid() OR s.proposer_user_id = auth.uid())));

-- 4. History and notification kinds. Both lists repeat every existing value.
ALTER TABLE public.record_history DROP CONSTRAINT IF EXISTS record_history_action_check;
ALTER TABLE public.record_history ADD CONSTRAINT record_history_action_check CHECK (action IN (
  'created', 'updated', 'deleted', 'restored',
  'document_added', 'document_removed',
  'person_linked', 'person_unlinked',
  'access_given', 'access_stopped',
  'suggestion_proposed', 'suggestion_commented', 'suggestion_approved', 'suggestion_rejected', 'suggestion_withdrawn'));

ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN (
  'nomination_added', 'nomination_ended', 'release_approved',
  'access_given', 'access_stopped',
  'authority_in_effect', 'authority_ended',
  'authority_confirmed', 'authority_needs_attention', 'authority_rejected',
  'early_access_requested', 'early_access_answered',
  'identity_approved', 'identity_rejected',
  'more_evidence_requested', 'attorney_check_requested',
  'record_link_added',
  'suggestion_pending', 'suggestion_comment', 'suggestion_approved', 'suggestion_rejected'));

-- 5. Helpers.
CREATE FUNCTION lf_vault_access_private.display_name(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT left(COALESCE(NULLIF(btrim((SELECT p.display_name FROM public.user_profiles p WHERE p.user_id = p_user)), ''), 'Someone'), 120);
$$;

-- The owner of the record when the signed-in person may suggest a document for it, otherwise NULL.
CREATE FUNCTION lf_vault_access_private.suggestion_owner(p_asset_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.owner_user_id
  FROM public.record_suggestion_permissions p
  JOIN public.account_access_grants g ON g.id = p.grant_id AND g.owner_user_id = p.owner_user_id
  JOIN public.assets a ON a.id = p.asset_id AND a.owner_user_id = p.owner_user_id
  WHERE p.asset_id = p_asset_id
    AND g.linked_user_id = auth.uid()
    AND a.deleted_at IS NULL
    AND public.lf_linked_grant_satisfies_identity(g)
  LIMIT 1;
$$;

-- 6. What the person can call.
-- Records they may suggest documents for: title and owner name only.
CREATE FUNCTION public.lf_suggestion_targets()
RETURNS TABLE (asset_id uuid, owner_user_id uuid, owner_name text, record_title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.id, a.owner_user_id, lf_vault_access_private.display_name(a.owner_user_id), left(COALESCE(NULLIF(btrim(a.title), ''), 'Record'), 160)
  FROM public.record_suggestion_permissions p
  JOIN public.account_access_grants g ON g.id = p.grant_id AND g.owner_user_id = p.owner_user_id
  JOIN public.assets a ON a.id = p.asset_id AND a.owner_user_id = p.owner_user_id
  WHERE g.linked_user_id = auth.uid() AND a.deleted_at IS NULL AND public.lf_linked_grant_satisfies_identity(g)
  ORDER BY 3, 4;
$$;

-- Called by the server after it has stored the file at p_storage_path in the private bucket.
CREATE FUNCTION public.lf_create_document_suggestion(
  p_asset_id uuid, p_file_name text, p_mime_type text, p_size_bytes bigint, p_storage_path text, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_me uuid := auth.uid();
  v_owner uuid := lf_vault_access_private.suggestion_owner(p_asset_id);
  v_id uuid;
  v_title text;
BEGIN
  IF v_me IS NULL OR v_owner IS NULL THEN RAISE EXCEPTION 'You can’t suggest documents for this record' USING ERRCODE = '42501'; END IF;
  IF p_storage_path NOT LIKE v_owner::text || '/' || v_me::text || '/%' THEN RAISE EXCEPTION 'Unexpected file location'; END IF;
  IF (SELECT count(*) FROM public.record_suggestions s WHERE s.proposer_user_id = v_me AND s.owner_user_id = v_owner AND s.status = 'pending') >= 20 THEN
    RAISE EXCEPTION 'Too many suggestions are waiting for a decision';
  END IF;
  SELECT left(COALESCE(NULLIF(btrim(a.title), ''), 'Record'), 160) INTO v_title FROM public.assets a WHERE a.id = p_asset_id;
  INSERT INTO public.record_suggestions (owner_user_id, asset_id, proposer_user_id, proposer_name, record_title, note, file_name, mime_type, size_bytes, storage_path)
  VALUES (v_owner, p_asset_id, v_me, lf_vault_access_private.display_name(v_me), v_title, NULLIF(btrim(p_note), ''), left(btrim(p_file_name), 200), p_mime_type, p_size_bytes, p_storage_path)
  RETURNING id INTO v_id;
  PERFORM lf_vault_access_private.write_history(v_owner, p_asset_id, 'asset', 'suggestion_proposed', '{}', left(btrim(p_file_name), 160));
  PERFORM lf_vault_access_private.notify(v_owner, 'suggestion_pending', v_me, '/actions?review=' || v_id::text);
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.lf_comment_on_suggestion(p_suggestion_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_me uuid := auth.uid();
  v_s public.record_suggestions;
  v_id uuid;
BEGIN
  SELECT * INTO v_s FROM public.record_suggestions s WHERE s.id = p_suggestion_id AND (s.owner_user_id = v_me OR s.proposer_user_id = v_me) FOR UPDATE;
  IF v_s.id IS NULL THEN RAISE EXCEPTION 'Suggestion not found' USING ERRCODE = '42501'; END IF;
  IF v_s.status <> 'pending' THEN RAISE EXCEPTION 'This suggestion has been decided'; END IF;
  IF btrim(COALESCE(p_body, '')) = '' THEN RAISE EXCEPTION 'Write a comment first'; END IF;
  INSERT INTO public.record_suggestion_comments (suggestion_id, author_user_id, author_name, body)
  VALUES (v_s.id, v_me, lf_vault_access_private.display_name(v_me), left(btrim(p_body), 1000)) RETURNING id INTO v_id;
  PERFORM lf_vault_access_private.write_history(v_s.owner_user_id, v_s.asset_id, 'asset', 'suggestion_commented', '{}', v_s.file_name);
  PERFORM lf_vault_access_private.notify(
    CASE WHEN v_me = v_s.owner_user_id THEN v_s.proposer_user_id ELSE v_s.owner_user_id END,
    'suggestion_comment', v_me,
    CASE WHEN v_me = v_s.owner_user_id THEN '/suggestions?open=' ELSE '/actions?review=' END || v_s.id::text);
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.lf_withdraw_suggestion(p_suggestion_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_s public.record_suggestions;
BEGIN
  SELECT * INTO v_s FROM public.record_suggestions s WHERE s.id = p_suggestion_id AND s.proposer_user_id = auth.uid() FOR UPDATE;
  IF v_s.id IS NULL THEN RAISE EXCEPTION 'Suggestion not found' USING ERRCODE = '42501'; END IF;
  IF v_s.status <> 'pending' THEN RAISE EXCEPTION 'Only a waiting suggestion can be withdrawn'; END IF;
  UPDATE public.record_suggestions SET status = 'withdrawn', updated_at = timezone('utc', now()) WHERE id = v_s.id;
  PERFORM lf_vault_access_private.write_history(v_s.owner_user_id, v_s.asset_id, 'asset', 'suggestion_withdrawn', '{}', v_s.file_name);
  RETURN v_s.storage_path;
END;
$$;

-- 7. What the owner can call.
CREATE FUNCTION public.lf_reject_suggestion(p_suggestion_id uuid, p_reason text, p_comment text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_s public.record_suggestions;
BEGIN
  SELECT * INTO v_s FROM public.record_suggestions s WHERE s.id = p_suggestion_id AND s.owner_user_id = auth.uid() FOR UPDATE;
  IF v_s.id IS NULL THEN RAISE EXCEPTION 'Suggestion not found' USING ERRCODE = '42501'; END IF;
  IF v_s.status <> 'pending' THEN RAISE EXCEPTION 'This suggestion has been decided'; END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('wrong_record', 'wrong_document', 'cant_read', 'other') THEN RAISE EXCEPTION 'Choose a reason'; END IF;
  IF p_reason = 'other' AND btrim(COALESCE(p_comment, '')) = '' THEN RAISE EXCEPTION 'Add a comment for Other'; END IF;
  UPDATE public.record_suggestions
     SET status = 'rejected', reject_reason = p_reason, reject_comment = NULLIF(left(btrim(p_comment), 1000), ''),
         decided_by = auth.uid(), decided_at = timezone('utc', now()), updated_at = timezone('utc', now())
   WHERE id = v_s.id;
  PERFORM lf_vault_access_private.write_history(v_s.owner_user_id, v_s.asset_id, 'asset', 'suggestion_rejected', '{}', v_s.file_name);
  PERFORM lf_vault_access_private.notify(v_s.proposer_user_id, 'suggestion_rejected', v_s.owner_user_id, '/suggestions?open=' || v_s.id::text);
  RETURN v_s.storage_path;
END;
$$;

-- Marks the suggestion approved and returns what the server needs to add the file to the record.
-- Repeatable while approved and not yet applied, so a failed copy can be retried.
CREATE FUNCTION public.lf_approve_suggestion(p_suggestion_id uuid)
RETURNS TABLE (storage_path text, file_name text, mime_type text, size_bytes bigint, asset_id uuid, owner_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_s public.record_suggestions;
BEGIN
  SELECT * INTO v_s FROM public.record_suggestions s WHERE s.id = p_suggestion_id AND s.owner_user_id = auth.uid() FOR UPDATE;
  IF v_s.id IS NULL THEN RAISE EXCEPTION 'Suggestion not found' USING ERRCODE = '42501'; END IF;
  IF v_s.proposer_user_id = auth.uid() THEN RAISE EXCEPTION 'You can’t approve your own suggestion' USING ERRCODE = '42501'; END IF;
  IF v_s.status = 'pending' THEN
    UPDATE public.record_suggestions SET status = 'approved', decided_by = auth.uid(), decided_at = timezone('utc', now()), updated_at = timezone('utc', now()) WHERE id = v_s.id;
    PERFORM lf_vault_access_private.write_history(v_s.owner_user_id, v_s.asset_id, 'asset', 'suggestion_approved', '{}', v_s.file_name);
  ELSIF v_s.status <> 'approved' THEN
    RAISE EXCEPTION 'This suggestion has been decided';
  END IF;
  RETURN QUERY SELECT v_s.storage_path, v_s.file_name, v_s.mime_type, v_s.size_bytes, v_s.asset_id, v_s.owner_user_id;
END;
$$;

-- 8. Server-only: after the file is added to the record (the document row is written by the System),
-- link it and tell the proposer. Also records that a held file was removed.
CREATE FUNCTION public.lf_mark_suggestion_applied(p_suggestion_id uuid, p_document_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_s public.record_suggestions;
BEGIN
  SELECT * INTO v_s FROM public.record_suggestions s WHERE s.id = p_suggestion_id FOR UPDATE;
  IF v_s.id IS NULL OR v_s.status <> 'approved' THEN RAISE EXCEPTION 'Suggestion is not waiting to be applied'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.id = p_document_id AND d.asset_id = v_s.asset_id AND d.owner_user_id = v_s.owner_user_id) THEN
    RAISE EXCEPTION 'Document does not belong to this record';
  END IF;
  UPDATE public.record_suggestions SET status = 'applied', applied_document_id = p_document_id, updated_at = timezone('utc', now()) WHERE id = v_s.id;
  PERFORM lf_vault_access_private.notify(v_s.proposer_user_id, 'suggestion_approved', v_s.owner_user_id, '/suggestions?open=' || v_s.id::text);
END;
$$;

CREATE FUNCTION public.lf_mark_suggestion_file_removed(p_suggestion_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.record_suggestions SET file_removed_at = timezone('utc', now()), updated_at = timezone('utc', now())
  WHERE id = p_suggestion_id AND status IN ('rejected', 'withdrawn', 'applied') AND file_removed_at IS NULL;
$$;

REVOKE ALL ON FUNCTION lf_vault_access_private.display_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lf_vault_access_private.suggestion_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lf_suggestion_targets() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_create_document_suggestion(uuid, text, text, bigint, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_comment_on_suggestion(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_withdraw_suggestion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_reject_suggestion(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_approve_suggestion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_mark_suggestion_applied(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lf_mark_suggestion_file_removed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lf_suggestion_targets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_create_document_suggestion(uuid, text, text, bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_comment_on_suggestion(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_withdraw_suggestion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_reject_suggestion(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_approve_suggestion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_mark_suggestion_applied(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.lf_mark_suggestion_file_removed(uuid) TO service_role;
GRANT SELECT, INSERT, DELETE ON public.record_suggestion_permissions TO authenticated;
GRANT SELECT ON public.record_suggestions, public.record_suggestion_comments TO authenticated;
GRANT ALL ON public.record_suggestion_permissions, public.record_suggestions, public.record_suggestion_comments TO service_role;
