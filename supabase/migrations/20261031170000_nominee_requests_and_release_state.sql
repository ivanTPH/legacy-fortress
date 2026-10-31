-- What a nominee can do before release (signed-off design va-r4, va-r6, va-r7, va-v7; rule 12;
-- owner decisions 30 Oct: any nominee or executor may report a death).
--   * A nominee can ask the owner for access now. It becomes a Needs you item in the owner's
--     To do. Asking never shares anything: only the owner's Give access does.
--   * A nominee sees whether a release is in progress, never what the nomination covers.

-- 1. Early-access requests.
CREATE TABLE public.vault_early_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nomination_id uuid NOT NULL REFERENCES public.vault_nominations(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text CHECK (message IS NULL OR length(message) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'declined', 'shared', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  decided_at timestamptz
);
CREATE UNIQUE INDEX vault_early_access_one_open ON public.vault_early_access_requests (nomination_id) WHERE status = 'open';
CREATE INDEX vault_early_access_owner_idx ON public.vault_early_access_requests (owner_user_id, status, created_at DESC);
ALTER TABLE public.vault_early_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_early_access_requests FROM anon;
REVOKE INSERT, DELETE ON public.vault_early_access_requests FROM authenticated;
CREATE POLICY vault_early_access_owner_select ON public.vault_early_access_requests
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY vault_early_access_owner_update ON public.vault_early_access_requests
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY vault_early_access_requester_select ON public.vault_early_access_requests
  FOR SELECT TO authenticated USING (requester_user_id = auth.uid());

-- 2. The nominee's status view gains an opaque reference (to ask or report) and the release stage.
DROP FUNCTION IF EXISTS public.my_vault_nomination_status();
CREATE FUNCTION public.my_vault_nomination_status()
RETURNS TABLE (nomination_ref uuid, owner_display_name text, kind text, status text, release_stage text, open_request boolean)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT n.id,
         COALESCE(NULLIF(btrim(p.display_name), ''), 'Your contact'),
         n.kind,
         n.status,
         CASE
           WHEN n.status = 'released' THEN 'released'
           WHEN COALESCE((SELECT w.vault_lifecycle_state FROM public.wallets w
                          WHERE w.owner_user_id = n.owner_user_id AND w.status = 'active'
                          ORDER BY w.updated_at DESC LIMIT 1), 'OWNER_ACTIVE') = 'OWNER_ACTIVE' THEN 'none'
           ELSE 'in_progress'
         END,
         EXISTS (SELECT 1 FROM public.vault_early_access_requests r
                 WHERE r.nomination_id = n.id AND r.requester_user_id = auth.uid() AND r.status = 'open')
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

-- Owners can only answer: open → declined or shared. Nothing else changes.
CREATE FUNCTION lf_vault_access_private.validate_early_access()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.id, NEW.owner_user_id, NEW.nomination_id, NEW.person_id, NEW.requester_user_id, NEW.message, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.owner_user_id, OLD.nomination_id, OLD.person_id, OLD.requester_user_id, OLD.message, OLD.created_at) THEN
    RAISE EXCEPTION 'Only the answer to a request can change';
  END IF;
  IF OLD.status <> 'open' OR NEW.status NOT IN ('declined', 'shared', 'cancelled') THEN
    RAISE EXCEPTION 'This request has already been answered';
  END IF;
  NEW.decided_at := timezone('utc', now());
  RETURN NEW;
END;
$$;
CREATE TRIGGER vault_early_access_validate
  BEFORE UPDATE ON public.vault_early_access_requests
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.validate_early_access();

-- History: requested / declined / shared, filed under the nomination (counts and kinds only).
CREATE FUNCTION lf_vault_access_private.audit_early_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_events (category, action, result, actor_user_id, resource_type, resource_id, route, policy_decision, metadata)
  VALUES ('vault_access',
    CASE WHEN TG_OP = 'INSERT' THEN 'early_access.requested' ELSE 'early_access.' || NEW.status END,
    'success', COALESCE(auth.uid(), NEW.owner_user_id), 'vault_nomination', NEW.nomination_id::text, 'vault_early_access', 'allowed',
    jsonb_build_object('owner_user_id', NEW.owner_user_id, 'by_person', TG_OP = 'INSERT'));
  RETURN NULL;
END;
$$;
CREATE TRIGGER vault_early_access_audit
  AFTER INSERT OR UPDATE OF status ON public.vault_early_access_requests
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.audit_early_access();

-- The nominee asks through this function only. One open request per nomination.
CREATE FUNCTION public.lf_request_early_access(p_nomination_ref uuid, p_message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_nom public.vault_nominations%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to ask for access.' USING ERRCODE = '28000'; END IF;
  SELECT n.* INTO v_nom FROM public.vault_nominations n
    JOIN public.contacts c ON c.id = n.person_id AND c.owner_user_id = n.owner_user_id
    WHERE n.id = p_nomination_ref AND n.status = 'active' AND n.notify_person
      AND c.linked_user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.contact_invitations i
                  WHERE i.contact_id = c.id AND i.owner_user_id = n.owner_user_id
                    AND i.accepted_user_id = auth.uid() AND i.invitation_status IN ('accepted', 'verified', 'active'));
  IF NOT FOUND THEN RAISE EXCEPTION 'You can''t ask for access to this Vault.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.vault_early_access_requests WHERE nomination_id = v_nom.id AND status = 'open') THEN
    RAISE EXCEPTION 'You''ve already asked. The owner hasn''t answered yet.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.vault_early_access_requests (owner_user_id, nomination_id, person_id, requester_user_id, message)
    VALUES (v_nom.owner_user_id, v_nom.id, v_nom.person_id, auth.uid(), NULLIF(left(btrim(COALESCE(p_message, '')), 500), ''))
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_request_early_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_request_early_access(uuid, text) TO authenticated;

-- 3. Owner history picks up early-access events (already filed under the nomination id).
--    Mark them as the person's action, not the owner's.
CREATE OR REPLACE FUNCTION public.my_vault_access_history(p_person_id uuid)
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
         NOT (e.action IN ('authority.confirmed', 'authority.needs_attention', 'authority.rejected', 'authority.ended', 'authority.activated', 'authority.checked', 'nomination.released', 'early_access.requested')
              OR COALESCE((e.metadata ->> 'by_review_team')::boolean, false)),
         NULLIF(e.metadata ->> 'record_count', '')::integer,
         e.metadata ->> 'note'
  FROM public.audit_events e
  WHERE e.category = 'vault_access' AND e.resource_id IN (SELECT id FROM ids)
    AND EXISTS (SELECT 1 FROM person)
  ORDER BY e.created_at DESC
  LIMIT 100;
$$;

-- 4. Answered by sharing: when the owner gives this person access to records (Give access),
--    an open request from them is marked shared. Nothing is shared by the request itself.
CREATE FUNCTION lf_vault_access_private.close_request_on_share()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_before integer := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN v_before := lf_vault_access_private.grant_record_count(OLD.permissions_override); END IF;
  IF NEW.contact_id IS NOT NULL AND NEW.source = 'owner_grant'
     AND lf_vault_access_private.grant_record_count(NEW.permissions_override) > v_before THEN
    UPDATE public.vault_early_access_requests SET status = 'shared'
      WHERE owner_user_id = NEW.owner_user_id AND person_id = NEW.contact_id AND status = 'open';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER account_access_grants_close_early_access
  AFTER INSERT OR UPDATE OF permissions_override ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.close_request_on_share();
