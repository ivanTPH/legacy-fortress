-- Vault access foundation (V5.2 Vault Access, owner-approved 30 Oct 2026 for TEST).
-- Adds nominations for later, the records a nomination covers, Power of Attorney
-- authorities and inert source fields on access grants.
--
-- NOTHING HERE GRANTS ACCESS. Access is still created only by the permission
-- service (Give access, an approved estate release, or an activated authority).
-- No existing RLS function, access policy, identity rule or death-release rule changes.
--
-- Owner decisions (OWNER_DECISIONS_VAULT_ACCESS.md, 30 Oct 2026):
--   release always waits for the grant of probate; nominees see only kind and state;
--   several nominees are released together; Wills are kept out of attorney scope;
--   any nominee or executor may report a death (enforced in the death-report flow).

-- 1. Nominations for later ------------------------------------------------------
CREATE TABLE public.vault_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'estate' CHECK (kind = 'estate'),
  scope text NOT NULL CHECK (scope IN ('whole_vault', 'selected')),
  view_level text NOT NULL DEFAULT 'view_only' CHECK (view_level = 'view_only'),
  -- Owner decision 1/7: release always waits for the grant of probate.
  release_condition text NOT NULL DEFAULT 'death_release_and_probate'
    CHECK (release_condition = 'death_release_and_probate'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'released', 'ended')),
  notify_person boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  released_at timestamptz,
  CONSTRAINT vault_nomination_cancel_consistency CHECK (
    (status = 'cancelled') = (cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
  ),
  CONSTRAINT vault_nomination_release_consistency CHECK (
    (status IN ('released', 'ended')) = (released_at IS NOT NULL) OR status = 'ended'
  )
);

CREATE UNIQUE INDEX vault_nominations_one_active_person_kind_idx
  ON public.vault_nominations (vault_id, person_id, kind) WHERE status = 'active';
CREATE INDEX vault_nominations_owner_status_idx
  ON public.vault_nominations (owner_user_id, status, created_at DESC);
CREATE INDEX vault_nominations_person_status_idx
  ON public.vault_nominations (person_id, status);

-- include = selected records; exclude = whole-Vault exceptions (never shown to the nominee).
-- Canonical assets carry wallet_id; legacy records (Wills, LPAs...) are matched by owner.
CREATE TABLE public.vault_nomination_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id uuid NOT NULL REFERENCES public.vault_nominations(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  record_type text NOT NULL CHECK (record_type IN ('asset', 'record')),
  record_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('include', 'exclude')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vault_nomination_record_once UNIQUE (nomination_id, record_type, record_id)
);
CREATE INDEX vault_nomination_records_owner_idx
  ON public.vault_nomination_records (owner_user_id, nomination_id, mode);
CREATE INDEX vault_nomination_records_record_idx
  ON public.vault_nomination_records (record_type, record_id);

-- 2. Power of Attorney ----------------------------------------------------------
CREATE TABLE public.legal_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  authority_type text NOT NULL CHECK (authority_type IN (
    'lpa_property_finance', 'lpa_health_welfare', 'enduring_poa', 'general_poa', 'other')),
  registered text NOT NULL CHECK (registered IN ('yes', 'no', 'unknown')),
  usable_when text NOT NULL CHECK (usable_when IN ('with_consent', 'lacks_capacity_only')),
  document_type text CHECK (document_type IN ('document', 'attachment')),
  document_id uuid,
  -- Areas can only ever be narrowed. Wills are never in attorney scope (owner decision 5).
  scope_areas text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (scope_areas <@ ARRAY['profile', 'finances', 'legal', 'property', 'business', 'digital', 'possessions']::text[]),
  status text NOT NULL DEFAULT 'pending_check' CHECK (status IN (
    'pending_check', 'confirmed', 'needs_attention', 'rejected', 'withdrawn', 'ended')),
  activated_at timestamptz,
  activated_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  withdrawn_at timestamptz,
  withdrawn_reason text CHECK (withdrawn_reason IS NULL OR length(withdrawn_reason) <= 300),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT legal_authority_health_welfare_capacity CHECK (
    authority_type <> 'lpa_health_welfare' OR usable_when = 'lacks_capacity_only'
  ),
  CONSTRAINT legal_authority_document_pair CHECK ((document_type IS NULL) = (document_id IS NULL)),
  CONSTRAINT legal_authority_withdrawal_consistency CHECK (
    (status = 'withdrawn') = (withdrawn_at IS NOT NULL)
  ),
  CONSTRAINT legal_authority_activation_consistency CHECK (
    (activated_at IS NULL) = (activated_by IS NULL)
    AND (activated_at IS NULL OR status IN ('confirmed', 'withdrawn', 'ended'))
  )
);
CREATE INDEX legal_authorities_owner_status_idx ON public.legal_authorities (owner_user_id, status, created_at DESC);
CREATE INDEX legal_authorities_person_idx ON public.legal_authorities (person_id, status);

