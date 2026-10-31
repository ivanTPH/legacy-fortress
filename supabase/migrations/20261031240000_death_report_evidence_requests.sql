-- Release reviewer can ask the reporter for more evidence before anything unlocks
-- (owner decision 31 Oct 2026). The reporter is told, without details, and sent back to their report.
ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN (
  'nomination_added', 'nomination_ended', 'release_approved',
  'access_given', 'access_stopped',
  'authority_in_effect', 'authority_ended',
  'authority_confirmed', 'authority_needs_attention', 'authority_rejected',
  'early_access_requested', 'early_access_answered',
  'identity_approved', 'identity_rejected',
  'more_evidence_requested', 'attorney_check_requested'));

CREATE FUNCTION lf_vault_access_private.notify_death_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'evidence_required' AND OLD.status IS DISTINCT FROM 'evidence_required' THEN
    PERFORM lf_vault_access_private.notify(NEW.claimant_user_id, 'more_evidence_requested', NEW.owner_user_id, '/estate/report-death?report=' || NEW.id::text);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER death_reports_notify AFTER UPDATE OF status ON public.death_reports
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.notify_death_report();

-- An attorney is asked for a fresh ID check once the review team confirms the authority.
CREATE FUNCTION lf_vault_access_private.notify_attorney_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_person uuid;
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' AND NEW.activated_at IS NULL THEN
    SELECT c.linked_user_id INTO v_person FROM public.contacts c WHERE c.id = NEW.person_id AND c.owner_user_id = NEW.owner_user_id;
    PERFORM lf_vault_access_private.notify(v_person, 'attorney_check_requested', NEW.owner_user_id, '/identity/verify?authority=' || NEW.id::text);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER legal_authorities_notify_attorney_check AFTER UPDATE OF status ON public.legal_authorities
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.notify_attorney_check();
