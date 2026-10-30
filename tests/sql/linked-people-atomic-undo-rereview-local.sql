-- Rollback-only local test for 20261030090000/090100/090200. Synthetic IDs only.
-- Run: psql -v ON_ERROR_STOP=1 -f tests/sql/linked-people-atomic-undo-rereview-local.sql
BEGIN;
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('b0000000-0000-4000-8000-00000000000b');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title)
VALUES ('a3000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'legal', 'wills', 'Synthetic Will');
INSERT INTO public.documents (id, organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type)
VALUES ('a4000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'a/will.pdf', 'will.pdf', 'application/pdf');
-- A pending suggestion as written by the server extractor (service role, before RLS).
INSERT INTO public.extraction_suggestions (id, owner_user_id, document_id, record_id, page, extracted_name, extracted_role, match_kind)
VALUES ('a5000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-00000000000a', 2, 'Mary Placeholder', 'Reserve executor', 'none');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';

DO $$
DECLARE r record; r2 record; v_count int; v_link uuid; v_undo uuid; v_reopen uuid; v_reopen2 uuid;
BEGIN
  -- 1. Atomic save: new person + link in one call.
  SELECT * INTO r FROM public.lf_save_record_linked_person('c0000000-0000-4000-8000-000000000001', 'asset', 'a3000000-0000-4000-8000-00000000000a', NULL, 'Jane Example', 'Jane@Example.test', NULL, 'Sister', 'Executor', NULL);
  IF NOT r.created_person THEN RAISE EXCEPTION 'expected a new person'; END IF;
  -- 2. Idempotent retry returns the same rows and creates nothing new.
  SELECT * INTO r2 FROM public.lf_save_record_linked_person('c0000000-0000-4000-8000-000000000001', 'asset', 'a3000000-0000-4000-8000-00000000000a', NULL, 'Jane Example', 'jane@example.test', NULL, NULL, 'Executor', NULL);
  IF (r2.person_id, r2.link_id) IS DISTINCT FROM (r.person_id, r.link_id) THEN RAISE EXCEPTION 'retry was not idempotent'; END IF;
  SELECT count(*) INTO v_count FROM public.contacts WHERE full_name = 'Jane Example';
  IF v_count <> 1 THEN RAISE EXCEPTION 'retry duplicated the person (%)', v_count; END IF;
  -- 3. Duplicate email with a new request is refused, nothing half-saved.
  BEGIN
    PERFORM public.lf_save_record_linked_person('c0000000-0000-4000-8000-000000000002', 'asset', 'a3000000-0000-4000-8000-00000000000a', NULL, 'Jane Again', 'jane@example.test', NULL, NULL, 'Executor', NULL);
    RAISE EXCEPTION 'duplicate email accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  -- 4. Atomicity: a failing link (Other without text) leaves no new person behind.
  BEGIN
    PERFORM public.lf_save_record_linked_person('c0000000-0000-4000-8000-000000000003', 'asset', 'a3000000-0000-4000-8000-00000000000a', NULL, 'Ghost Person', NULL, NULL, NULL, 'Other', NULL);
    RAISE EXCEPTION 'invalid role accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.contacts WHERE full_name = 'Ghost Person') THEN RAISE EXCEPTION 'failed save left a person'; END IF;
  -- 5. No access grant is created by linking.
  IF EXISTS (SELECT 1 FROM public.account_access_grants WHERE owner_user_id = auth.uid()) THEN RAISE EXCEPTION 'linking created an access grant'; END IF;

  -- 6. Undo within the window restores a NEW active link pointing at the removed one.
  UPDATE public.record_links SET removed_at = timezone('utc', now()) WHERE id = r.link_id;
  SELECT link_id INTO v_undo FROM public.lf_undo_record_link_removal(r.link_id);
  IF v_undo = r.link_id THEN RAISE EXCEPTION 'undo resurrected the removed row'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.record_links WHERE id = v_undo AND restored_from_link_id = r.link_id AND removed_at IS NULL AND role = 'Executor') THEN RAISE EXCEPTION 'undo did not restore role'; END IF;
  IF (SELECT removed_at FROM public.record_links WHERE id = r.link_id) IS NULL THEN RAISE EXCEPTION 'original removal was changed'; END IF;
  -- 7. Undo after the window is refused.
  UPDATE public.record_links SET removed_at = timezone('utc', now()) WHERE id = v_undo;
  RESET ROLE;
  ALTER TABLE public.record_links DISABLE TRIGGER record_links_validate;
  UPDATE public.record_links SET removed_at = timezone('utc', now()) - interval '10 minutes' WHERE id = v_undo;
  ALTER TABLE public.record_links ENABLE TRIGGER record_links_validate;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.lf_undo_record_link_removal(v_undo);
    RAISE EXCEPTION 'late undo accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;

  -- 8. Confirm the document suggestion, remove the link, then re-review it.
  SELECT link_id INTO v_link FROM public.lf_review_linked_person_suggestion('a5000000-0000-4000-8000-00000000000a', 'confirm', 'new', NULL, 'Mary Placeholder', 'Reserve executor', NULL, NULL, NULL);
  IF v_link IS NULL THEN RAISE EXCEPTION 'suggestion confirm did not link'; END IF;
  BEGIN
    PERFORM public.lf_reopen_linked_person_suggestion(v_link);
    RAISE EXCEPTION 'reopen allowed on an active link';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.record_links SET removed_at = timezone('utc', now()) WHERE id = v_link;
  SELECT suggestion_id INTO v_reopen FROM public.lf_reopen_linked_person_suggestion(v_link);
  SELECT suggestion_id INTO v_reopen2 FROM public.lf_reopen_linked_person_suggestion(v_link);
  IF v_reopen IS NULL OR v_reopen <> v_reopen2 THEN RAISE EXCEPTION 'reopen not idempotent'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.extraction_suggestions WHERE id = v_reopen AND status = 'pending' AND match_person_id IS NULL AND reopened_from_suggestion_id = 'a5000000-0000-4000-8000-00000000000a') THEN RAISE EXCEPTION 'reopened suggestion wrong'; END IF;
  IF (SELECT status FROM public.extraction_suggestions WHERE id = 'a5000000-0000-4000-8000-00000000000a') <> 'accepted' THEN RAISE EXCEPTION 'original decision changed'; END IF;

  -- 9. Private details: owner can write and read.
  INSERT INTO public.contact_private_details (contact_id, owner_user_id, address, notes) VALUES (r.person_id, 'a0000000-0000-4000-8000-00000000000a', '2 Sample Street', 'Prefers email');
  IF (SELECT notes FROM public.contact_private_details WHERE contact_id = r.person_id) <> 'Prefers email' THEN RAISE EXCEPTION 'owner cannot read details'; END IF;
  RAISE NOTICE 'OWNER CHECKS PASSED';
