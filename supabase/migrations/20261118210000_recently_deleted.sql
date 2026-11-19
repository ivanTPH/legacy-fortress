-- Recently deleted (UX review 2; owner approved 30 days, 18 Nov 2026).
--
-- Records (insurance, pensions, debts and other rows in public.records) were deleted outright. They now move to
-- a 30-day bin owned by the Vault owner, from which the owner can restore them with the same id, so anything
-- that referred to the record (an explicit saved access selection, for example) applies again exactly as before.
-- Nothing here grants access: the bin is owner-only, and both functions run with the caller's own permissions
-- (SECURITY INVOKER), so existing row-level security, the death lock and the document limits still apply.
-- Assets already use deleted_at; their restore is an owner update and needs nothing here.
-- After 30 days the daily job (service role) removes bin rows and their stored files for good.

CREATE TABLE public.deleted_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  title text CHECK (title IS NULL OR length(title) <= 200),
  section_key text NOT NULL,
  category_key text NOT NULL,
  record_row jsonb NOT NULL,
  attachment_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  purge_after timestamptz NOT NULL DEFAULT timezone('utc', now()) + interval '30 days',
  UNIQUE (owner_user_id, item_id)
);
CREATE INDEX deleted_items_owner_idx ON public.deleted_items (owner_user_id, deleted_at DESC);
CREATE INDEX deleted_items_purge_idx ON public.deleted_items (purge_after);

ALTER TABLE public.deleted_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deleted_items FROM anon;
REVOKE UPDATE ON public.deleted_items FROM authenticated;
CREATE POLICY deleted_items_owner_select ON public.deleted_items
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY deleted_items_owner_insert ON public.deleted_items
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid() AND public.lf_vault_allows_owner_mutation(owner_user_id));
CREATE POLICY deleted_items_owner_delete ON public.deleted_items
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid() AND public.lf_vault_allows_owner_mutation(owner_user_id));

-- Move one of the caller's records to the bin. Its documents' stored files are kept until the bin is emptied.
CREATE FUNCTION public.lf_bin_record(p_record_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_record public.records; v_bin_id uuid;
BEGIN
  SELECT * INTO v_record FROM public.records r WHERE r.id = p_record_id AND r.owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'RECORD_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.deleted_items (owner_user_id, item_id, title, section_key, category_key, record_row, attachment_rows, contact_rows)
  VALUES (
    v_record.owner_user_id, v_record.id, left(COALESCE(NULLIF(v_record.title, ''), v_record.provider_name), 200),
    v_record.section_key, v_record.category_key, to_jsonb(v_record),
    COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.attachments a WHERE a.record_id = v_record.id AND a.owner_user_id = v_record.owner_user_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.record_contacts c WHERE c.record_id = v_record.id AND c.owner_user_id = v_record.owner_user_id), '[]'::jsonb))
  RETURNING id INTO v_bin_id;
  DELETE FROM public.records r WHERE r.id = v_record.id AND r.owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'RECORD_NOT_DELETED' USING ERRCODE = '42501'; END IF;
  RETURN v_bin_id;
END;
$$;

-- Put a binned record back, with the same id, its documents and its contacts. Refused after 30 days, and
-- refused by the document limit if the Vault has filled up since (nothing is changed in that case).
CREATE FUNCTION public.lf_restore_deleted_record(p_bin_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_bin public.deleted_items;
BEGIN
  SELECT * INTO v_bin FROM public.deleted_items d WHERE d.id = p_bin_id AND d.owner_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETED_ITEM_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_bin.purge_after <= timezone('utc', now()) THEN RAISE EXCEPTION 'DELETED_ITEM_EXPIRED' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.records SELECT * FROM jsonb_populate_record(NULL::public.records, v_bin.record_row);
  INSERT INTO public.attachments SELECT * FROM jsonb_populate_recordset(NULL::public.attachments, v_bin.attachment_rows);
  INSERT INTO public.record_contacts SELECT * FROM jsonb_populate_recordset(NULL::public.record_contacts, v_bin.contact_rows);
  DELETE FROM public.deleted_items d WHERE d.id = v_bin.id AND d.owner_user_id = auth.uid();
  RETURN v_bin.item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lf_bin_record(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_restore_deleted_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_bin_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_restore_deleted_record(uuid) TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.deleted_items TO authenticated;
GRANT ALL ON public.deleted_items TO service_role;
