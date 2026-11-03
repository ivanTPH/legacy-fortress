-- Rollback-only local test for 20261103120000_record_suggestions.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
\i supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql
\i supabase/migrations/20261031170000_nominee_requests_and_release_state.sql
\i supabase/migrations/20261031190000_estate_release_nominations.sql
\i supabase/migrations/20261031210000_person_notifications.sql
\i supabase/migrations/20261031230000_record_history.sql
\i supabase/migrations/20261031240000_death_report_evidence_requests.sql
CREATE TABLE IF NOT EXISTS public.record_links (id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, record_id uuid NOT NULL, record_type text NOT NULL, person_id uuid NOT NULL, role text NOT NULL, removed_at timestamptz);
\i supabase/migrations/20261102120000_record_link_tell_person.sql
-- Like TEST: rows of every existing kind and action already exist.
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('e0000000-0000-4000-8000-00000000000e'), ('f0000000-0000-4000-8000-00000000000f'), ('d0000000-0000-4000-8000-00000000000d');
INSERT INTO public.user_notifications (recipient_user_id, kind) VALUES ('e0000000-0000-4000-8000-00000000000e', 'more_evidence_requested'), ('e0000000-0000-4000-8000-00000000000e', 'record_link_added');
INSERT INTO public.record_history (owner_user_id, record_id, record_type, action, actor_kind) VALUES ('a0000000-0000-4000-8000-00000000000a', gen_random_uuid(), 'asset', 'access_stopped', 'owner');
\i supabase/migrations/20261103120000_record_suggestions.sql

INSERT INTO public.user_profiles (user_id, display_name) VALUES ('a0000000-0000-4000-8000-00000000000a', 'Olive Owner'), ('e0000000-0000-4000-8000-00000000000e', 'Maya Adviser');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Synthetic Bank'),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Other Bank');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'Maya Adviser', 'e0000000-0000-4000-8000-00000000000e'),
  ('a5000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-00000000000a', 'Unverified Dan', 'd0000000-0000-4000-8000-00000000000d');
-- Maya: verified, active grant with no view scope. Dan: grant not yet active.
INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES ('e0000000-0000-4000-8000-00000000000e', 2) ON CONFLICT DO NOTHING;
INSERT INTO public.account_access_grants (id, owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override) VALUES
  ('a6000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'a5000000-0000-4000-8000-00000000000e', 'professional_advisor', 'active', '{}'),
  ('a6000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000d', 'a5000000-0000-4000-8000-00000000000d', 'professional_advisor', 'accepted', '{}');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';

-- Owner chooses who may suggest. A stranger can't add a permission on the owner's record.
SET LOCAL request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
DO $$ BEGIN
  BEGIN INSERT INTO public.record_suggestion_permissions (owner_user_id, grant_id, asset_id) VALUES ('a0000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000e', 'a3000000-0000-4000-8000-000000000001'); RAISE EXCEPTION 'stranger added permission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.record_suggestion_permissions (owner_user_id, grant_id, asset_id) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000e', 'a3000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000d', 'a3000000-0000-4000-8000-000000000001');

