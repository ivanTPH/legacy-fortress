-- Owner decision 2 Nov 2026 ("Ask each time, no detail"): when the owner links someone who has
-- already joined to another record, they can tick "Tell <name>". The person gets a content-free
-- notification: no record name, type, role, value or count. Linking never gives access.

ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN (
  'nomination_added', 'nomination_ended', 'release_approved',
  'access_given', 'access_stopped',
  'authority_in_effect', 'authority_ended',
  'authority_confirmed', 'authority_needs_attention', 'authority_rejected',
  'early_access_requested', 'early_access_answered',
  'identity_approved', 'identity_rejected',
  'record_link_added'));

-- Called by the owner for one of their own current links. Returns true when the person was told.
CREATE FUNCTION public.lf_tell_linked_person(p_link_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_recipient uuid;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT c.linked_user_id INTO v_recipient
  FROM public.record_links l
  JOIN public.contacts c ON c.id = l.person_id AND c.owner_user_id = l.owner_user_id
  WHERE l.id = p_link_id AND l.owner_user_id = v_owner AND l.removed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF v_recipient IS NULL OR v_recipient = v_owner THEN RETURN false; END IF;
  -- One message per person per minute, so repeated taps don't spam them.
  IF EXISTS (
    SELECT 1 FROM public.user_notifications n
    WHERE n.recipient_user_id = v_recipient AND n.kind = 'record_link_added'
      AND n.created_at > timezone('utc', now()) - interval '1 minute'
  ) THEN RETURN true; END IF;
  PERFORM lf_vault_access_private.notify(v_recipient, 'record_link_added', v_owner, '/notifications');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.lf_tell_linked_person(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_tell_linked_person(uuid) TO authenticated;