-- Sensitive free text kept apart from the authority row: owner only in the app;
-- reviewers reach it through Platform Admin's server routes, never the browser client.
CREATE TABLE public.legal_authority_private (
  authority_id uuid PRIMARY KEY REFERENCES public.legal_authorities(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_ref text CHECK (registration_ref IS NULL OR length(registration_ref) <= 60),
  restrictions_note text CHECK (restrictions_note IS NULL OR length(restrictions_note) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- 3. Inert source fields on existing grants -------------------------------------
-- Recorded for later release and authority flows. No access function reads them yet.
ALTER TABLE public.account_access_grants
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'owner_grant'
    CHECK (source IN ('owner_grant', 'estate_release', 'legal_authority')),
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- 4. Validation ------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS lf_vault_access_private;
REVOKE ALL ON SCHEMA lf_vault_access_private FROM PUBLIC, anon, authenticated;

CREATE FUNCTION lf_vault_access_private.validate_nomination()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_session uuid := auth.uid();
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = NEW.vault_id AND w.owner_user_id = NEW.owner_user_id AND w.status = 'active')
         AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.person_id AND c.owner_user_id = NEW.owner_user_id)) THEN
    RAISE EXCEPTION 'Nomination Vault and person must belong to the owner';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by <> NEW.owner_user_id OR NEW.status <> 'active'
       OR NEW.cancelled_by IS NOT NULL OR NEW.cancelled_at IS NOT NULL OR NEW.released_at IS NOT NULL THEN
      RAISE EXCEPTION 'Only an owner-created active nomination may be added';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.owner_user_id, NEW.vault_id, NEW.person_id, NEW.kind, NEW.view_level,
      NEW.release_condition, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.owner_user_id, OLD.vault_id, OLD.person_id, OLD.kind, OLD.view_level,
      OLD.release_condition, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Who and what a nomination is for cannot change; cancel it and add a new one';
  END IF;
  IF OLD.status <> 'active' THEN
    RAISE EXCEPTION 'Only an active nomination can change';
  END IF;
  -- An owner session may only change scope/notify or cancel. Release and end are
  -- written by the estate release service (no browser session), never by a client.
  IF v_session IS NOT NULL AND NEW.status IN ('released', 'ended') THEN
    RAISE EXCEPTION 'Nominations are released only by an approved estate release';
  END IF;
  IF NEW.status = 'cancelled' THEN
    IF (NEW.scope, NEW.notify_person) IS DISTINCT FROM (OLD.scope, OLD.notify_person) THEN
      RAISE EXCEPTION 'Cancel separately from other changes';
    END IF;
    NEW.cancelled_by := COALESCE(v_session, OLD.owner_user_id);
    NEW.cancelled_at := timezone('utc', now());
  ELSIF NEW.status = 'released' THEN
    NEW.released_at := timezone('utc', now());
  ELSIF NEW.status = 'active' AND (NEW.cancelled_by IS NOT NULL OR NEW.cancelled_at IS NOT NULL OR NEW.released_at IS NOT NULL) THEN
    RAISE EXCEPTION 'An active nomination cannot carry cancellation or release details';
  END IF;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;
CREATE TRIGGER vault_nominations_validate
  BEFORE INSERT OR UPDATE ON public.vault_nominations
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.validate_nomination();

