-- Linked People: create a new person and their record link in ONE transaction, with
-- idempotent retries. SECURITY INVOKER, so contacts/record_links RLS and the existing
-- validation and audit triggers all still apply. No invitation or access grant is created.

CREATE TABLE IF NOT EXISTS public.record_link_requests (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.record_links(id) ON DELETE CASCADE,
  created_person boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (owner_user_id, request_id)
);
ALTER TABLE public.record_link_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_link_requests_owner_select ON public.record_link_requests
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY record_link_requests_owner_insert ON public.record_link_requests
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
GRANT SELECT, INSERT ON public.record_link_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.lf_save_record_linked_person(
  p_request_id uuid,
  p_record_type text,
  p_record_id uuid,
  p_person_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_relationship text,
  p_role text,
  p_role_other_text text
) RETURNS TABLE (person_id uuid, link_id uuid, created_person boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_person uuid := p_person_id;
  v_link uuid;
  v_created boolean := false;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_role text := btrim(coalesce(p_role, ''));
  v_other text := nullif(btrim(coalesce(p_role_other_text, '')), '');
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Sign in to save people.' USING ERRCODE = '28000'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'A request id is required.' USING ERRCODE = '22023'; END IF;

  -- Idempotent retry: return what the first attempt saved.
  RETURN QUERY SELECT r.person_id, r.link_id, r.created_person FROM public.record_link_requests r
    WHERE r.owner_user_id = v_owner AND r.request_id = p_request_id;
  IF FOUND THEN RETURN; END IF;

  IF p_record_type NOT IN ('asset', 'record') THEN RAISE EXCEPTION 'Unknown record type.' USING ERRCODE = '22023'; END IF;
  IF length(v_role) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Choose a role for this record.' USING ERRCODE = '22023'; END IF;
  IF lower(v_role) = 'other' AND (v_other IS NULL OR length(v_other) > 60) THEN
    RAISE EXCEPTION 'Enter a role of up to 60 characters.' USING ERRCODE = '22023';
  END IF;

  IF v_person IS NULL THEN
    IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Enter a name of up to 120 characters.' USING ERRCODE = '22023';
    END IF;
    IF v_email IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.contacts c WHERE c.owner_user_id = v_owner AND c.email_normalized = v_email
    ) THEN
      RAISE EXCEPTION 'This email is already in People. Choose the existing person instead.' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.contacts (owner_user_id, full_name, email, email_normalized, phone, relationship, source_type)
    VALUES (v_owner, btrim(p_name), nullif(btrim(coalesce(p_email, '')), ''), v_email,
            nullif(btrim(coalesce(p_phone, '')), ''), nullif(btrim(coalesce(p_relationship, '')), ''), 'manual')
    RETURNING id INTO v_person;
    v_created := true;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = v_person AND c.owner_user_id = v_owner) THEN
    RAISE EXCEPTION 'Choose a person from your own People list.' USING ERRCODE = '42501';
  END IF;

  SELECT l.id INTO v_link FROM public.record_links l
    WHERE l.owner_user_id = v_owner AND l.record_type = p_record_type AND l.record_id = p_record_id
      AND l.person_id = v_person AND l.removed_at IS NULL;
  IF v_link IS NULL THEN
    INSERT INTO public.record_links (owner_user_id, record_type, record_id, person_id, role, role_other_text, source, manual_origin, created_by)
    VALUES (v_owner, p_record_type, p_record_id, v_person, v_role, CASE WHEN lower(v_role) = 'other' THEN v_other END,
            'manual', CASE WHEN v_created THEN 'new' ELSE 'people' END, v_owner)
    RETURNING id INTO v_link;
  END IF;

  INSERT INTO public.record_link_requests (owner_user_id, request_id, person_id, link_id, created_person)
  VALUES (v_owner, p_request_id, v_person, v_link, v_created);
  RETURN QUERY SELECT v_person, v_link, v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.lf_save_record_linked_person(uuid,text,uuid,uuid,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lf_save_record_linked_person(uuid,text,uuid,uuid,text,text,text,text,text,text) TO authenticated;
