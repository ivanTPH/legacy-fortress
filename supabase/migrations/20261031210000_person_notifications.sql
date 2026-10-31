-- Content-free notifications for Vault access (VAULT_ACCESS.md rules 5 and 8: the person is told,
-- without details). Each notification says who and what happened, never record names, values,
-- counts or scope. Written only by the database when the underlying change happens.

CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'nomination_added', 'nomination_ended', 'release_approved',
    'access_given', 'access_stopped',
    'authority_in_effect', 'authority_ended',
    'authority_confirmed', 'authority_needs_attention', 'authority_rejected',
    'early_access_requested', 'early_access_answered',
    'identity_approved', 'identity_rejected')),
  owner_display_name text CHECK (owner_display_name IS NULL OR length(owner_display_name) <= 120),
  link text NOT NULL DEFAULT '/notifications' CHECK (link ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  read_at timestamptz
);
CREATE INDEX user_notifications_recipient_idx ON public.user_notifications (recipient_user_id, created_at DESC);
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_notifications FROM anon;
REVOKE INSERT, DELETE ON public.user_notifications FROM authenticated;
CREATE POLICY user_notifications_recipient_select ON public.user_notifications
  FOR SELECT TO authenticated USING (recipient_user_id = auth.uid());
CREATE POLICY user_notifications_recipient_update ON public.user_notifications
  FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());

-- Recipients can only mark as read.
CREATE FUNCTION lf_vault_access_private.guard_notification_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.id, NEW.recipient_user_id, NEW.kind, NEW.owner_display_name, NEW.link, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.recipient_user_id, OLD.kind, OLD.owner_display_name, OLD.link, OLD.created_at) THEN
    RAISE EXCEPTION 'Only read state can change';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_notifications_guard
  BEFORE UPDATE ON public.user_notifications
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.guard_notification_update();

CREATE FUNCTION lf_vault_access_private.notify(p_recipient uuid, p_kind text, p_owner uuid, p_link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.user_notifications (recipient_user_id, kind, owner_display_name, link)
  SELECT p_recipient, p_kind,
         CASE WHEN p_owner IS NULL THEN NULL ELSE left(COALESCE(NULLIF(btrim((SELECT p.display_name FROM public.user_profiles p WHERE p.user_id = p_owner)), ''), 'Your contact'), 120) END,
         p_link
  WHERE p_recipient IS NOT NULL AND (p_owner IS NULL OR p_recipient <> p_owner);
$$;

-- Nominations: told only when the owner chose to tell them; release is always told.
CREATE FUNCTION lf_vault_access_private.notify_nomination()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_person uuid;
BEGIN
  SELECT c.linked_user_id INTO v_person FROM public.contacts c WHERE c.id = NEW.person_id AND c.owner_user_id = NEW.owner_user_id;
  IF v_person IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.notify_person THEN PERFORM lf_vault_access_private.notify(v_person, 'nomination_added', NEW.owner_user_id, '/vault-nominations'); END IF;
  ELSIF NEW.status = 'released' AND OLD.status <> 'released' THEN
    PERFORM lf_vault_access_private.notify(v_person, 'release_approved', NEW.owner_user_id, '/vault-nominations');
  ELSIF NEW.status IN ('cancelled', 'ended') AND OLD.status = 'active' AND OLD.notify_person THEN
    PERFORM lf_vault_access_private.notify(v_person, 'nomination_ended', NEW.owner_user_id, '/notifications');
  ELSIF NEW.status = 'active' AND NEW.notify_person AND NOT OLD.notify_person THEN
    PERFORM lf_vault_access_private.notify(v_person, 'nomination_added', NEW.owner_user_id, '/vault-nominations');
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER vault_nominations_notify AFTER INSERT OR UPDATE ON public.vault_nominations
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.notify_nomination();

-- Powers of Attorney: the attorney hears when it takes effect or ends; the owner hears the review result.
CREATE FUNCTION lf_vault_access_private.notify_authority()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_person uuid;
BEGIN
  SELECT c.linked_user_id INTO v_person FROM public.contacts c WHERE c.id = NEW.person_id AND c.owner_user_id = NEW.owner_user_id;
  IF NEW.activated_at IS NOT NULL AND OLD.activated_at IS NULL THEN
    PERFORM lf_vault_access_private.notify(v_person, 'authority_in_effect', NEW.owner_user_id, '/dashboard');
    PERFORM lf_vault_access_private.notify(NEW.owner_user_id, 'authority_in_effect', NULL, '/people-access?view=vault-access');
  ELSIF NEW.status <> OLD.status THEN
    IF NEW.status IN ('withdrawn', 'ended', 'rejected') AND OLD.activated_at IS NOT NULL THEN
      PERFORM lf_vault_access_private.notify(v_person, 'authority_ended', NEW.owner_user_id, '/notifications');
    END IF;
    IF NEW.status = 'confirmed' THEN PERFORM lf_vault_access_private.notify(NEW.owner_user_id, 'authority_confirmed', NULL, '/people-access?view=vault-access'); END IF;
    IF NEW.status = 'needs_attention' THEN PERFORM lf_vault_access_private.notify(NEW.owner_user_id, 'authority_needs_attention', NULL, '/people-access?view=vault-access'); END IF;
    IF NEW.status = 'rejected' THEN PERFORM lf_vault_access_private.notify(NEW.owner_user_id, 'authority_rejected', NULL, '/people-access?view=vault-access'); END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER legal_authorities_notify AFTER UPDATE ON public.legal_authorities
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.notify_authority();

-- Sharing now: told when records are first shared and when sharing stops (owner-made only).
CREATE FUNCTION lf_vault_access_private.notify_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_new integer := lf_vault_access_private.grant_record_count(NEW.permissions_override);
  v_old integer := 0;
BEGIN
  IF NEW.source <> 'owner_grant' THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' THEN v_old := lf_vault_access_private.grant_record_count(OLD.permissions_override); END IF;
  IF v_old = 0 AND v_new > 0 THEN
    PERFORM lf_vault_access_private.notify(NEW.linked_user_id, 'access_given', NEW.owner_user_id, '/dashboard');
  ELSIF v_old > 0 AND v_new = 0 THEN
    PERFORM lf_vault_access_private.notify(NEW.linked_user_id, 'access_stopped', NEW.owner_user_id, '/notifications');
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER account_access_grants_notify AFTER INSERT OR UPDATE OF permissions_override ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.notify_grant();

-- Early access: the owner is told of a request; the person is told it was answered (not how).
CREATE FUNCTION lf_vault_access_private.notify_early_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM lf_vault_access_private.notify(NEW.owner_user_id, 'early_access_requested', NULL, '/people-access?view=vault-access&request=' || NEW.id::text);
  ELSIF NEW.status IN ('declined', 'shared') AND OLD.status = 'open' THEN
    PERFORM lf_vault_access_private.notify(NEW.requester_user_id, 'early_access_answered', NEW.owner_user_id, '/vault-nominations');
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER vault_early_access_notify AFTER INSERT OR UPDATE OF status ON public.vault_early_access_requests
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.notify_early_access();

-- ID checks decided by a reviewer.
CREATE FUNCTION lf_vault_access_private.notify_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.provider_key = 'lf_inhouse_review_v1' AND OLD.status = 'review_required' AND NEW.status IN ('verified', 'failed') THEN
    PERFORM lf_vault_access_private.notify(NEW.user_id, CASE WHEN NEW.status = 'verified' THEN 'identity_approved' ELSE 'identity_rejected' END, NULL, '/identity/verify');
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER identity_verification_requests_notify AFTER UPDATE OF status ON public.identity_verification_requests
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.notify_identity();