CREATE FUNCTION lf_vault_access_private.validate_scope_row()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_nomination public.vault_nominations;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Scope rows cannot change; remove and add instead';
  END IF;
  SELECT * INTO v_nomination FROM public.vault_nominations WHERE id = NEW.nomination_id;
  IF NOT FOUND OR v_nomination.status <> 'active'
     OR NEW.owner_user_id <> v_nomination.owner_user_id
     OR NEW.vault_id <> v_nomination.vault_id
     OR NEW.created_by <> NEW.owner_user_id
     OR (v_nomination.scope = 'selected' AND NEW.mode <> 'include')
     OR (v_nomination.scope = 'whole_vault' AND NEW.mode <> 'exclude') THEN
    RAISE EXCEPTION 'Scope must match an active nomination from the same Vault';
  END IF;
  IF NEW.record_type = 'asset' AND NOT EXISTS (
       SELECT 1 FROM public.assets a WHERE a.id = NEW.record_id AND a.owner_user_id = NEW.owner_user_id
         AND a.wallet_id = NEW.vault_id AND a.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Record must be in the owner''s Vault';
  END IF;
  IF NEW.record_type = 'record' AND NOT EXISTS (
       SELECT 1 FROM public.records r WHERE r.id = NEW.record_id AND r.owner_user_id = NEW.owner_user_id
         AND r.archived_at IS NULL) THEN
    RAISE EXCEPTION 'Record must be in the owner''s Vault';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER vault_nomination_records_validate
  BEFORE INSERT OR UPDATE ON public.vault_nomination_records
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.validate_scope_row();

-- A selected nomination always covers at least one record (checked at commit).
CREATE FUNCTION lf_vault_access_private.validate_complete_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_nomination public.vault_nominations;
BEGIN
  IF TG_TABLE_NAME = 'vault_nominations' THEN v_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN v_id := OLD.nomination_id;
  ELSE v_id := NEW.nomination_id; END IF;
  SELECT * INTO v_nomination FROM public.vault_nominations WHERE id = v_id;
  IF NOT FOUND OR v_nomination.status <> 'active' THEN RETURN NULL; END IF;
  IF v_nomination.scope = 'selected' AND NOT EXISTS (
    SELECT 1 FROM public.vault_nomination_records r WHERE r.nomination_id = v_id AND r.mode = 'include'
  ) THEN
    RAISE EXCEPTION 'Choose at least one record for this nomination';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vault_nomination_records r WHERE r.nomination_id = v_id
      AND ((v_nomination.scope = 'selected' AND r.mode <> 'include')
        OR (v_nomination.scope = 'whole_vault' AND r.mode <> 'exclude'))
  ) THEN
    RAISE EXCEPTION 'Scope rows don''t match the nomination';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER vault_nomination_complete_on_parent
  AFTER INSERT OR UPDATE ON public.vault_nominations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION lf_vault_access_private.validate_complete_scope();
CREATE CONSTRAINT TRIGGER vault_nomination_complete_on_scope
  AFTER INSERT OR DELETE ON public.vault_nomination_records
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION lf_vault_access_private.validate_complete_scope();

CREATE FUNCTION lf_vault_access_private.validate_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_session uuid := auth.uid();
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = NEW.vault_id AND w.owner_user_id = NEW.owner_user_id AND w.status = 'active')
         AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.person_id AND c.owner_user_id = NEW.owner_user_id)) THEN
    RAISE EXCEPTION 'Authority Vault and person must belong to the owner';
  END IF;
  IF NEW.document_type = 'document' AND NOT EXISTS (
       SELECT 1 FROM public.documents d WHERE d.id = NEW.document_id AND d.owner_user_id = NEW.owner_user_id) THEN
    RAISE EXCEPTION 'Authority document must be one of the owner''s documents';
  END IF;
  IF NEW.document_type = 'attachment' AND NOT EXISTS (
       SELECT 1 FROM public.attachments a WHERE a.id = NEW.document_id AND a.owner_user_id = NEW.owner_user_id) THEN
    RAISE EXCEPTION 'Authority document must be one of the owner''s documents';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by <> NEW.owner_user_id OR NEW.status <> 'pending_check'
       OR NEW.activated_at IS NOT NULL OR NEW.withdrawn_at IS NOT NULL THEN
      RAISE EXCEPTION 'A new authority starts as waiting for a check';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.owner_user_id, NEW.vault_id, NEW.person_id, NEW.authority_type, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.owner_user_id, OLD.vault_id, OLD.person_id, OLD.authority_type, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Who an authority is for and its type cannot change; withdraw it and record a new one';
  END IF;
  IF OLD.status IN ('withdrawn', 'ended', 'rejected') THEN
    RAISE EXCEPTION 'A closed authority cannot change';
  END IF;
  -- Scope can only ever be narrowed.
  IF NOT (NEW.scope_areas <@ OLD.scope_areas) THEN
    RAISE EXCEPTION 'Areas can only be narrowed';
  END IF;
  IF v_session IS NOT NULL THEN
    -- The owner may correct details while it waits for a check, narrow areas, or withdraw.
    -- Checking, confirming and activating are reviewer actions in Platform Admin.
    IF NEW.status NOT IN (OLD.status, 'withdrawn')
       OR (NEW.activated_at, NEW.activated_by) IS DISTINCT FROM (OLD.activated_at, OLD.activated_by) THEN
      RAISE EXCEPTION 'Authorities are checked and activated by the review team';
    END IF;
    IF OLD.status <> 'pending_check'
       AND (NEW.registered, NEW.usable_when, NEW.document_type, NEW.document_id)
           IS DISTINCT FROM (OLD.registered, OLD.usable_when, OLD.document_type, OLD.document_id) THEN
      RAISE EXCEPTION 'A checked authority cannot be edited; withdraw it and record a new one';
    END IF;
  END IF;
  IF NEW.status = 'withdrawn' AND OLD.status <> 'withdrawn' THEN
    NEW.withdrawn_at := timezone('utc', now());
  END IF;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;
