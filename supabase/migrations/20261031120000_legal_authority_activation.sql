-- Power of Attorney: review and activation (owner approval 31 Oct 2026: "Yes").
-- Rules (VAULT_ACCESS.md rule 7, acceptance 20):
--   * Access only when the attorney's ID is verified, the authority is confirmed by the review
--     team and activation is recorded. Activation is a server-only action.
--   * Scope never exceeds the authority's areas; Wills (Legal) are never included.
--   * Withdrawal, rejection or ending stops access at once.
--   * Existing access functions are unchanged: the grant carries explicit asset/record IDs and
--     keeps the existing identity and lifecycle gate (lifetime access pauses when a death is reported).

-- 1. Review history: what the review team told the owner. Owners read their own rows;
--    only server routes write them.
CREATE TABLE public.legal_authority_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_id uuid NOT NULL REFERENCES public.legal_authorities(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('confirmed', 'needs_attention', 'rejected', 'activated', 'ended')),
  message_to_owner text CHECK (message_to_owner IS NULL OR length(message_to_owner) <= 500),
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX legal_authority_reviews_authority_idx ON public.legal_authority_reviews (authority_id, created_at DESC);
ALTER TABLE public.legal_authority_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_authority_reviews_owner_select ON public.legal_authority_reviews
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
REVOKE ALL ON public.legal_authority_reviews FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.legal_authority_reviews FROM authenticated;

-- 2. Which records fall inside an authority's areas. Legal is never matched.
CREATE FUNCTION lf_vault_access_private.authority_area_matches(p_areas text[], p_section text, p_category text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_section, '') <> 'legal' AND (
       (COALESCE(p_section, '') = ANY(p_areas) AND p_section IN ('finances', 'property', 'business', 'digital', 'possessions'))
    OR ('possessions' = ANY(p_areas) AND p_section = 'personal' AND p_category = 'possessions')
  );
$$;