-- Suggest permission is not view access: Maya still can't open the record.
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF public.linked_grant_allows_asset('a0000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'suggest permission granted viewing'; END IF;
  IF (SELECT count(*) FROM public.lf_suggestion_targets()) <> 1 THEN RAISE EXCEPTION 'expected one target'; END IF;
  IF (SELECT record_title FROM public.lf_suggestion_targets()) <> 'Synthetic Bank' THEN RAISE EXCEPTION 'wrong target'; END IF;
  -- Not for a record she wasn't given; not with a file path outside her own area.
  BEGIN PERFORM public.lf_create_document_suggestion('a3000000-0000-4000-8000-000000000002', 'x.pdf', 'application/pdf', 10, 'a0000000-0000-4000-8000-00000000000a/e0000000-0000-4000-8000-00000000000e/1/x.pdf'); RAISE EXCEPTION 'suggested on other record';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_create_document_suggestion('a3000000-0000-4000-8000-000000000001', 'x.pdf', 'application/pdf', 10, 'a0000000-0000-4000-8000-00000000000a/f0000000-0000-4000-8000-00000000000f/1/x.pdf'); RAISE EXCEPTION 'foreign path accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Unexpected file location' THEN RAISE; END IF; END;
  -- Direct writes are blocked.
  BEGIN INSERT INTO public.record_suggestions (owner_user_id, asset_id, proposer_user_id, file_name, mime_type, size_bytes, storage_path) VALUES ('a0000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000000e', 'x', 'x', 1, 'a0000000-0000-4000-8000-00000000000a/e0000000-0000-4000-8000-00000000000e/x'); RAISE EXCEPTION 'direct insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.lf_create_document_suggestion('a3000000-0000-4000-8000-000000000001', 'Statement Oct.pdf', 'application/pdf', 1200, 'a0000000-0000-4000-8000-00000000000a/e0000000-0000-4000-8000-00000000000e/s1/Statement Oct.pdf', 'October statement') AS s1 \gset
SELECT public.lf_create_document_suggestion('a3000000-0000-4000-8000-000000000001', 'Second.pdf', 'application/pdf', 1200, 'a0000000-0000-4000-8000-00000000000a/e0000000-0000-4000-8000-00000000000e/s2/Second.pdf') AS s2 \gset
SELECT public.lf_create_document_suggestion('a3000000-0000-4000-8000-000000000001', 'Third.pdf', 'application/pdf', 1200, 'a0000000-0000-4000-8000-00000000000a/e0000000-0000-4000-8000-00000000000e/s3/Third.pdf') AS s3 \gset
SELECT public.lf_comment_on_suggestion(:'s1', 'Here is the October statement');
-- The proposer can't approve or reject.
DO $$ BEGIN
  BEGIN PERFORM public.lf_approve_suggestion((SELECT id FROM public.record_suggestions WHERE file_name = 'Statement Oct.pdf')); RAISE EXCEPTION 'proposer approved';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_reject_suggestion((SELECT id FROM public.record_suggestions WHERE file_name = 'Statement Oct.pdf'), 'other', 'x'); RAISE EXCEPTION 'proposer rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.lf_withdraw_suggestion(:'s3');

-- Dan's grant isn't active, so he can't suggest even with the permission row.
SET LOCAL request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000d';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.lf_suggestion_targets()) <> 0 THEN RAISE EXCEPTION 'inactive grant has targets'; END IF;
  BEGIN PERFORM public.lf_create_document_suggestion('a3000000-0000-4000-8000-000000000001', 'x.pdf', 'application/pdf', 10, 'a0000000-0000-4000-8000-00000000000a/d0000000-0000-4000-8000-00000000000d/1/x.pdf'); RAISE EXCEPTION 'inactive grant suggested';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- A stranger sees nothing.
SET LOCAL request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.record_suggestions) <> 0 OR (SELECT count(*) FROM public.record_suggestion_comments) <> 0 THEN RAISE EXCEPTION 'stranger sees suggestions'; END IF;
  BEGIN PERFORM public.lf_approve_suggestion((SELECT id FROM public.record_suggestions LIMIT 1)); EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- Owner: sees all three, comments, rejects one (reason required; Other needs a comment), approves one.
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.record_suggestions) <> 3 THEN RAISE EXCEPTION 'owner should see 3'; END IF;
  IF (SELECT count(*) FROM public.user_notifications WHERE recipient_user_id <> 'a0000000-0000-4000-8000-00000000000a') <> 0 THEN RAISE EXCEPTION 'owner reads others notifications'; END IF;
END $$;
SELECT public.lf_comment_on_suggestion(:'s1', 'Thanks, checking now');
DO $$ BEGIN
  BEGIN PERFORM public.lf_reject_suggestion((SELECT id FROM public.record_suggestions WHERE file_name = 'Second.pdf'), NULL); RAISE EXCEPTION 'no reason accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN PERFORM public.lf_reject_suggestion((SELECT id FROM public.record_suggestions WHERE file_name = 'Second.pdf'), 'other', ' '); RAISE EXCEPTION 'other without comment accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN PERFORM public.lf_reject_suggestion((SELECT id FROM public.record_suggestions WHERE file_name = 'Third.pdf'), 'cant_read'); RAISE EXCEPTION 'withdrawn rejected';
  EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
