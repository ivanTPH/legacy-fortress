-- Estate release of nominations (VAULT_ACCESS.md rule 6, acceptance 17–18; owner decisions 30 Oct 2026:
-- always wait for probate; several nominees are released together).
--   * Release needs all four steps: death reported → evidence checked → death verified → release approved,
--     and an accepted grant of probate. Reporting a death alone never opens anything.
--   * Only ID-verified nominees are released; others wait until their ID is verified, then the review
--     team runs the release again.
--   * Released access is view only and covers exactly the nomination: the whole Vault minus the owner's
--     exceptions, or the selected records.
--   * Only the review team (server) can release.

-- 1. The identity gate: estate-release grants work only once the estate is locked for release;
--    every other grant still works only while the owner is active. Nothing else changes.
CREATE OR REPLACE FUNCTION public.lf_linked_grant_satisfies_identity(p_grant public.account_access_grants)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p_grant.linked_user_id = auth.uid()
    AND p_grant.activation_status = ANY(ARRAY['verified','active'])
    AND public.lf_identity_assurance_level(p_grant.linked_user_id) >= COALESCE(p_grant.required_identity_level, 2)
    AND CASE WHEN p_grant.source = 'estate_release'
             THEN public.lf_vault_lifecycle_state(p_grant.owner_user_id) = 'ESTATE_LOCKED'
             ELSE public.lf_vault_lifecycle_state(p_grant.owner_user_id) = 'OWNER_ACTIVE' END
    AND p_grant.paused_at IS NULL
    AND (p_grant.ends_at IS NULL OR p_grant.ends_at > timezone('utc', now()));
$$;

