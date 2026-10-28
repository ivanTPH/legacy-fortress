\set ON_ERROR_STOP on
BEGIN;
\ir ../../supabase/migrations/20261027070000_restrict_linked_grants_to_explicit_scope.sql
\ir ../../supabase/migrations/20261027071500_document_display_titles.sql
\ir ../../supabase/migrations/20261027104509_linked_people_data_foundation.sql
\ir ../../supabase/migrations/20261027211900_linked_people_suggestion_review.sql

INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
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
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'synthetic/will.pdf', 'synthetic-will.pdf', 'application/pdf');
INSERT INTO public.contacts (id, owner_user_id, full_name) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Bob Smith');
INSERT INTO public.extraction_suggestions (id, owner_user_id, document_id, record_id, page, extracted_name, extracted_role, match_person_id, match_kind) VALUES
  ('18181818-1818-4818-8818-181818181818', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '17171717-1717-4717-8717-171717171717', '16161616-1616-4616-8616-161616161616', 3, 'Robert Smith', 'Executor', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'possible'),
  ('19191919-1919-4919-8919-191919191919', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '17171717-1717-4717-8717-171717171717', '16161616-1616-4616-8616-161616161616', 4, 'Priya Nair', 'Executor', NULL, 'none'),
  ('20202020-2020-4020-8020-202020202020', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '17171717-1717-4717-8717-171717171717', '16161616-1616-4616-8616-161616161616', 5, 'Not a person', NULL, NULL, 'none'),
  ('21212121-2121-4121-8121-212121212121', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '17171717-1717-4717-8717-171717171717', '16161616-1616-4616-8616-161616161616', 6, 'Another person', 'Executor', NULL, 'none');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.extraction_suggestions) THEN RAISE EXCEPTION 'Cross-owner suggestions exposed'; END IF;
  BEGIN
    PERFORM public.lf_review_linked_person_suggestion('18181818-1818-4818-8818-181818181818', 'confirm', 'existing', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'Executor');
    RAISE EXCEPTION 'Cross-owner review unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Cross-owner review unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
-- A possible match is never linked until the owner explicitly selects that person.
DO $$ BEGIN
  BEGIN
    PERFORM public.lf_review_linked_person_suggestion('18181818-1818-4818-8818-181818181818', 'confirm', 'existing', NULL, NULL, 'Executor');
    RAISE EXCEPTION 'Unselected match unexpectedly linked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Unselected match unexpectedly linked' THEN RAISE; END IF;
  END;
END $$;
SELECT * FROM public.lf_review_linked_person_suggestion('18181818-1818-4818-8818-181818181818', 'confirm', 'existing', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL, 'Executor');
SELECT * FROM public.lf_review_linked_person_suggestion('19191919-1919-4919-8919-191919191919', 'confirm', 'new', NULL, 'Priya Nair', 'Executor', NULL, 'priya@example.test', '+447700900123');
SELECT * FROM public.lf_review_linked_person_suggestion('20202020-2020-4020-8020-202020202020', 'dismiss');
DO $$ BEGIN
  BEGIN
    UPDATE public.extraction_suggestions SET status = 'accepted', decided_by = auth.uid(), decided_at = now()
      WHERE id = '21212121-2121-4121-8121-212121212121';
    RAISE EXCEPTION 'Direct suggestion update unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Direct suggestion update unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;
UPDATE public.wallets SET vault_lifecycle_state = 'PROTECTIVE_LOCK'
  WHERE id = '15151515-1515-4515-8515-151515151515';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.lf_review_linked_person_suggestion('21212121-2121-4121-8121-212121212121', 'dismiss');
    RAISE EXCEPTION 'Locked Vault review unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Locked Vault review unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.record_links) <> 2 THEN RAISE EXCEPTION 'Expected two confirmed links'; END IF;
  IF (SELECT count(*) FROM public.contacts) <> 2 THEN RAISE EXCEPTION 'New person not created exactly once'; END IF;
  IF (SELECT count(*) FROM public.extraction_suggestions WHERE status = 'dismissed') <> 1 THEN RAISE EXCEPTION 'Dismissal not saved'; END IF;
  IF (SELECT count(*) FROM public.record_links WHERE source = 'extraction' AND source_page IN (3,4)) <> 2 THEN RAISE EXCEPTION 'Provenance missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.contact_links) THEN RAISE EXCEPTION 'Legacy contact links changed'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_access_grants) THEN RAISE EXCEPTION 'Access grant created'; END IF;
  IF (SELECT count(*) FROM public.audit_events WHERE category = 'linked_people' AND action IN ('suggestion.edited','suggestion.accepted','suggestion.dismissed','link.created')) <> 5 THEN RAISE EXCEPTION 'Expected append-only audit events'; END IF;
  BEGIN
    PERFORM public.lf_review_linked_person_suggestion('19191919-1919-4919-8919-191919191919', 'confirm', 'new', NULL, 'Priya Nair', 'Executor');
    RAISE EXCEPTION 'Repeated review unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Repeated review unexpectedly succeeded' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
