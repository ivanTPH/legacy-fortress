-- Vault access: Record history for every access change, and end dates for sharing now.
-- Signed-off design: VAULT_ACCESS.md rules 8 and 11, va-s1–s5, va-v2–v6.
--   * Sharing now can have an end date; access stops automatically at that time.
--   * Stopping, cancelling and withdrawing are immediate and written to Record history.
--   * History carries who, when, what kind and how many records: never record names or values.
-- The only change to the shared identity gate is a narrowing: an ended or paused grant opens nothing.

-- 1. End dates and pauses close access. Same function, two extra conditions.
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
    AND public.lf_vault_lifecycle_state(p_grant.owner_user_id) = 'OWNER_ACTIVE'
    AND p_grant.paused_at IS NULL
    AND (p_grant.ends_at IS NULL OR p_grant.ends_at > timezone('utc', now()));
$$;

-- An end date must be in the future when it is set.
CREATE FUNCTION lf_vault_access_private.validate_grant_end()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.ends_at END)
     AND NEW.ends_at <= timezone('utc', now()) THEN
    RAISE EXCEPTION 'Choose an end date from tomorrow onwards' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_access_grants_validate_end
  BEFORE INSERT OR UPDATE OF ends_at ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.validate_grant_end();

-- 2. Every access change is written to history (counts only).
CREATE FUNCTION lf_vault_access_private.grant_record_count(p_override jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p_override -> 'asset_ids') = 'array' THEN p_override -> 'asset_ids' END), 0)
       + COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(p_override -> 'record_ids') = 'array' THEN p_override -> 'record_ids' END), 0);
$$;

CREATE FUNCTION lf_vault_access_private.audit_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_new integer := lf_vault_access_private.grant_record_count(NEW.permissions_override);
  v_old integer := CASE WHEN TG_OP = 'UPDATE' THEN lf_vault_access_private.grant_record_count(OLD.permissions_override) ELSE 0 END;
  v_open_new boolean := NEW.activation_status IN ('verified', 'active', 'accepted') AND NEW.paused_at IS NULL;
  v_open_old boolean := TG_OP = 'UPDATE' AND OLD.activation_status IN ('verified', 'active', 'accepted') AND OLD.paused_at IS NULL;
  v_action text;
  v_note text := NULLIF(btrim(COALESCE(current_setting('lf.vault_access_note', true), '')), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_new = 0 THEN RETURN NULL; END IF;
    v_action := 'access.given';
  ELSIF (v_old > 0 AND v_open_old) AND (v_new = 0 OR NOT v_open_new) THEN
    v_action := 'access.stopped';
  ELSIF (v_old = 0 OR NOT v_open_old) AND v_new > 0 AND v_open_new THEN
    v_action := 'access.given';
  ELSIF v_new > 0 AND (OLD.permissions_override -> 'asset_ids', OLD.permissions_override -> 'record_ids')
        IS DISTINCT FROM (NEW.permissions_override -> 'asset_ids', NEW.permissions_override -> 'record_ids') THEN
    v_action := 'access.changed';
  ELSIF NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    v_action := 'access.end_date_changed';
  ELSE
    RETURN NULL;
  END IF;
  INSERT INTO public.audit_events (category, action, result, actor_user_id, resource_type, resource_id, route, policy_decision, metadata)
  VALUES ('vault_access', v_action, 'success', COALESCE(auth.uid(), NEW.owner_user_id), 'access_grant', NEW.id::text, 'access_grant', 'allowed',
    jsonb_strip_nulls(jsonb_build_object(
      'owner_user_id', NEW.owner_user_id, 'contact_id', NEW.contact_id, 'source', NEW.source,
      'record_count', CASE WHEN v_action = 'access.stopped' THEN v_old ELSE v_new END,
      'ends_at', NEW.ends_at, 'by_review_team', auth.uid() IS NULL,
      'note', left(v_note, 300))));
  RETURN NULL;
END;
$$;
CREATE TRIGGER account_access_grants_audit
  AFTER INSERT OR UPDATE ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_grant();

-- 3. Stop access now, with an optional note for Record history. Owner-made sharing only;
--    authority access is stopped by withdrawing the authority.
CREATE FUNCTION public.lf_stop_vault_access(p_grant_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to stop access.' USING ERRCODE = '28000'; END IF;
  PERFORM set_config('lf.vault_access_note', left(COALESCE(p_note, ''), 300), true);
  UPDATE public.account_access_grants
    SET permissions_override = COALESCE(permissions_override, '{}'::jsonb)
          || jsonb_build_object('asset_ids', '[]'::jsonb, 'record_ids', '[]'::jsonb, 'section_entry_ids', '[]'::jsonb,
                                'allowed_sections', '[]'::jsonb, 'editable_asset_ids', '[]'::jsonb, 'editable_record_ids', '[]'::jsonb),
        ends_at = NULL,
        updated_at = timezone('utc', now())
    WHERE id = p_grant_id AND owner_user_id = auth.uid() AND source = 'owner_grant';
  IF NOT FOUND THEN RAISE EXCEPTION 'That access couldn''t be found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM set_config('lf.vault_access_note', '', true);
END;
$$;
REVOKE ALL ON FUNCTION public.lf_stop_vault_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_stop_vault_access(uuid, text) TO authenticated;

-- 4. The owner's Record history for one person. Owner only; counts and kinds, never names.
CREATE FUNCTION public.my_vault_access_history(p_person_id uuid)
RETURNS TABLE (at timestamptz, action text, by_owner boolean, record_count integer, note text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  person AS (
    SELECT c.id, c.linked_user_id FROM public.contacts c, me
    WHERE c.id = p_person_id AND c.owner_user_id = me.uid
  ),
  ids AS (
    SELECT n.id::text AS id FROM public.vault_nominations n, person, me WHERE n.person_id = person.id AND n.owner_user_id = me.uid
    UNION SELECT a.id::text FROM public.legal_authorities a, person, me WHERE a.person_id = person.id AND a.owner_user_id = me.uid
    UNION SELECT g.id::text FROM public.account_access_grants g, person, me
      WHERE g.owner_user_id = me.uid AND (g.contact_id = person.id
        OR (g.source = 'legal_authority' AND g.source_id IN (SELECT a.id FROM public.legal_authorities a WHERE a.person_id = person.id AND a.owner_user_id = me.uid)))
  )
  SELECT e.created_at, e.action,
         NOT (e.action IN ('authority.confirmed', 'authority.needs_attention', 'authority.rejected', 'authority.ended', 'authority.activated', 'authority.checked', 'nomination.released')
              OR COALESCE((e.metadata ->> 'by_review_team')::boolean, false)),
         NULLIF(e.metadata ->> 'record_count', '')::integer,
         e.metadata ->> 'note'
  FROM public.audit_events e
  WHERE e.category = 'vault_access' AND e.resource_id IN (SELECT id FROM ids)
    AND EXISTS (SELECT 1 FROM person)
  ORDER BY e.created_at DESC
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.my_vault_access_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vault_access_history(uuid) TO authenticated;