-- 2. Release. Server only.
CREATE FUNCTION public.lf_release_vault_nominations(p_owner_user_id uuid, p_reviewer_user_id uuid, p_probate_case_id uuid)
RETURNS TABLE (released integer, waiting_for_id integer, not_joined integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_state text;
  v_nom record;
  v_linked uuid;
  v_assets jsonb;
  v_records jsonb;
  v_grant public.account_access_grants%ROWTYPE;
  v_override jsonb;
  v_released integer := 0;
  v_waiting integer := 0;
  v_not_joined integer := 0;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Releases are approved by the review team' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE((SELECT w.vault_lifecycle_state FROM public.wallets w
                   WHERE w.owner_user_id = p_owner_user_id AND w.status = 'active'
                   ORDER BY w.updated_at DESC LIMIT 1), 'OWNER_ACTIVE') INTO v_state;
  IF v_state <> 'ESTATE_LOCKED' THEN
    RAISE EXCEPTION 'The death must be verified and the estate locked before release' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.probate_cases pc
    WHERE pc.id = p_probate_case_id AND pc.owner_user_id = p_owner_user_id AND pc.status = 'approved'
      AND EXISTS (SELECT 1 FROM public.probate_case_evidence e
                  WHERE e.case_id = pc.id AND e.deleted_at IS NULL AND e.evidence_type = 'probate_grant')
  ) THEN
    RAISE EXCEPTION 'Release waits for an approved case with the grant of probate' USING ERRCODE = '22023';
  END IF;

  FOR v_nom IN
    SELECT n.* FROM public.vault_nominations n
    WHERE n.owner_user_id = p_owner_user_id AND n.status = 'active'
    ORDER BY n.created_at
    FOR UPDATE
  LOOP
    SELECT c.linked_user_id INTO v_linked FROM public.contacts c WHERE c.id = v_nom.person_id AND c.owner_user_id = p_owner_user_id;
    IF v_linked IS NULL OR v_linked = p_owner_user_id THEN v_not_joined := v_not_joined + 1; CONTINUE; END IF;
    IF public.lf_identity_assurance_level(v_linked) < 2 THEN v_waiting := v_waiting + 1; CONTINUE; END IF;

    IF v_nom.scope = 'whole_vault' THEN
      SELECT COALESCE(jsonb_agg(a.id::text ORDER BY a.id), '[]'::jsonb) INTO v_assets FROM public.assets a
        WHERE a.owner_user_id = p_owner_user_id AND a.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.vault_nomination_records x
                          WHERE x.nomination_id = v_nom.id AND x.mode = 'exclude' AND x.record_type = 'asset' AND x.record_id = a.id);
      SELECT COALESCE(jsonb_agg(r.id::text ORDER BY r.id), '[]'::jsonb) INTO v_records FROM public.records r
        WHERE r.owner_user_id = p_owner_user_id AND r.archived_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.vault_nomination_records x
                          WHERE x.nomination_id = v_nom.id AND x.mode = 'exclude' AND x.record_type = 'record' AND x.record_id = r.id);
    ELSE
      SELECT COALESCE(jsonb_agg(a.id::text ORDER BY a.id), '[]'::jsonb) INTO v_assets FROM public.assets a
        JOIN public.vault_nomination_records x ON x.record_id = a.id AND x.record_type = 'asset' AND x.mode = 'include' AND x.nomination_id = v_nom.id
        WHERE a.owner_user_id = p_owner_user_id AND a.deleted_at IS NULL;
      SELECT COALESCE(jsonb_agg(r.id::text ORDER BY r.id), '[]'::jsonb) INTO v_records FROM public.records r
        JOIN public.vault_nomination_records x ON x.record_id = r.id AND x.record_type = 'record' AND x.mode = 'include' AND x.nomination_id = v_nom.id
        WHERE r.owner_user_id = p_owner_user_id AND r.archived_at IS NULL;
    END IF;

    v_override := jsonb_build_object('scope', 'estate_release', 'nomination_id', v_nom.id, 'probate_case_id', p_probate_case_id,
      'read_only', true, 'no_billing', true, 'no_owner_settings', true, 'released_at', v_now,
      'asset_ids', v_assets, 'record_ids', v_records);

    -- One grant per person: reuse their existing grant for this contact if there is one.
    SELECT * INTO v_grant FROM public.account_access_grants g
      WHERE g.owner_user_id = p_owner_user_id AND g.linked_user_id = v_linked
        AND (g.contact_id = v_nom.person_id OR g.assigned_role = 'friend_or_family')
      ORDER BY (g.contact_id = v_nom.person_id) DESC NULLS LAST LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.account_access_grants SET
        source = 'estate_release', source_id = v_nom.id, activation_status = 'active', required_identity_level = 2,
        vault_lifecycle_state = v_state, paused_at = NULL, ends_at = NULL, updated_at = v_now,
        permissions_override = v_override || jsonb_build_object('previous_grant', jsonb_build_object('override', v_grant.permissions_override, 'status', v_grant.activation_status))
      WHERE id = v_grant.id;
    ELSE
      INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, contact_id, assigned_role, relationship,
        activation_status, required_identity_level, permissions_override, source, source_id, vault_lifecycle_state, updated_at)
      VALUES (p_owner_user_id, v_linked, v_nom.person_id, 'friend_or_family', NULL, 'active', 2, v_override, 'estate_release', v_nom.id, v_state, v_now);
    END IF;

    UPDATE public.vault_nominations SET status = 'released' WHERE id = v_nom.id;
    v_released := v_released + 1;
  END LOOP;

  RETURN QUERY SELECT v_released, v_waiting, v_not_joined;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_release_vault_nominations(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lf_release_vault_nominations(uuid, uuid, uuid) TO service_role;

-- 3. Nomination counts for the review team (no names of records).
CREATE FUNCTION public.lf_release_readiness(p_owner_user_id uuid)
RETURNS TABLE (active_nominations integer, released_nominations integer, id_verified integer, not_joined integer)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    count(*) FILTER (WHERE n.status = 'active')::integer,
    count(*) FILTER (WHERE n.status = 'released')::integer,
    count(*) FILTER (WHERE n.status = 'active' AND c.linked_user_id IS NOT NULL AND public.lf_identity_assurance_level(c.linked_user_id) >= 2)::integer,
    count(*) FILTER (WHERE n.status = 'active' AND c.linked_user_id IS NULL)::integer
  FROM public.vault_nominations n
  JOIN public.contacts c ON c.id = n.person_id AND c.owner_user_id = n.owner_user_id
  WHERE n.owner_user_id = p_owner_user_id AND auth.uid() IS NULL;
$$;
REVOKE ALL ON FUNCTION public.lf_release_readiness(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lf_release_readiness(uuid) TO service_role;
