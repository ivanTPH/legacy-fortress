\set ON_ERROR_STOP on
BEGIN;
\ir ../../supabase/migrations/20261027104509_linked_people_data_foundation.sql

-- Synthetic fixtures exist only until ROLLBACK.
INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.contacts (id, owner_user_id, full_name) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic Alice'),
  ('12121212-1212-4212-8212-121212121212', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic Carol'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Synthetic Bob');
INSERT INTO public.records (id, owner_user_id, section_key, category_key, title) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'finances', 'bank', 'Synthetic account'),
  ('13131313-1313-4313-8313-131313131313', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'property', 'home', 'Synthetic home'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'finances', 'bank', 'Other account');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES
  ('14141414-1414-4414-8414-141414141414', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic organisation');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES
  ('15151515-1515-4515-8515-151515151515', '14141414-1414-4414-8414-141414141414', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('16161616-1616-4616-8616-161616161616', '14141414-1414-4414-8414-141414141414',
   '15151515-1515-4515-8515-151515151515', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'legal', 'wills', 'Synthetic Will');
INSERT INTO public.documents (id, organisation_id, wallet_id, asset_id, owner_user_id, storage_path, file_name, mime_type) VALUES
  ('17171717-1717-4717-8717-171717171717', '14141414-1414-4414-8414-141414141414',
   '15151515-1515-4515-8515-151515151515', '16161616-1616-4616-8616-161616161616',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'synthetic/test.pdf', 'test.pdf', 'application/pdf');
INSERT INTO public.extraction_suggestions (
  owner_user_id, document_id, record_id, page, extracted_name, match_kind
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '17171717-1717-4717-8717-171717171717',
  '16161616-1616-4616-8616-161616161616', 1, 'Synthetic Alice', 'possible'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

INSERT INTO public.record_links (owner_user_id, record_type, record_id, person_id, role, manual_origin)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'record',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'adviser', 'new'
);
INSERT INTO public.record_links (owner_user_id, record_type, record_id, person_id, role, manual_origin)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'record', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '12121212-1212-4212-8212-121212121212', 'adviser', 'people'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'record', '13131313-1313-4313-8313-131313131313', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'joint owner', 'people');

DO $$
DECLARE
  denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.record_links) <> 3 THEN
    RAISE EXCEPTION 'Multiple links or contact reuse failed';
  END IF;
  BEGIN
    INSERT INTO public.record_links (owner_user_id, record_type, record_id, person_id, role, manual_origin)
    VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'record',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'adviser', 'people'
    );
  EXCEPTION WHEN OTHERS THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-owner person link was accepted'; END IF;
  denied := false;
  BEGIN
    INSERT INTO public.record_links (owner_user_id, record_type, record_id, person_id, role, manual_origin)
    VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'record',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'adviser', 'people'
    );
  EXCEPTION WHEN OTHERS THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-owner record link was accepted'; END IF;
  IF EXISTS (SELECT 1 FROM public.extraction_suggestions) THEN
    IF (SELECT count(*) FROM public.extraction_suggestions) <> 1 THEN
      RAISE EXCEPTION 'Owner suggestion visibility is incorrect';
    END IF;
  ELSE
    RAISE EXCEPTION 'Owner cannot see their suggestion';
  END IF;
END;
$$;

UPDATE public.record_links SET role = 'broker'
WHERE record_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  AND person_id = '12121212-1212-4212-8212-121212121212';
UPDATE public.record_links SET removed_at = timezone('utc', now())
WHERE record_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  AND person_id = '12121212-1212-4212-8212-121212121212';
DO $$
DECLARE denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.record_links WHERE removed_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'Soft removal affected another relationship';
  END IF;
  IF (SELECT count(*) FROM public.contacts WHERE id = '12121212-1212-4212-8212-121212121212') <> 1 THEN
    RAISE EXCEPTION 'Soft removal deleted the person';
  END IF;
  BEGIN
    UPDATE public.record_links SET role = 'director'
    WHERE record_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
      AND person_id = '12121212-1212-4212-8212-121212121212';
  EXCEPTION WHEN OTHERS THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Removed link remained editable'; END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.record_links) THEN
    RAISE EXCEPTION 'Other owner can read linked people';
  END IF;
  IF EXISTS (SELECT 1 FROM public.extraction_suggestions) THEN
    RAISE EXCEPTION 'Other owner can read extracted suggestion';
  END IF;
END;
$$;

RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_events
    WHERE resource_type = 'record'
      AND resource_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
      AND action = 'link.created'
  ) THEN
    RAISE EXCEPTION 'Link creation was not audited';
  END IF;
  IF (SELECT count(*) FROM public.audit_events
      WHERE resource_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
        AND action IN ('link.role_changed','link.removed')) <> 2 THEN
    RAISE EXCEPTION 'Role change or removal was not audited';
  END IF;
  IF has_table_privilege('authenticated', 'public.extraction_suggestions', 'INSERT') THEN
    RAISE EXCEPTION 'Browser clients can fabricate extraction suggestions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.account_access_grants
    WHERE owner_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) THEN
    RAISE EXCEPTION 'Link creation granted access';
  END IF;
END;
$$;
ROLLBACK;
