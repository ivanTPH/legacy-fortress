\set ON_ERROR_STOP on
BEGIN;
\ir ../../supabase/migrations/20261027071500_document_display_titles.sql

-- Synthetic documents and users; all rows and schema changes roll back.
INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('98989898-9898-4989-8989-989898989898');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES
  ('14141414-1414-4414-8414-141414141414',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic owner organisation');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES
  ('15151515-1515-4515-8515-151515151515',
   '14141414-1414-4414-8414-141414141414',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('16161616-1616-4616-8616-161616161616',
   '14141414-1414-4414-8414-141414141414',
   '15151515-1515-4515-8515-151515151515',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'legal', 'wills', 'Synthetic Will');
INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES
  ('98989898-9898-4989-8989-989898989898', 2);
INSERT INTO public.account_access_grants (
  owner_user_id, linked_user_id, assigned_role, activation_status, permissions_override
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '98989898-9898-4989-8989-989898989898',
  'friend_or_family', 'active',
  '{"asset_ids":["16161616-1616-4616-8616-161616161616"]}'::jsonb
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
INSERT INTO public.documents (
  id, organisation_id, wallet_id, asset_id, owner_user_id,
  storage_bucket, storage_path, file_name, mime_type, size_bytes,
  display_title
) VALUES (
  '17171717-1717-4717-8717-171717171717',
  '14141414-1414-4414-8414-141414141414',
  '15151515-1515-4515-8515-151515151515',
  '16161616-1616-4616-8616-161616161616',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'vault-docs', 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.pdf',
  'original.pdf', 'application/pdf', 128, 'My Will'
);
UPDATE public.documents SET display_title = 'Updated Will'
WHERE id = '17171717-1717-4717-8717-171717171717';

DO $$
DECLARE denied boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = '17171717-1717-4717-8717-171717171717'
      AND display_title = 'Updated Will'
      AND file_name = 'original.pdf'
      AND storage_path = 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.pdf'
      AND size_bytes = 128
  ) THEN RAISE EXCEPTION 'Title edit changed the original document identity'; END IF;
  BEGIN
    UPDATE public.documents SET file_name = 'rewritten.pdf'
    WHERE id = '17171717-1717-4717-8717-171717171717';
  EXCEPTION WHEN OTHERS THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Original filename was mutable'; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '98989898-9898-4989-8989-989898989898';
DO $$
DECLARE changed_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.documents
    WHERE id = '17171717-1717-4717-8717-171717171717'
      AND display_title = 'Updated Will') THEN
    RAISE EXCEPTION 'Explicitly linked viewer cannot read the document title';
  END IF;
  UPDATE public.documents SET display_title = 'Viewer rename attempt'
  WHERE id = '17171717-1717-4717-8717-171717171717';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'Linked viewer could rename owner document';
  END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$
DECLARE changed_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.documents
    WHERE id = '17171717-1717-4717-8717-171717171717') THEN
    RAISE EXCEPTION 'Unrelated owner can read the document';
  END IF;
  UPDATE public.documents SET display_title = 'Other owner rename attempt'
  WHERE id = '17171717-1717-4717-8717-171717171717';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'Unrelated owner could rename document';
  END IF;
END;
$$;

RESET ROLE;
DO $$
DECLARE denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.audit_events
    WHERE resource_id = '17171717-1717-4717-8717-171717171717'
      AND action IN ('display_title_created', 'display_title_changed')) <> 2 THEN
    RAISE EXCEPTION 'Create/rename title audits missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_events
    WHERE resource_id = '17171717-1717-4717-8717-171717171717'
      AND metadata::text ILIKE '%Updated Will%') THEN
    RAISE EXCEPTION 'Audit metadata contains a document title';
  END IF;
  BEGIN
    UPDATE public.audit_events SET action = 'tampered'
    WHERE resource_id = '17171717-1717-4717-8717-171717171717';
  EXCEPTION WHEN OTHERS THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Audit events were mutable'; END IF;
END;
$$;
ROLLBACK;