CREATE TRIGGER legal_authorities_validate
  BEFORE INSERT OR UPDATE ON public.legal_authorities
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.validate_authority();

CREATE FUNCTION lf_vault_access_private.validate_authority_private()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.legal_authorities a
                 WHERE a.id = NEW.authority_id AND a.owner_user_id = NEW.owner_user_id) THEN
    RAISE EXCEPTION 'Details must belong to the owner''s authority';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.authority_id, NEW.owner_user_id) IS DISTINCT FROM (OLD.authority_id, OLD.owner_user_id) THEN
    RAISE EXCEPTION 'Authority and owner cannot change';
  END IF;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;
CREATE TRIGGER legal_authority_private_validate
  BEFORE INSERT OR UPDATE ON public.legal_authority_private
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.validate_authority_private();

-- 5. Audit (who, when, which; never values, scope names or document text) --------
CREATE FUNCTION lf_vault_access_private.audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_action text;
  v_resource text;
  v_id uuid;
  v_actor uuid;
BEGIN
  IF TG_TABLE_NAME = 'vault_nominations' THEN
    v_resource := 'vault_nomination'; v_id := NEW.id; v_actor := COALESCE(auth.uid(), NEW.owner_user_id);
    IF TG_OP = 'INSERT' THEN v_action := 'nomination.created';
    ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN v_action := 'nomination.cancelled';
    ELSIF NEW.status = 'released' AND OLD.status <> 'released' THEN v_action := 'nomination.released';
    ELSIF NEW.status = 'ended' AND OLD.status <> 'ended' THEN v_action := 'nomination.ended';
    ELSIF (NEW.scope, NEW.notify_person) IS DISTINCT FROM (OLD.scope, OLD.notify_person) THEN v_action := 'nomination.changed';
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'vault_nomination_records' THEN
    v_resource := 'vault_nomination';
    v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.nomination_id ELSE NEW.nomination_id END;
    v_actor := COALESCE(auth.uid(), CASE WHEN TG_OP = 'DELETE' THEN OLD.owner_user_id ELSE NEW.owner_user_id END);
    v_action := CASE
      WHEN TG_OP = 'DELETE' AND OLD.mode = 'exclude' THEN 'nomination.exception_removed'
      WHEN TG_OP = 'DELETE' THEN 'nomination.scope_removed'
      WHEN NEW.mode = 'exclude' THEN 'nomination.exception_added'
      ELSE 'nomination.scope_added' END;
  ELSE
    v_resource := 'legal_authority'; v_id := NEW.id; v_actor := COALESCE(auth.uid(), NEW.owner_user_id);
    IF TG_OP = 'INSERT' THEN v_action := 'authority.recorded';
    ELSIF NEW.status <> OLD.status THEN v_action := 'authority.' || CASE NEW.status
      WHEN 'confirmed' THEN 'confirmed' WHEN 'needs_attention' THEN 'needs_attention'
      WHEN 'rejected' THEN 'rejected' WHEN 'withdrawn' THEN 'withdrawn' WHEN 'ended' THEN 'ended' ELSE 'checked' END;
    ELSIF NEW.activated_at IS NOT NULL AND OLD.activated_at IS NULL THEN v_action := 'authority.activated';
    ELSE v_action := 'authority.changed'; END IF;
  END IF;
  INSERT INTO public.audit_events (category, action, result, actor_user_id, resource_type, resource_id, route, policy_decision, metadata)
  VALUES ('vault_access', v_action, 'success', v_actor, v_resource, v_id::text, v_resource, 'allowed', '{}'::jsonb);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER vault_nominations_audit AFTER INSERT OR UPDATE ON public.vault_nominations
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit();
CREATE TRIGGER vault_nomination_records_audit AFTER INSERT OR DELETE ON public.vault_nomination_records
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit();
CREATE TRIGGER legal_authorities_audit AFTER INSERT OR UPDATE ON public.legal_authorities
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lf_vault_access_private FROM PUBLIC, anon, authenticated;