END $$;

-- Legal record + attachment (Wills are records with attachments).
RESET ROLE;
INSERT INTO public.records (id, owner_user_id, section_key, category_key, title) VALUES ('a6000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'legal', 'wills', 'Synthetic legacy Will');
INSERT INTO public.attachments (id, record_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes)
VALUES ('a7000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'a/records/w.pdf', 'w.pdf', 'application/pdf', 100);
INSERT INTO public.extraction_suggestions (id, owner_user_id, record_type, attachment_id, record_id, page, extracted_name, extracted_role, match_kind)
VALUES ('a8000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'record', 'a7000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000a', 1, 'Robert Sample', 'Executor', 'none');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.extraction_suggestions (owner_user_id, record_type, attachment_id, record_id, page, extracted_name, match_kind)
    VALUES ('b0000000-0000-4000-8000-00000000000b', 'record', 'a7000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000a', 1, 'Spoof', 'none');
    RAISE EXCEPTION 'cross-owner record suggestion accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%same owner%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.extraction_suggestions (owner_user_id, record_type, document_id, attachment_id, record_id, page, extracted_name, match_kind)
    VALUES ('a0000000-0000-4000-8000-00000000000a', 'record', 'a4000000-0000-4000-8000-00000000000a', 'a7000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000a', 1, 'Both', 'none');
    RAISE EXCEPTION 'suggestion with two sources accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ DECLARE v_link uuid; BEGIN
  SELECT link_id INTO v_link FROM public.lf_review_linked_person_suggestion('a8000000-0000-4000-8000-00000000000a', 'confirm', 'new', NULL, 'Robert Sample', 'Executor', NULL, NULL, NULL);
  IF NOT EXISTS (SELECT 1 FROM public.record_links WHERE id = v_link AND record_type = 'record' AND record_id = 'a6000000-0000-4000-8000-00000000000a'
      AND source = 'extraction' AND source_attachment_id = 'a7000000-0000-4000-8000-00000000000a' AND source_document_id IS NULL AND source_page = 1) THEN
    RAISE EXCEPTION 'record suggestion did not create an attachment-sourced link';
  END IF;
  RAISE NOTICE 'RECORD ATTACHMENT CHECKS PASSED';
END $$;

-- Cross-owner: user B sees and changes nothing of A's.
SET LOCAL request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
DO $$
DECLARE v_link uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.contact_private_details) THEN RAISE EXCEPTION 'B can read A private details'; END IF;
  IF EXISTS (SELECT 1 FROM public.record_link_requests) THEN RAISE EXCEPTION 'B can read A requests'; END IF;
  RESET ROLE; SELECT id INTO v_link FROM public.record_links WHERE removed_at IS NOT NULL LIMIT 1; SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.lf_undo_record_link_removal(v_link); RAISE EXCEPTION 'B undid A link';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_reopen_linked_person_suggestion(v_link); RAISE EXCEPTION 'B reopened A suggestion';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.lf_save_record_linked_person('d0000000-0000-4000-8000-000000000001', 'asset', 'a3000000-0000-4000-8000-00000000000a', NULL, 'Intruder', NULL, NULL, NULL, 'Executor', NULL);
    RAISE EXCEPTION 'B linked into A record';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%unavailable to this owner%' AND SQLERRM NOT LIKE '%must belong%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.contacts WHERE full_name = 'Intruder') THEN RAISE EXCEPTION 'failed cross-owner save left a person'; END IF;
  RAISE NOTICE 'CROSS-OWNER CHECKS PASSED';
END $$;

-- Anonymous: cannot call the functions.
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.lf_save_record_linked_person(gen_random_uuid(), 'asset', gen_random_uuid(), NULL, 'X', NULL, NULL, NULL, 'Executor', NULL); RAISE EXCEPTION 'anon allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'ANON CHECKS PASSED';
END $$;
ROLLBACK;
