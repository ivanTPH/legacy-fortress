-- Audit trail coverage (owner instruction 3 Nov 2026: "there must be an audit trail of who is connected,
-- documents uploaded, approval actions etc").
--
-- Writes to the existing append-only public.audit_events (updates and deletes are blocked there) from
-- the database itself, so nothing a browser does can skip or edit an entry:
--   * connections: invitations created, sent, accepted, revoked; connections activated, paused, resumed, ended
--   * documents: added and removed, on canonical documents and legacy attachments
--   * people linked to and unlinked from records
--   * suggested documents: permission given or removed, proposed, commented, approved, applied, rejected,
--     withdrawn, and the held file removed
-- Audit entries carry who acted (account id and email), ids, kinds and counts only: never record names,
-- file names, values or notes
-- (ADMIN_PARTNER: admins never see Vault content). The owner's Record history keeps the names.
-- Also adds "who can suggest" changes to Record history. The action list repeats every existing value.

CREATE FUNCTION lf_vault_access_private.audit(p_action text, p_resource_type text, p_resource_id uuid, p_owner uuid, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.audit_events (category, action, result, actor_user_id, actor_email_normalized, actor_role, resource_type, resource_id, route, policy_decision, metadata)
  VALUES ('vault_audit', p_action, 'success', auth.uid(),
    (SELECT lower(u.email) FROM auth.users u WHERE u.id = auth.uid()),
    CASE WHEN auth.uid() IS NULL THEN 'system' WHEN auth.uid() = p_owner THEN 'vault_owner' ELSE 'connected_person' END,
    p_resource_type, p_resource_id::text, 'database', 'allowed',
    jsonb_strip_nulls(COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object(
      'owner_user_id', p_owner,
      'actor', CASE WHEN auth.uid() IS NULL THEN 'system' WHEN auth.uid() = p_owner THEN 'owner' ELSE 'person' END)));
$$;
REVOKE ALL ON FUNCTION lf_vault_access_private.audit(text, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- 1. Who is connected -------------------------------------------------------------------------
CREATE FUNCTION lf_vault_access_private.audit_invitation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_new jsonb := to_jsonb(NEW); v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM lf_vault_access_private.audit('connection.invitation_created', 'contact_invitation', NEW.id, NEW.owner_user_id,
      jsonb_build_object('contact_id', v_new ->> 'contact_id', 'status', v_new ->> 'invitation_status'));
    RETURN NULL;
  END IF;
  IF (v_new ->> 'revoked_at') IS NOT NULL AND (v_old ->> 'revoked_at') IS NULL THEN
    PERFORM lf_vault_access_private.audit('connection.invitation_revoked', 'contact_invitation', NEW.id, NEW.owner_user_id, jsonb_build_object('contact_id', v_new ->> 'contact_id'));
  END IF;
  IF (v_new ->> 'accepted_at') IS NOT NULL AND (v_old ->> 'accepted_at') IS NULL THEN
    PERFORM lf_vault_access_private.audit('connection.invitation_accepted', 'contact_invitation', NEW.id, NEW.owner_user_id,
      jsonb_build_object('contact_id', v_new ->> 'contact_id', 'accepted_user_id', v_new ->> 'accepted_user_id'));
  END IF;
  IF COALESCE(v_new ->> 'last_sent_at', v_new ->> 'sent_at') IS DISTINCT FROM COALESCE(v_old ->> 'last_sent_at', v_old ->> 'sent_at')
     AND COALESCE(v_new ->> 'last_sent_at', v_new ->> 'sent_at') IS NOT NULL THEN
    PERFORM lf_vault_access_private.audit('connection.invitation_sent', 'contact_invitation', NEW.id, NEW.owner_user_id, jsonb_build_object('contact_id', v_new ->> 'contact_id'));
  END IF;
  IF (v_new ->> 'invitation_status') IS DISTINCT FROM (v_old ->> 'invitation_status') THEN
    PERFORM lf_vault_access_private.audit('connection.invitation_status_changed', 'contact_invitation', NEW.id, NEW.owner_user_id,
      jsonb_build_object('contact_id', v_new ->> 'contact_id', 'from', v_old ->> 'invitation_status', 'to', v_new ->> 'invitation_status'));
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER contact_invitations_audit_trail AFTER INSERT OR UPDATE ON public.contact_invitations
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_invitation();

-- Connection state (activation, pause, end). Record scope changes are already audited by account_access_grants_audit.
CREATE FUNCTION lf_vault_access_private.audit_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM lf_vault_access_private.audit('connection.created', 'access_grant', NEW.id, NEW.owner_user_id,
      jsonb_build_object('contact_id', NEW.contact_id, 'linked_user_id', NEW.linked_user_id, 'role', NEW.assigned_role, 'status', NEW.activation_status));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM lf_vault_access_private.audit('connection.removed', 'access_grant', OLD.id, OLD.owner_user_id,
      jsonb_build_object('contact_id', OLD.contact_id, 'linked_user_id', OLD.linked_user_id));
    RETURN NULL;
  ELSE
    IF NEW.activation_status IS DISTINCT FROM OLD.activation_status THEN
      PERFORM lf_vault_access_private.audit('connection.status_changed', 'access_grant', NEW.id, NEW.owner_user_id,
        jsonb_build_object('contact_id', NEW.contact_id, 'from', OLD.activation_status, 'to', NEW.activation_status));
    END IF;
    IF NEW.assigned_role IS DISTINCT FROM OLD.assigned_role THEN
      PERFORM lf_vault_access_private.audit('connection.role_changed', 'access_grant', NEW.id, NEW.owner_user_id,
        jsonb_build_object('contact_id', NEW.contact_id, 'from', OLD.assigned_role, 'to', NEW.assigned_role));
    END IF;
    IF NEW.paused_at IS DISTINCT FROM OLD.paused_at THEN
      PERFORM lf_vault_access_private.audit(CASE WHEN NEW.paused_at IS NULL THEN 'connection.resumed' ELSE 'connection.paused' END, 'access_grant', NEW.id, NEW.owner_user_id,
        jsonb_build_object('contact_id', NEW.contact_id));
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER account_access_grants_connection_audit AFTER INSERT OR UPDATE OR DELETE ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_connection();

-- 2. Documents uploaded and removed -----------------------------------------------------------
CREATE FUNCTION lf_vault_access_private.audit_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_owner uuid := (v_row ->> 'owner_user_id')::uuid;
  v_record uuid := COALESCE((v_row ->> 'asset_id')::uuid, (v_row ->> 'record_id')::uuid);
  v_meta jsonb := jsonb_build_object('record_id', v_record, 'table', TG_TABLE_NAME, 'mime_type', v_row ->> 'mime_type', 'size_bytes', v_row ->> 'size_bytes');
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM lf_vault_access_private.audit('document.added', 'document', (v_row ->> 'id')::uuid, v_owner, v_meta);
  ELSIF TG_OP = 'DELETE' OR ((v_row ->> 'deleted_at') IS NOT NULL AND (to_jsonb(OLD) ->> 'deleted_at') IS NULL) THEN
    PERFORM lf_vault_access_private.audit('document.removed', 'document', (v_row ->> 'id')::uuid, v_owner, v_meta);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER documents_audit_trail AFTER INSERT OR UPDATE OF deleted_at OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_document();
CREATE TRIGGER attachments_audit_trail AFTER INSERT OR DELETE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_document();

-- 3. People linked to records -------------------------------------------------------------------
CREATE FUNCTION lf_vault_access_private.audit_record_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM lf_vault_access_private.audit('person.linked', 'record_link', (v_row ->> 'id')::uuid, (v_row ->> 'owner_user_id')::uuid,
      jsonb_build_object('record_id', v_row ->> 'record_id', 'person_id', v_row ->> 'person_id', 'role', v_row ->> 'role'));
  ELSIF TG_OP = 'DELETE' OR ((v_row ->> 'removed_at') IS NOT NULL AND (to_jsonb(OLD) ->> 'removed_at') IS NULL) THEN
    PERFORM lf_vault_access_private.audit('person.unlinked', 'record_link', (v_row ->> 'id')::uuid, (v_row ->> 'owner_user_id')::uuid,
      jsonb_build_object('record_id', v_row ->> 'record_id', 'person_id', v_row ->> 'person_id', 'role', v_row ->> 'role'));
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER record_links_audit_trail AFTER INSERT OR UPDATE OF removed_at OR DELETE ON public.record_links
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_record_link();

-- 4. Approval actions ------------------------------------------------------------------------------
CREATE FUNCTION lf_vault_access_private.audit_suggestion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_meta jsonb;
BEGIN
  v_meta := jsonb_build_object('record_id', NEW.asset_id, 'proposer_user_id', NEW.proposer_user_id, 'mime_type', NEW.mime_type, 'size_bytes', NEW.size_bytes);
  IF TG_OP = 'INSERT' THEN
    PERFORM lf_vault_access_private.audit('suggestion.proposed', 'record_suggestion', NEW.id, NEW.owner_user_id, v_meta);
    RETURN NULL;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM lf_vault_access_private.audit('suggestion.' || NEW.status, 'record_suggestion', NEW.id, NEW.owner_user_id,
      v_meta || jsonb_build_object('from', OLD.status, 'decided_by', NEW.decided_by, 'reject_reason', NEW.reject_reason, 'applied_document_id', NEW.applied_document_id));
  END IF;
  IF NEW.file_removed_at IS NOT NULL AND OLD.file_removed_at IS NULL THEN
    PERFORM lf_vault_access_private.audit('suggestion.held_file_removed', 'record_suggestion', NEW.id, NEW.owner_user_id, v_meta);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER record_suggestions_audit_trail AFTER INSERT OR UPDATE ON public.record_suggestions
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_suggestion();

CREATE FUNCTION lf_vault_access_private.audit_suggestion_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT s.owner_user_id INTO v_owner FROM public.record_suggestions s WHERE s.id = NEW.suggestion_id;
  PERFORM lf_vault_access_private.audit('suggestion.commented', 'record_suggestion', NEW.suggestion_id, v_owner, jsonb_build_object('comment_id', NEW.id));
  RETURN NULL;
END;
$$;
CREATE TRIGGER record_suggestion_comments_audit_trail AFTER INSERT ON public.record_suggestion_comments
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_suggestion_comment();

-- Who can suggest: audit plus the owner's Record history (with the person's name, which only the owner sees).
ALTER TABLE public.record_history DROP CONSTRAINT IF EXISTS record_history_action_check;
ALTER TABLE public.record_history ADD CONSTRAINT record_history_action_check CHECK (action IN (
  'created', 'updated', 'deleted', 'restored',
  'document_added', 'document_removed',
  'person_linked', 'person_unlinked',
  'access_given', 'access_stopped',
  'suggestion_proposed', 'suggestion_commented', 'suggestion_approved', 'suggestion_rejected', 'suggestion_withdrawn',
  'suggest_allowed', 'suggest_removed'));

CREATE FUNCTION lf_vault_access_private.audit_suggestion_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.record_suggestion_permissions := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_grant public.account_access_grants;
  v_name text;
BEGIN
  SELECT * INTO v_grant FROM public.account_access_grants g WHERE g.id = v_row.grant_id;
  SELECT c.full_name INTO v_name FROM public.contacts c WHERE c.id = v_grant.contact_id;
  PERFORM lf_vault_access_private.audit(CASE WHEN TG_OP = 'DELETE' THEN 'suggestion.permission_removed' ELSE 'suggestion.permission_given' END,
    'record_suggestion_permission', v_row.id, v_row.owner_user_id,
    jsonb_build_object('record_id', v_row.asset_id, 'grant_id', v_row.grant_id, 'linked_user_id', v_grant.linked_user_id));
  -- Skip history when the record itself is being deleted (cascade).
  IF EXISTS (SELECT 1 FROM public.assets a WHERE a.id = v_row.asset_id) THEN
    PERFORM lf_vault_access_private.write_history(v_row.owner_user_id, v_row.asset_id, 'asset',
      CASE WHEN TG_OP = 'DELETE' THEN 'suggest_removed' ELSE 'suggest_allowed' END, '{}', left(v_name, 160));
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER record_suggestion_permissions_audit_trail AFTER INSERT OR DELETE ON public.record_suggestion_permissions
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_suggestion_permission();
