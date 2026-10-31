-- Record history (AGENTS rule 28; MOBILE_V5.1 › Record history 6b, 6n; V5.2 W3 side panel).
-- Append-only, written by the database. Distinguishes the person acting from the System.
-- Never stores values or document contents: only what kind of change, which fields by name,
-- and who. Owners read their own records' history; nobody can write or edit it directly.

CREATE TABLE public.record_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id uuid NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('asset', 'record')),
  action text NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'restored',
    'document_added', 'document_removed',
    'person_linked', 'person_unlinked',
    'access_given', 'access_stopped')),
  actor_user_id uuid,
  actor_kind text NOT NULL CHECK (actor_kind IN ('owner', 'person', 'system')),
  changed_fields text[] NOT NULL DEFAULT '{}'::text[],
  subject_label text CHECK (subject_label IS NULL OR length(subject_label) <= 160),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX record_history_record_idx ON public.record_history (record_id, created_at DESC);
CREATE INDEX record_history_owner_idx ON public.record_history (owner_user_id, created_at DESC);
ALTER TABLE public.record_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.record_history FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.record_history FROM authenticated;
CREATE POLICY record_history_owner_select ON public.record_history
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

CREATE FUNCTION lf_vault_access_private.history_actor(p_owner uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN 'system' WHEN auth.uid() = p_owner THEN 'owner' ELSE 'person' END;
$$;

CREATE FUNCTION lf_vault_access_private.write_history(
  p_owner uuid, p_record uuid, p_type text, p_action text, p_fields text[] DEFAULT '{}'::text[], p_subject text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.record_history (owner_user_id, record_id, record_type, action, actor_user_id, actor_kind, changed_fields, subject_label)
  VALUES (p_owner, p_record, p_type, p_action, auth.uid(), lf_vault_access_private.history_actor(p_owner), COALESCE(p_fields, '{}'::text[]), left(p_subject, 160));
$$;

-- Field names that changed (never values). Top-level columns plus keys inside the metadata column.
CREATE FUNCTION lf_vault_access_private.changed_fields(p_old jsonb, p_new jsonb, p_meta text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(array_agg(DISTINCT k ORDER BY k), '{}'::text[]) FROM (
    SELECT key AS k FROM jsonb_each(p_new)
    WHERE key NOT IN ('updated_at', 'created_at', 'id', 'owner_user_id', 'organisation_id', 'wallet_id', p_meta, 'deleted_at', 'archived_at')
      AND (p_old -> key) IS DISTINCT FROM (p_new -> key)
    UNION ALL
    SELECT key FROM jsonb_each(COALESCE(p_new -> p_meta, '{}'::jsonb))
    WHERE jsonb_typeof(COALESCE(p_new -> p_meta, '{}'::jsonb)) = 'object'
      AND (COALESCE(p_old -> p_meta, '{}'::jsonb) -> key) IS DISTINCT FROM (p_new -> p_meta -> key)
    UNION ALL
    SELECT key FROM jsonb_each(COALESCE(p_old -> p_meta, '{}'::jsonb))
    WHERE jsonb_typeof(COALESCE(p_old -> p_meta, '{}'::jsonb)) = 'object'
      AND NOT (COALESCE(p_new -> p_meta, '{}'::jsonb) ? key)
  ) changed;
$$;

CREATE FUNCTION lf_vault_access_private.history_for_record_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_type text := CASE WHEN TG_TABLE_NAME = 'assets' THEN 'asset' ELSE 'record' END;
  v_meta text := CASE WHEN TG_TABLE_NAME = 'assets' THEN 'metadata_json' ELSE 'metadata' END;
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb;
  v_fields text[];
  v_removed_new boolean;
  v_removed_old boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM lf_vault_access_private.write_history(NEW.owner_user_id, NEW.id, v_type, 'created');
    RETURN NULL;
  END IF;
  v_old := to_jsonb(OLD);
  v_removed_new := COALESCE(v_new ->> 'deleted_at', v_new ->> 'archived_at') IS NOT NULL;
  v_removed_old := COALESCE(v_old ->> 'deleted_at', v_old ->> 'archived_at') IS NOT NULL;
  IF v_removed_new AND NOT v_removed_old THEN
    PERFORM lf_vault_access_private.write_history(NEW.owner_user_id, NEW.id, v_type, 'deleted');
  ELSIF v_removed_old AND NOT v_removed_new THEN
    PERFORM lf_vault_access_private.write_history(NEW.owner_user_id, NEW.id, v_type, 'restored');
  ELSE
    v_fields := lf_vault_access_private.changed_fields(v_old, v_new, v_meta);
    IF array_length(v_fields, 1) > 0 THEN
      PERFORM lf_vault_access_private.write_history(NEW.owner_user_id, NEW.id, v_type, 'updated', v_fields[1:20]);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER assets_record_history AFTER INSERT OR UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.history_for_record_row();
CREATE TRIGGER records_record_history AFTER INSERT OR UPDATE ON public.records
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.history_for_record_row();

-- Documents: added and removed (file name only, which the owner already sees).
CREATE FUNCTION lf_vault_access_private.history_for_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_owner uuid := (v_row ->> 'owner_user_id')::uuid;
  v_target uuid := COALESCE((v_row ->> 'asset_id')::uuid, (v_row ->> 'record_id')::uuid);
  v_type text := CASE WHEN TG_TABLE_NAME = 'documents' THEN 'asset' ELSE 'record' END;
  v_name text := COALESCE(v_row ->> 'display_title', v_row ->> 'file_name');
BEGIN
  IF v_target IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM lf_vault_access_private.write_history(v_owner, v_target, v_type, 'document_added', '{}', v_name);
  ELSIF TG_OP = 'DELETE' OR ((v_row ->> 'deleted_at') IS NOT NULL AND (to_jsonb(OLD) ->> 'deleted_at') IS NULL) THEN
    PERFORM lf_vault_access_private.write_history(v_owner, v_target, v_type, 'document_removed', '{}', v_name);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER documents_record_history AFTER INSERT OR UPDATE OF deleted_at OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.history_for_document();
CREATE TRIGGER attachments_record_history AFTER INSERT OR DELETE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.history_for_document();

-- People linked to a record.
CREATE FUNCTION lf_vault_access_private.history_for_person_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_owner uuid := (v_row ->> 'owner_user_id')::uuid;
  v_target uuid;
  v_type text;
  v_name text;
BEGIN
  IF TG_TABLE_NAME = 'contact_links' THEN
    IF v_row ->> 'source_kind' NOT IN ('asset', 'record') THEN RETURN NULL; END IF;
    v_target := (v_row ->> 'source_id')::uuid; v_type := v_row ->> 'source_kind';
    SELECT c.full_name INTO v_name FROM public.contacts c WHERE c.id = (v_row ->> 'contact_id')::uuid;
  ELSE
    v_target := (v_row ->> 'record_id')::uuid; v_type := 'record';
    v_name := COALESCE(v_row ->> 'contact_name', (SELECT c.full_name FROM public.contacts c WHERE c.id = (v_row ->> 'contact_id')::uuid));
  END IF;
  IF v_target IS NULL THEN RETURN NULL; END IF;
  PERFORM lf_vault_access_private.write_history(v_owner, v_target, v_type, CASE WHEN TG_OP = 'DELETE' THEN 'person_unlinked' ELSE 'person_linked' END, '{}', v_name);
  RETURN NULL;
END;
$$;
CREATE TRIGGER contact_links_record_history AFTER INSERT OR DELETE ON public.contact_links
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.history_for_person_link();
CREATE TRIGGER record_contacts_record_history AFTER INSERT OR DELETE ON public.record_contacts
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.history_for_person_link();

-- Access to a record given or stopped (owner sharing, authorities, releases).
CREATE FUNCTION lf_vault_access_private.history_for_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name text;
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.permissions_override, '{}'::jsonb) ELSE '{}'::jsonb END;
  v_new jsonb := COALESCE(NEW.permissions_override, '{}'::jsonb);
  v_id text;
  v_kind text;
BEGIN
  SELECT c.full_name INTO v_name FROM public.contacts c WHERE c.owner_user_id = NEW.owner_user_id AND (c.id = NEW.contact_id OR c.linked_user_id = NEW.linked_user_id) ORDER BY (c.id = NEW.contact_id) DESC LIMIT 1;
  FOREACH v_kind IN ARRAY ARRAY['asset_ids', 'record_ids'] LOOP
    FOR v_id IN SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_new -> v_kind) = 'array' THEN v_new -> v_kind ELSE '[]'::jsonb END)
                EXCEPT SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_old -> v_kind) = 'array' THEN v_old -> v_kind ELSE '[]'::jsonb END) LOOP
      PERFORM lf_vault_access_private.write_history(NEW.owner_user_id, v_id::uuid, CASE WHEN v_kind = 'asset_ids' THEN 'asset' ELSE 'record' END, 'access_given', '{}', v_name);
    END LOOP;
    FOR v_id IN SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_old -> v_kind) = 'array' THEN v_old -> v_kind ELSE '[]'::jsonb END)
                EXCEPT SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_new -> v_kind) = 'array' THEN v_new -> v_kind ELSE '[]'::jsonb END) LOOP
      PERFORM lf_vault_access_private.write_history(NEW.owner_user_id, v_id::uuid, CASE WHEN v_kind = 'asset_ids' THEN 'asset' ELSE 'record' END, 'access_stopped', '{}', v_name);
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER account_access_grants_record_history AFTER INSERT OR UPDATE OF permissions_override ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.history_for_grant();