SELECT public.lf_reject_suggestion(:'s2', 'wrong_document', 'This is last year''s');
SELECT storage_path AS approved_path FROM public.lf_approve_suggestion(:'s1') \gset
-- Approving again before it is applied returns the same path; owner can't apply it themselves.
SELECT count(*) FROM public.lf_approve_suggestion(:'s1');
DO $$ BEGIN
  BEGIN PERFORM public.lf_mark_suggestion_applied((SELECT id FROM public.record_suggestions WHERE file_name = 'Statement Oct.pdf'), gen_random_uuid()); RAISE EXCEPTION 'owner applied directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.record_suggestions SET status = 'applied'; RAISE EXCEPTION 'owner updated directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- The server (no browser session) adds the document as the System and marks it applied.
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE service_role;
INSERT INTO public.documents (id, organisation_id, wallet_id, asset_id, owner_user_id, storage_path, file_name, mime_type, size_bytes)
VALUES ('a8000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'users/a0000000-0000-4000-8000-00000000000a/x/Statement Oct.pdf', 'Statement Oct.pdf', 'application/pdf', 1200);
SELECT public.lf_mark_suggestion_applied(:'s1', 'a8000000-0000-4000-8000-000000000001');
SELECT public.lf_mark_suggestion_file_removed(:'s1');
SELECT public.lf_mark_suggestion_file_removed(:'s2');
RESET ROLE;

DO $$ BEGIN
  IF (SELECT status FROM public.record_suggestions WHERE file_name = 'Statement Oct.pdf') <> 'applied' THEN RAISE EXCEPTION 'not applied'; END IF;
  IF (SELECT string_agg(action || ':' || actor_kind, ',' ORDER BY created_at, action) FROM public.record_history WHERE record_id = 'a3000000-0000-4000-8000-000000000001')
     NOT LIKE '%suggestion_proposed:person%' THEN RAISE EXCEPTION 'proposal not in history'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.record_history WHERE record_id = 'a3000000-0000-4000-8000-000000000001' AND action = 'suggestion_approved' AND actor_kind = 'owner') THEN RAISE EXCEPTION 'approval not by owner'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.record_history WHERE record_id = 'a3000000-0000-4000-8000-000000000001' AND action = 'document_added' AND actor_kind = 'system') THEN RAISE EXCEPTION 'applied version not by System'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.record_history WHERE action = 'suggestion_rejected') OR NOT EXISTS (SELECT 1 FROM public.record_history WHERE action = 'suggestion_withdrawn') THEN RAISE EXCEPTION 'reject/withdraw missing'; END IF;
  IF (SELECT count(*) FROM public.record_suggestion_comments) <> 2 THEN RAISE EXCEPTION 'comments missing'; END IF;
  -- Notifications: owner told of 3 suggestions and 1 comment; Maya told of 1 comment, the rejection and the approval. Links carry ids only.
  IF (SELECT count(*) FROM public.user_notifications WHERE recipient_user_id = 'a0000000-0000-4000-8000-00000000000a' AND kind = 'suggestion_pending') <> 3 THEN RAISE EXCEPTION 'owner pending count'; END IF;
  IF (SELECT owner_display_name FROM public.user_notifications WHERE recipient_user_id = 'a0000000-0000-4000-8000-00000000000a' AND kind = 'suggestion_pending' LIMIT 1) <> 'Maya Adviser' THEN RAISE EXCEPTION 'owner should see proposer name'; END IF;
  IF (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.user_notifications WHERE recipient_user_id = 'e0000000-0000-4000-8000-00000000000e' AND kind LIKE 'suggestion%') <> 'suggestion_approved,suggestion_comment,suggestion_rejected' THEN RAISE EXCEPTION 'proposer notifications wrong'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_notifications WHERE link ~ 'Statement|Bank') THEN RAISE EXCEPTION 'link leaks detail'; END IF;
  IF (SELECT count(*) FROM public.record_suggestions WHERE file_removed_at IS NOT NULL) <> 2 THEN RAISE EXCEPTION 'file removal not recorded'; END IF;
END $$;

-- Owner removes the permission; Maya can no longer suggest. A decided suggestion takes no comments.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DELETE FROM public.record_suggestion_permissions WHERE grant_id = 'a6000000-0000-4000-8000-00000000000e';
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.lf_suggestion_targets()) <> 0 THEN RAISE EXCEPTION 'permission still active'; END IF;
  IF (SELECT count(*) FROM public.record_suggestions) <> 3 THEN RAISE EXCEPTION 'proposer should still see her own suggestions'; END IF;
  BEGIN PERFORM public.lf_comment_on_suggestion((SELECT id FROM public.record_suggestions WHERE file_name = 'Second.pdf'), 'why?'); RAISE EXCEPTION 'commented on decided';
  EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'record-suggestions: all checks passed';
ROLLBACK;
