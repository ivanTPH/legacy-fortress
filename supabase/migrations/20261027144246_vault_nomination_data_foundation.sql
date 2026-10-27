-- Vault Access PR 1A: inert estate nominations only. No permission, release,
-- attorney, grant-source, storage, or existing RLS function changes.
-- Depends on 20261027104509_linked_people_data_foundation.sql.

CREATE TABLE public.vault_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'estate' CHECK (kind = 'estate'),
  scope text NOT NULL CHECK (scope IN ('whole_vault', 'selected')),
  view_level text NOT NULL DEFAULT 'view_only' CHECK (view_level = 'view_only'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  notify_person boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  CONSTRAINT vault_nomination_cancel_consistency CHECK (
    (status = 'active' AND cancelled_by IS NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX vault_nominations_one_active_person_kind_idx
  ON public.vault_nominations (vault_id, person_id, kind) WHERE status = 'active';
CREATE INDEX vault_nominations_owner_status_idx
  ON public.vault_nominations (owner_user_id, status, created_at DESC);
CREATE INDEX vault_nominations_person_status_idx
  ON public.vault_nominations (person_id, status);

-- This first slice can scope only canonical assets, whose wallet_id proves the
-- same-Vault boundary. Legacy records have no wallet_id and need an approved map.
CREATE TABLE public.vault_nomination_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id uuid NOT NULL REFERENCES public.vault_nominations(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  record_type text NOT NULL DEFAULT 'asset' CHECK (record_type = 'asset'),
  record_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('include', 'exclude')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vault_nomination_record_once UNIQUE (nomination_id, record_id)
);

CREATE INDEX vault_nomination_records_owner_idx
  ON public.vault_nomination_records (owner_user_id, nomination_id, mode);
CREATE INDEX vault_nomination_records_asset_idx
  ON public.vault_nomination_records (record_id, nomination_id);

CREATE SCHEMA IF NOT EXISTS lf_vault_nomination_private;
REVOKE ALL ON SCHEMA lf_vault_nomination_private FROM PUBLIC, anon, authenticated;

CREATE FUNCTION lf_vault_nomination_private.validate_nomination()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.wallets w
    WHERE w.id = NEW.vault_id AND w.owner_user_id = NEW.owner_user_id
      AND w.status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.contacts p
    WHERE p.id = NEW.person_id AND p.owner_user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'Nomination Vault and person must have the same owner';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by <> NEW.owner_user_id OR NEW.status <> 'active'
       OR NEW.cancelled_by IS NOT NULL OR NEW.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Only an owner-created active nomination may be inserted';
    END IF;
  ELSE
    IF (NEW.id, NEW.owner_user_id, NEW.vault_id, NEW.person_id,
        NEW.kind, NEW.view_level, NEW.created_by, NEW.created_at)
       IS DISTINCT FROM
       (OLD.id, OLD.owner_user_id, OLD.vault_id, OLD.person_id,
        OLD.kind, OLD.view_level, OLD.created_by, OLD.created_at) THEN
      RAISE EXCEPTION 'Nomination identity and provenance are immutable';
    END IF;
    IF OLD.status <> 'active'
       OR NEW.status NOT IN ('active', 'cancelled') THEN
      RAISE EXCEPTION 'Cancelled nomination is immutable';
    END IF;
    IF NEW.status = 'cancelled' THEN
      IF (NEW.scope, NEW.notify_person) IS DISTINCT FROM
         (OLD.scope, OLD.notify_person) THEN
        RAISE EXCEPTION 'Cancel and other nomination changes require separate audited actions';
      END IF;
      NEW.cancelled_by := auth.uid();
      NEW.cancelled_at := timezone('utc', now());
    ELSIF NEW.cancelled_by IS NOT NULL OR NEW.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Active nomination cannot carry cancellation metadata';
    END IF;
    NEW.updated_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER vault_nominations_validate
  BEFORE INSERT OR UPDATE ON public.vault_nominations
  FOR EACH ROW EXECUTE FUNCTION lf_vault_nomination_private.validate_nomination();

CREATE FUNCTION lf_vault_nomination_private.validate_scope_row()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_nomination public.vault_nominations;
BEGIN
  SELECT * INTO v_nomination FROM public.vault_nominations WHERE id = NEW.nomination_id;
  IF NOT FOUND OR v_nomination.status <> 'active'
     OR NEW.owner_user_id <> v_nomination.owner_user_id
     OR NEW.vault_id <> v_nomination.vault_id
     OR NEW.created_by <> NEW.owner_user_id
     OR (v_nomination.scope = 'selected' AND NEW.mode <> 'include')
     OR (v_nomination.scope = 'whole_vault' AND NEW.mode <> 'exclude')
     OR NOT EXISTS (
       SELECT 1 FROM public.assets a
       WHERE a.id = NEW.record_id AND a.owner_user_id = NEW.owner_user_id
         AND a.wallet_id = NEW.vault_id AND a.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Nomination scope must contain an eligible asset from its owner Vault';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Scope row is immutable; remove and add in one transaction';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER vault_nomination_records_validate
  BEFORE INSERT OR UPDATE ON public.vault_nomination_records
  FOR EACH ROW EXECUTE FUNCTION lf_vault_nomination_private.validate_scope_row();

CREATE FUNCTION lf_vault_nomination_private.validate_complete_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_nomination_id uuid;
  v_nomination public.vault_nominations;
BEGIN
  IF TG_TABLE_NAME = 'vault_nominations' THEN
    v_nomination_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_nomination_id := OLD.nomination_id;
  ELSE
    v_nomination_id := NEW.nomination_id;
  END IF;
  SELECT * INTO v_nomination FROM public.vault_nominations WHERE id = v_nomination_id;
  IF NOT FOUND OR v_nomination.status <> 'active' THEN RETURN NULL; END IF;
  IF v_nomination.scope = 'selected' AND NOT EXISTS (
    SELECT 1 FROM public.vault_nomination_records r
    WHERE r.nomination_id = v_nomination_id AND r.mode = 'include'
  ) THEN
    RAISE EXCEPTION 'Selected nomination requires an included asset';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vault_nomination_records r
    WHERE r.nomination_id = v_nomination_id
      AND ((v_nomination.scope = 'selected' AND r.mode <> 'include')
        OR (v_nomination.scope = 'whole_vault' AND r.mode <> 'exclude'))
  ) THEN
    RAISE EXCEPTION 'Nomination scope mode does not match nomination kind';
  END IF;
  RETURN NULL;
END;
$$;

-- A selected parent and its first include must be saved in one transaction.
CREATE CONSTRAINT TRIGGER vault_nomination_complete_on_parent
  AFTER INSERT OR UPDATE ON public.vault_nominations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION lf_vault_nomination_private.validate_complete_scope();
CREATE CONSTRAINT TRIGGER vault_nomination_complete_on_scope
  AFTER INSERT OR UPDATE OR DELETE ON public.vault_nomination_records
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION lf_vault_nomination_private.validate_complete_scope();

CREATE FUNCTION lf_vault_nomination_private.audit_nomination()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_action text;
  v_nomination_id uuid;
  v_resource_id uuid;
  v_actor uuid;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'vault_nominations' THEN
    IF TG_OP = 'INSERT' THEN v_action := 'nomination.created';
    ELSIF OLD.status = 'active' AND NEW.status = 'cancelled' THEN v_action := 'nomination.cancelled';
    ELSIF (NEW.scope, NEW.notify_person) IS DISTINCT FROM (OLD.scope, OLD.notify_person) THEN
      v_action := 'nomination.changed';
    ELSE RETURN NEW; END IF;
    v_nomination_id := NEW.id;
    v_actor := COALESCE(auth.uid(), NEW.created_by);
  ELSE
    v_nomination_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.nomination_id ELSE NEW.nomination_id END;
    v_resource_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.record_id ELSE NEW.record_id END;
    v_action := CASE WHEN TG_OP = 'DELETE' THEN 'nomination.scope_removed' ELSE 'nomination.scope_added' END;
    v_actor := COALESCE(auth.uid(), CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END);
    v_metadata := jsonb_build_object('record_id', v_resource_id);
  END IF;
  INSERT INTO public.audit_events (
    category, action, result, actor_user_id, resource_type, resource_id,
    route, policy_decision, metadata
  ) VALUES (
    'vault_nomination', v_action, 'success', v_actor, 'vault_nomination',
    v_nomination_id::text, 'vault_nomination', 'allowed', v_metadata
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER vault_nominations_audit
  AFTER INSERT OR UPDATE ON public.vault_nominations
  FOR EACH ROW EXECUTE FUNCTION lf_vault_nomination_private.audit_nomination();
CREATE TRIGGER vault_nomination_records_audit
  AFTER INSERT OR DELETE ON public.vault_nomination_records
  FOR EACH ROW EXECUTE FUNCTION lf_vault_nomination_private.audit_nomination();

REVOKE ALL ON FUNCTION lf_vault_nomination_private.validate_nomination() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lf_vault_nomination_private.validate_scope_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lf_vault_nomination_private.validate_complete_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lf_vault_nomination_private.audit_nomination() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.vault_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_nomination_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_nominations, public.vault_nomination_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vault_nominations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.vault_nomination_records TO authenticated;

CREATE POLICY vault_nominations_owner_select ON public.vault_nominations
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY vault_nominations_owner_insert ON public.vault_nominations
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = owner_user_id
    AND created_by = owner_user_id
    AND public.lf_vault_allows_owner_mutation(owner_user_id)
  );
CREATE POLICY vault_nominations_owner_update ON public.vault_nominations
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id))
  WITH CHECK ((SELECT auth.uid()) = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY vault_nomination_records_owner_select ON public.vault_nomination_records
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY vault_nomination_records_owner_insert ON public.vault_nomination_records
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = owner_user_id
    AND created_by = owner_user_id
    AND public.lf_vault_allows_owner_mutation(owner_user_id)
  );
CREATE POLICY vault_nomination_records_owner_delete ON public.vault_nomination_records
  FOR DELETE TO authenticated USING (
    (SELECT auth.uid()) = owner_user_id
    AND public.lf_vault_allows_owner_mutation(owner_user_id)
    AND EXISTS (
      SELECT 1 FROM public.vault_nominations n
      WHERE n.id = nomination_id AND n.status = 'active'
    )
  );

-- The authenticated recipient gets kind and state only after the invitation
-- accepted_user_id and canonical contact linked_user_id independently bind to
-- the same session. This function grants no direct table access to nominees.
CREATE FUNCTION public.my_vault_nomination_status()
RETURNS TABLE (kind text, status text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT n.kind, n.status
  FROM public.vault_nominations n
  JOIN public.contacts c
    ON c.id = n.person_id AND c.owner_user_id = n.owner_user_id
  WHERE auth.uid() IS NOT NULL
    AND c.linked_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.contact_invitations i
      WHERE i.contact_id = c.id AND i.owner_user_id = n.owner_user_id
        AND i.accepted_user_id = auth.uid()
        AND i.invitation_status IN ('accepted', 'verified', 'active')
    );
$$;
REVOKE ALL ON FUNCTION public.my_vault_nomination_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vault_nomination_status() TO authenticated;

-- This migration deliberately adds no account_access_grants row, grant source,
-- grant expiry, legal authority evidence, death-release action or storage policy.