-- 6. Row-level security: owners only; nothing across Vaults -----------------------
ALTER TABLE public.vault_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_nomination_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_authority_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_nominations, public.vault_nomination_records, public.legal_authorities, public.legal_authority_private
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vault_nominations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.vault_nomination_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.legal_authorities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.legal_authority_private TO authenticated;

CREATE POLICY vault_nominations_owner_select ON public.vault_nominations
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY vault_nominations_owner_insert ON public.vault_nominations
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_user_id AND created_by = owner_user_id
    AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY vault_nominations_owner_update ON public.vault_nominations
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id))
  WITH CHECK ((SELECT auth.uid()) = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));

CREATE POLICY vault_nomination_records_owner_select ON public.vault_nomination_records
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY vault_nomination_records_owner_insert ON public.vault_nomination_records
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_user_id AND created_by = owner_user_id
    AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY vault_nomination_records_owner_delete ON public.vault_nomination_records
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = owner_user_id
    AND public.lf_vault_allows_owner_mutation(owner_user_id)
    AND EXISTS (SELECT 1 FROM public.vault_nominations n WHERE n.id = nomination_id AND n.status = 'active'));

CREATE POLICY legal_authorities_owner_select ON public.legal_authorities
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_user_id);
CREATE POLICY legal_authorities_owner_insert ON public.legal_authorities
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_user_id AND created_by = owner_user_id
    AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY legal_authorities_owner_update ON public.legal_authorities
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id))
  WITH CHECK ((SELECT auth.uid()) = owner_user_id AND public.lf_vault_allows_owner_mutation(owner_user_id));

CREATE POLICY legal_authority_private_owner_all ON public.legal_authority_private
  FOR ALL TO authenticated USING ((SELECT auth.uid()) = owner_user_id) WITH CHECK ((SELECT auth.uid()) = owner_user_id);

-- 7. What a nominee may know before release: only that they're nominated, the kind and
-- the state, and only if the owner chose to tell them, once their invitation and contact
-- are bound to their own session.
-- Never scope, record names, counts, values or documents.
CREATE FUNCTION public.my_vault_nomination_status()
RETURNS TABLE (owner_display_name text, kind text, status text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT COALESCE(NULLIF(btrim(p.display_name), ''), 'Your contact') AS owner_display_name, n.kind, n.status
  FROM public.vault_nominations n
  JOIN public.contacts c ON c.id = n.person_id AND c.owner_user_id = n.owner_user_id
  LEFT JOIN public.user_profiles p ON p.user_id = n.owner_user_id
  WHERE auth.uid() IS NOT NULL
    AND n.status IN ('active', 'released')
    AND (n.notify_person OR n.status = 'released')
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

-- 8. Save a nomination and its records in one transaction (SECURITY INVOKER: RLS and the
-- triggers above still apply). p_records is [{"type":"asset"|"record","id":uuid}, ...]:
-- included records for 'selected', exceptions for 'whole_vault'. No access is created.
CREATE FUNCTION public.lf_save_vault_nomination(
  p_person_id uuid,
  p_scope text,
  p_records jsonb DEFAULT '[]'::jsonb,
  p_notify_person boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_vault uuid;
  v_id uuid;
  v_item jsonb;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Sign in to nominate someone.' USING ERRCODE = '28000'; END IF;
  IF p_scope NOT IN ('whole_vault', 'selected') THEN RAISE EXCEPTION 'Choose whole Vault or selected records.' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(COALESCE(p_records, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p_records, '[]'::jsonb)) > 500 THEN
    RAISE EXCEPTION 'Too many records.' USING ERRCODE = '22023';
  END IF;
  SELECT w.id INTO v_vault FROM public.wallets w
    WHERE w.owner_user_id = v_owner AND w.status = 'active' ORDER BY w.created_at LIMIT 1;
  IF v_vault IS NULL THEN RAISE EXCEPTION 'Your Vault isn''t ready yet.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.vault_nominations (owner_user_id, vault_id, person_id, scope, notify_person)
  VALUES (v_owner, v_vault, p_person_id, p_scope, COALESCE(p_notify_person, false))
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_records, '[]'::jsonb)) LOOP
    INSERT INTO public.vault_nomination_records (nomination_id, owner_user_id, vault_id, record_type, record_id, mode)
    VALUES (v_id, v_owner, v_vault, v_item->>'type', (v_item->>'id')::uuid,
            CASE WHEN p_scope = 'selected' THEN 'include' ELSE 'exclude' END);
  END LOOP;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_save_vault_nomination(uuid, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_save_vault_nomination(uuid, text, jsonb, boolean) TO authenticated;
