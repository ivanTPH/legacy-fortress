-- A recipient event and its audit row commit with the owner's grant update.
-- Existing invitation_events RLS already restricts reads to owner_user_id.
CREATE FUNCTION public.lf_emit_recipient_access_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_old_scope jsonb := '{}'::jsonb;
  v_new_scope jsonb := '{}'::jsonb;
  v_old_items jsonb;
  v_new_items jsonb;
  v_invitation_id uuid;
  v_event_id uuid;
  v_event_type text;
BEGIN
  -- Only an authenticated owner saving their own grant can emit this event.
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.owner_user_id
     OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
     OR OLD.linked_user_id IS DISTINCT FROM NEW.linked_user_id
     OR NEW.activation_status NOT IN ('accepted', 'verified', 'active') THEN
    RETURN NEW;
  END IF;

  -- Canonicalise sets so a retry with reordered but identical selections is silent.
  FOREACH v_key IN ARRAY ARRAY['asset_ids', 'record_ids', 'editable_asset_ids',
                               'editable_record_ids', 'allowed_sections', 'explicit_permissions'] LOOP
    SELECT COALESCE(pg_catalog.jsonb_agg(item ORDER BY item), '[]'::jsonb)
      INTO v_old_items
      FROM (SELECT DISTINCT item FROM pg_catalog.jsonb_array_elements_text(
        COALESCE(OLD.permissions_override -> v_key, '[]'::jsonb)) AS entries(item)) AS unique_items;
    SELECT COALESCE(pg_catalog.jsonb_agg(item ORDER BY item), '[]'::jsonb)
      INTO v_new_items
      FROM (SELECT DISTINCT item FROM pg_catalog.jsonb_array_elements_text(
        COALESCE(NEW.permissions_override -> v_key, '[]'::jsonb)) AS entries(item)) AS unique_items;
    v_old_scope := pg_catalog.jsonb_set(v_old_scope, ARRAY[v_key], v_old_items);
    v_new_scope := pg_catalog.jsonb_set(v_new_scope, ARRAY[v_key], v_new_items);
  END LOOP;
  v_old_scope := pg_catalog.jsonb_set(v_old_scope, ARRAY['read_only'],
    COALESCE(OLD.permissions_override -> 'read_only', 'true'::jsonb));
  v_new_scope := pg_catalog.jsonb_set(v_new_scope, ARRAY['read_only'],
    COALESCE(NEW.permissions_override -> 'read_only', 'true'::jsonb));
  IF v_old_scope = v_new_scope THEN
    RETURN NEW;
  END IF;

  -- The recipient must have accepted this owner's invitation with this account.
  SELECT ci.id INTO v_invitation_id
  FROM public.contact_invitations AS ci
  WHERE ci.owner_user_id = NEW.owner_user_id
    AND ci.accepted_user_id = NEW.linked_user_id
    AND ci.invitation_status = 'accepted'
    AND ci.revoked_at IS NULL
    AND (NEW.invitation_id IS NULL OR ci.id = NEW.invitation_id)
    AND (NEW.invitation_id IS NOT NULL OR ci.assigned_role = NEW.assigned_role)
  ORDER BY ci.accepted_at DESC NULLS LAST, ci.created_at DESC
  LIMIT 1;
  IF v_invitation_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_event_type := CASE WHEN
    v_new_scope -> 'asset_ids' = '[]'::jsonb
    AND v_new_scope -> 'record_ids' = '[]'::jsonb
    AND v_new_scope -> 'editable_asset_ids' = '[]'::jsonb
    AND v_new_scope -> 'editable_record_ids' = '[]'::jsonb
    THEN 'recipient_record_access_revoked'
    ELSE 'recipient_record_access_updated' END;

  INSERT INTO public.invitation_events (owner_user_id, invitation_id, event_type, payload)
  VALUES (NEW.linked_user_id, v_invitation_id, v_event_type,
    pg_catalog.jsonb_build_object('source', 'grant_commit', 'grant_id', NEW.id,
      'in_app_status', 'available', 'email_status', 'not_configured'))
  RETURNING id INTO v_event_id;

  INSERT INTO public.audit_events
    (category, action, result, actor_user_id, resource_type, resource_id, route, metadata)
  VALUES ('access', 'recipient_notification_created', 'success', NEW.owner_user_id,
    'account_access_grant', NEW.id::text, 'database:account_access_grants',
    pg_catalog.jsonb_build_object('notification_id', v_event_id,
      'recipient_user_id', NEW.linked_user_id, 'in_app_status', 'available',
      'email_status', 'not_configured'));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lf_emit_recipient_access_notification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER lf_recipient_access_notification
  AFTER UPDATE OF permissions_override ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.lf_emit_recipient_access_notification();
