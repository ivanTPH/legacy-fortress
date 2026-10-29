-- Owner-scoped read projection of append-only link events. The audit table
-- remains private; role edits and soft removals still use the PR 1 trigger.
CREATE FUNCTION public.lf_record_link_history(p_record_type text, p_record_id uuid)
RETURNS TABLE (id uuid, link_id uuid, person_id uuid, action text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT event.id, link.id, link.person_id, event.action, event.created_at
  FROM public.record_links AS link
  JOIN public.audit_events AS event
    ON event.category = 'linked_people'
   AND event.action IN ('link.created', 'link.role_changed', 'link.removed')
   AND event.result = 'success'
   AND event.resource_type = link.record_type
   AND event.resource_id = link.record_id::text
   AND event.metadata ->> 'link_id' = link.id::text
  WHERE link.record_type = p_record_type
    AND link.record_id = p_record_id
    AND link.owner_user_id = (SELECT auth.uid())
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.lf_record_link_history(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_record_link_history(text, uuid) TO authenticated;

-- Forward recovery: replace this projection; never delete audit rows.