CREATE FUNCTION lf_vault_access_private.authority_scope_ids(p_owner uuid, p_areas text[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'asset_ids', COALESCE((SELECT jsonb_agg(a.id::text ORDER BY a.id) FROM public.assets a
       WHERE a.owner_user_id = p_owner AND a.deleted_at IS NULL
         AND lf_vault_access_private.authority_area_matches(p_areas, a.section_key, a.category_key)), '[]'::jsonb),
    'record_ids', COALESCE((SELECT jsonb_agg(r.id::text ORDER BY r.id) FROM public.records r
       WHERE r.owner_user_id = p_owner AND r.archived_at IS NULL
         AND lf_vault_access_private.authority_area_matches(p_areas, r.section_key, r.category_key)), '[]'::jsonb)
  );
$$;

CREATE FUNCTION lf_vault_access_private.merge_previous_ids(p_override jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  -- Anything the owner had shared with this person before stays visible while the authority is active.
  SELECT p_override || jsonb_build_object(
    'asset_ids', COALESCE((SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements_text(
        COALESCE(p_override -> 'asset_ids', '[]'::jsonb) || COALESCE(p_override -> 'previous_grant' -> 'override' -> 'asset_ids', '[]'::jsonb)) v), '[]'::jsonb),
    'record_ids', COALESCE((SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements_text(
        COALESCE(p_override -> 'record_ids', '[]'::jsonb) || COALESCE(p_override -> 'previous_grant' -> 'override' -> 'record_ids', '[]'::jsonb)) v), '[]'::jsonb));
$$;

-- 3. Activation. Callable only by the server (service role) after the review team confirms.
CREATE FUNCTION public.lf_activate_legal_authority(p_authority_id uuid, p_reviewer_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_auth public.legal_authorities%ROWTYPE;
  v_linked uuid;
  v_areas text[];
  v_scope jsonb;
  v_grant uuid;
  v_override jsonb;
  v_existing public.account_access_grants%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Authorities are activated by the review team' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_auth FROM public.legal_authorities WHERE id = p_authority_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Authority not found' USING ERRCODE = 'P0002'; END IF;
  IF v_auth.status <> 'confirmed' THEN RAISE EXCEPTION 'Confirm the authority before activating it' USING ERRCODE = '22023'; END IF;
  IF v_auth.activated_at IS NOT NULL THEN RAISE EXCEPTION 'This authority is already active' USING ERRCODE = '22023'; END IF;
  SELECT c.linked_user_id INTO v_linked FROM public.contacts c
    WHERE c.id = v_auth.person_id AND c.owner_user_id = v_auth.owner_user_id;
  IF v_linked IS NULL THEN RAISE EXCEPTION 'The attorney has not joined yet' USING ERRCODE = '22023'; END IF;
  IF v_linked = v_auth.owner_user_id THEN RAISE EXCEPTION 'An owner cannot be their own attorney' USING ERRCODE = '22023'; END IF;
  IF public.lf_identity_assurance_level(v_linked) < 2 THEN
    RAISE EXCEPTION 'The attorney''s ID has not been verified' USING ERRCODE = '22023';
  END IF;
  IF public.lf_vault_lifecycle_state(v_auth.owner_user_id) <> 'OWNER_ACTIVE' THEN
    RAISE EXCEPTION 'A Power of Attorney cannot start after a death has been reported' USING ERRCODE = '22023';
  END IF;
  v_areas := array_remove(v_auth.scope_areas, 'legal');
  IF COALESCE(array_length(v_areas, 1), 0) = 0 THEN RAISE EXCEPTION 'The authority covers no areas' USING ERRCODE = '22023'; END IF;
  v_scope := lf_vault_access_private.authority_scope_ids(v_auth.owner_user_id, v_areas);

  v_override := jsonb_build_object('scope', 'legal_authority', 'authority_id', v_auth.id, 'areas', to_jsonb(v_areas),
      'allowed_sections', to_jsonb(v_areas), 'read_only', true, 'no_billing', true, 'no_owner_settings', true,
      'asset_ids', v_scope -> 'asset_ids', 'record_ids', v_scope -> 'record_ids', 'activated_at', v_now);
  -- One grant per person and role. If the person already has an owner-made power_of_attorney
  -- grant (for example from their invitation), keep a copy and restore it exactly when the
  -- authority stops.
  SELECT * INTO v_existing FROM public.account_access_grants
    WHERE owner_user_id = v_auth.owner_user_id AND linked_user_id = v_linked AND assigned_role = 'power_of_attorney'
    FOR UPDATE;
  IF FOUND THEN
    IF v_existing.source = 'legal_authority' AND v_existing.source_id IS DISTINCT FROM v_auth.id
       AND v_existing.activation_status = 'active' THEN
      RAISE EXCEPTION 'This person already has another active authority' USING ERRCODE = '23505';
    END IF;
    IF v_existing.source = 'owner_grant' THEN
      v_override := v_override || jsonb_build_object('previous_grant', jsonb_build_object(
        'override', v_existing.permissions_override, 'status', v_existing.activation_status,
        'required_identity_level', v_existing.required_identity_level));
    ELSIF v_existing.permissions_override ? 'previous_grant' THEN
      v_override := v_override || jsonb_build_object('previous_grant', v_existing.permissions_override -> 'previous_grant');
    END IF;
    UPDATE public.account_access_grants SET activation_status = 'active', required_identity_level = 2,
        permissions_override = lf_vault_access_private.merge_previous_ids(v_override), source = 'legal_authority', source_id = v_auth.id, paused_at = NULL, updated_at = v_now
      WHERE id = v_existing.id RETURNING id INTO v_grant;
  ELSE
    INSERT INTO public.account_access_grants (
      owner_user_id, linked_user_id, contact_id, invitation_id, assigned_role, relationship,
      activation_status, required_identity_level, permissions_override, source, source_id, updated_at)
    VALUES (v_auth.owner_user_id, v_linked, NULL, NULL, 'power_of_attorney', 'Attorney',
      'active', 2, v_override, 'legal_authority', v_auth.id, v_now)
    RETURNING id INTO v_grant;
  END IF;

  UPDATE public.legal_authorities SET activated_at = v_now, activated_by = p_reviewer_user_id WHERE id = v_auth.id;
  INSERT INTO public.legal_authority_reviews (authority_id, owner_user_id, action, message_to_owner, reviewer_user_id)
    VALUES (v_auth.id, v_auth.owner_user_id, 'activated', NULL, p_reviewer_user_id);
  RETURN v_grant;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_activate_legal_authority(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lf_activate_legal_authority(uuid, uuid) TO service_role;

-- 4. Stop at once: withdrawn, rejected, ended or sent back; keep scope narrowed with the areas.
CREATE FUNCTION lf_vault_access_private.sync_authority_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_areas text[] := array_remove(NEW.scope_areas, 'legal');
  v_scope jsonb;
BEGIN
  IF NEW.status <> 'confirmed' OR NEW.activated_at IS NULL THEN
    -- Restore a grant the owner had made before activation; otherwise revoke.
    UPDATE public.account_access_grants
      SET permissions_override = permissions_override -> 'previous_grant' -> 'override',
          activation_status = permissions_override -> 'previous_grant' ->> 'status',
          required_identity_level = COALESCE((permissions_override -> 'previous_grant' ->> 'required_identity_level')::int, 2),
          source = 'owner_grant', source_id = NULL, updated_at = timezone('utc', now())
      WHERE source = 'legal_authority' AND source_id = NEW.id AND owner_user_id = NEW.owner_user_id
        AND permissions_override ? 'previous_grant';
    UPDATE public.account_access_grants
      SET activation_status = 'revoked', paused_at = timezone('utc', now()),
          permissions_override = permissions_override || jsonb_build_object('asset_ids', '[]'::jsonb, 'record_ids', '[]'::jsonb, 'areas', '[]'::jsonb, 'allowed_sections', '[]'::jsonb),
          updated_at = timezone('utc', now())
      WHERE source = 'legal_authority' AND source_id = NEW.id AND owner_user_id = NEW.owner_user_id;
  ELSIF NEW.scope_areas IS DISTINCT FROM OLD.scope_areas THEN
    v_scope := lf_vault_access_private.authority_scope_ids(NEW.owner_user_id, v_areas);
    UPDATE public.account_access_grants
      SET permissions_override = lf_vault_access_private.merge_previous_ids(permissions_override || jsonb_build_object('asset_ids', v_scope -> 'asset_ids',
            'record_ids', v_scope -> 'record_ids', 'areas', to_jsonb(v_areas), 'allowed_sections', to_jsonb(v_areas))),
          updated_at = timezone('utc', now())
      WHERE source = 'legal_authority' AND source_id = NEW.id AND owner_user_id = NEW.owner_user_id AND activation_status = 'active';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER legal_authorities_sync_grant
  AFTER UPDATE OF status, scope_areas, activated_at ON public.legal_authorities
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.sync_authority_grant();

-- 5. Records added, moved or removed later stay in step with active authority areas.
CREATE FUNCTION lf_vault_access_private.sync_authority_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_key text := CASE WHEN TG_TABLE_NAME = 'assets' THEN 'asset_ids' ELSE 'record_ids' END;
  v_removed boolean := CASE WHEN TG_TABLE_NAME = 'assets' THEN NEW.deleted_at IS NOT NULL ELSE NEW.archived_at IS NOT NULL END;
  g record;
  v_ids jsonb;
BEGIN
  FOR g IN
    SELECT gr.id, gr.permissions_override, la.scope_areas
    FROM public.account_access_grants gr
    JOIN public.legal_authorities la ON la.id = gr.source_id AND la.owner_user_id = gr.owner_user_id
    WHERE gr.source = 'legal_authority' AND gr.owner_user_id = NEW.owner_user_id AND gr.activation_status = 'active'
      AND la.status = 'confirmed' AND la.activated_at IS NOT NULL
  LOOP
    v_ids := COALESCE(g.permissions_override -> v_key, '[]'::jsonb) - NEW.id::text;
    IF NOT v_removed AND (lf_vault_access_private.authority_area_matches(array_remove(g.scope_areas, 'legal'), NEW.section_key, NEW.category_key)
       OR COALESCE(g.permissions_override -> 'previous_grant' -> 'override' -> v_key, '[]'::jsonb) ? NEW.id::text) THEN
      v_ids := v_ids || to_jsonb(NEW.id::text);
    END IF;
    IF v_ids IS DISTINCT FROM COALESCE(g.permissions_override -> v_key, '[]'::jsonb) THEN
      UPDATE public.account_access_grants SET permissions_override = jsonb_set(permissions_override, ARRAY[v_key], v_ids), updated_at = timezone('utc', now())
        WHERE id = g.id;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER assets_sync_authority_grants
  AFTER INSERT OR UPDATE OF section_key, category_key, deleted_at ON public.assets
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.sync_authority_record();
CREATE TRIGGER records_sync_authority_grants
  AFTER INSERT OR UPDATE OF section_key, category_key, archived_at ON public.records
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.sync_authority_record();

-- 6. Only the server makes authority grants; owners can't create or re-point one.
CREATE FUNCTION lf_vault_access_private.guard_grant_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Direct browser writes run as anon/authenticated. Server routes and the protected
  -- functions above run as service_role or the function owner.
  IF current_user IN ('anon', 'authenticated') AND (
       NEW.source <> 'owner_grant'
    OR (TG_OP = 'UPDATE' AND (OLD.source <> 'owner_grant' OR OLD.source_id IS DISTINCT FROM NEW.source_id))) THEN
    RAISE EXCEPTION 'Only the review team can make or change access from an authority or a release' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_access_grants_guard_source
  BEFORE INSERT OR UPDATE ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.guard_grant_source();
