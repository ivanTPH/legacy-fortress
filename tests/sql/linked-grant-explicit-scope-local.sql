\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('98989898-9898-4989-8989-989898989898');
INSERT INTO public.contacts (id, owner_user_id, full_name) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic contact');
INSERT INTO public.records (id, owner_user_id, section_key, category_key, title) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'finances', 'bank', 'Synthetic record');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES
  ('14141414-1414-4414-8414-141414141414', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic organisation');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES
  ('15151515-1515-4515-8515-151515151515', '14141414-1414-4414-8414-141414141414', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('16161616-1616-4616-8616-161616161616', '14141414-1414-4414-8414-141414141414',
   '15151515-1515-4515-8515-151515151515', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'legal', 'wills', 'Synthetic asset');
INSERT INTO public.documents (id, organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type) VALUES
  ('17171717-1717-4717-8717-171717171717', '14141414-1414-4414-8414-141414141414',
   '15151515-1515-4515-8515-151515151515', '16161616-1616-4616-8616-161616161616',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'vault-docs',
   'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/synthetic.pdf', 'synthetic.pdf', 'application/pdf');
INSERT INTO public.attachments (record_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'vault-docs', 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/legacy.pdf', 'legacy.pdf', 'application/pdf');
INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES
  ('98989898-9898-4989-8989-989898989898', 2);
INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '98989898-9898-4989-8989-989898989898',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'friend_or_family', 'active', '{}'::jsonb);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = '98989898-9898-4989-8989-989898989898';
DO $$ BEGIN
  IF public.linked_grant_allows_asset('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '16161616-1616-4616-8616-161616161616')
     OR public.linked_grant_allows_record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') THEN
    RAISE EXCEPTION 'Precondition failed: empty grant already has access';
  END IF;
END $$;
RESET ROLE;

INSERT INTO public.contact_links (owner_user_id, contact_id, source_kind, source_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'asset', '16161616-1616-4616-8616-161616161616');
INSERT INTO public.record_contacts (record_id, owner_user_id, contact_name, contact_id) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'Synthetic contact', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '98989898-9898-4989-8989-989898989898';
DO $$ BEGIN
  IF public.linked_grant_allows_asset('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '16161616-1616-4616-8616-161616161616')
     OR public.linked_grant_allows_record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
     OR public.linked_grant_allows_storage_object('vault-docs', 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/synthetic.pdf')
     OR public.linked_grant_allows_storage_object('vault-docs', 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/legacy.pdf')
     OR EXISTS (SELECT 1 FROM public.assets WHERE id = '16161616-1616-4616-8616-161616161616')
     OR EXISTS (SELECT 1 FROM public.records WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
     OR EXISTS (SELECT 1 FROM public.documents WHERE id = '17171717-1717-4717-8717-171717171717')
     OR EXISTS (SELECT 1 FROM public.attachments WHERE storage_path = 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/legacy.pdf') THEN
    RAISE EXCEPTION 'Contact association widened an empty-scope grant';
  END IF;
END $$;
RESET ROLE;
UPDATE public.account_access_grants
SET permissions_override = jsonb_build_object(
  'asset_ids', jsonb_build_array('16161616-1616-4616-8616-161616161616'),
  'record_ids', jsonb_build_array('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'))
WHERE owner_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '98989898-9898-4989-8989-989898989898';
DO $$ BEGIN
  IF NOT public.linked_grant_allows_asset('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '16161616-1616-4616-8616-161616161616')
     OR NOT public.linked_grant_allows_record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
     OR NOT public.linked_grant_allows_storage_object('vault-docs', 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/synthetic.pdf')
     OR NOT public.linked_grant_allows_storage_object('vault-docs', 'users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/legacy.pdf')
     OR NOT EXISTS (SELECT 1 FROM public.assets WHERE id = '16161616-1616-4616-8616-161616161616')
     OR NOT EXISTS (SELECT 1 FROM public.records WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') THEN
    RAISE EXCEPTION 'Explicitly scoped access stopped working';
  END IF;
  IF public.linked_grant_allows_asset('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '16161616-1616-4616-8616-161616161616')
     OR public.linked_grant_allows_record('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') THEN
    RAISE EXCEPTION 'Cross-owner grant check allowed access';
  END IF;
END $$;
RESET ROLE;
UPDATE public.wallets SET vault_lifecycle_state = 'PROTECTIVE_LOCK'
WHERE id = '15151515-1515-4515-8515-151515151515';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '98989898-9898-4989-8989-989898989898';
DO $$ BEGIN
  IF public.linked_grant_allows_asset('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '16161616-1616-4616-8616-161616161616')
     OR public.linked_grant_allows_record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') THEN
    RAISE EXCEPTION 'Protective lock did not deny access';
  END IF;
END $$;
RESET ROLE;
UPDATE public.wallets SET vault_lifecycle_state = 'OWNER_ACTIVE'
WHERE id = '15151515-1515-4515-8515-151515151515';
UPDATE public.account_access_grants SET activation_status = 'revoked'
WHERE owner_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '98989898-9898-4989-8989-989898989898';
DO $$ BEGIN
  IF public.linked_grant_allows_asset('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '16161616-1616-4616-8616-161616161616')
     OR public.linked_grant_allows_record('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
     OR EXISTS (SELECT 1 FROM public.assets WHERE id = '16161616-1616-4616-8616-161616161616')
     OR EXISTS (SELECT 1 FROM public.records WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') THEN
    RAISE EXCEPTION 'Revoked grant retained access';
  END IF;
END $$;
ROLLBACK;