-- Existing records get their "created" entry from their own creation time.
INSERT INTO public.record_history (owner_user_id, record_id, record_type, action, actor_user_id, actor_kind, created_at)
SELECT a.owner_user_id, a.id, 'asset', 'created', a.owner_user_id, 'owner', a.created_at FROM public.assets a
UNION ALL
SELECT r.owner_user_id, r.id, 'record', 'created', r.owner_user_id, 'owner', r.created_at FROM public.records r;

-- Display names for people acting on a record, for the owner's history only.
CREATE FUNCTION public.my_record_history(p_record_id uuid)
RETURNS TABLE (at timestamptz, action text, actor_kind text, actor_name text, changed_fields text[], subject_label text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT h.created_at, h.action, h.actor_kind,
         CASE h.actor_kind WHEN 'owner' THEN 'You' WHEN 'system' THEN 'System'
              ELSE COALESCE(NULLIF(btrim((SELECT p.display_name FROM public.user_profiles p WHERE p.user_id = h.actor_user_id)), ''), 'Someone you shared with') END,
         h.changed_fields, h.subject_label
  FROM public.record_history h
  WHERE h.record_id = p_record_id AND h.owner_user_id = auth.uid()
  ORDER BY h.created_at DESC
  LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.my_record_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_record_history(uuid) TO authenticated;
