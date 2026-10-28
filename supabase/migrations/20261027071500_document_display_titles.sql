-- Display titles are metadata. The original filename and storage object remain unchanged.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS display_title text;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_display_title_valid
  CHECK (
    display_title IS NULL OR (
      length(display_title) BETWEEN 1 AND 160
      AND display_title = btrim(display_title)
      AND display_title !~ '[[:cntrl:]]'
    )
  );

-- The existing documents_owner_update RLS policy checks owner identity and
-- lf_vault_allows_owner_mutation. Linked readers have no UPDATE policy.
-- Store no title, filename or extracted contents in the append-only audit row.
CREATE SCHEMA IF NOT EXISTS lf_internal;
REVOKE ALL ON SCHEMA lf_internal FROM PUBLIC, anon, authenticated;

-- Renaming metadata must never be a path to retargeting a document or rewriting
-- its original file identity. Replacements already create a separate row/object.
CREATE OR REPLACE FUNCTION lf_internal.protect_document_original()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (NEW.organisation_id, NEW.wallet_id, NEW.asset_id, NEW.owner_user_id,
      NEW.storage_bucket, NEW.storage_path, NEW.file_name, NEW.mime_type,
      NEW.size_bytes, NEW.checksum, NEW.document_kind)
     IS DISTINCT FROM
     (OLD.organisation_id, OLD.wallet_id, OLD.asset_id, OLD.owner_user_id,
      OLD.storage_bucket, OLD.storage_path, OLD.file_name, OLD.mime_type,
      OLD.size_bytes, OLD.checksum, OLD.document_kind) THEN
    RAISE EXCEPTION 'Document original metadata is immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION lf_internal.protect_document_original() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER documents_protect_original
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION lf_internal.protect_document_original();

CREATE OR REPLACE FUNCTION lf_internal.audit_document_title_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.display_title IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.display_title IS NOT DISTINCT FROM OLD.display_title THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_events (
    category, action, result, actor_user_id, resource_type, resource_id,
    route, policy_decision, metadata
  ) VALUES (
    'document',
    CASE WHEN TG_OP = 'INSERT' THEN 'display_title_created' ELSE 'display_title_changed' END,
    'success', auth.uid(), 'document', NEW.id::text,
    'documents.display_title', 'allowed', '{}'::jsonb
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION lf_internal.audit_document_title_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER documents_display_title_audit
  AFTER INSERT OR UPDATE OF display_title ON public.documents
  FOR EACH ROW EXECUTE FUNCTION lf_internal.audit_document_title_change();

-- Rollback, if required before title use: drop the trigger/function and
-- constraint/column; rollback discards display titles but never file_name or bytes.
