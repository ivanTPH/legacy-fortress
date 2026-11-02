-- Rollback-only local test for 20261102120000_record_link_tell_person.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
\i supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql
\i supabase/migrations/20261031170000_nominee_requests_and_release_state.sql
\i supabase/migrations/20261031190000_estate_release_nominations.sql
\i supabase/migrations/20261031210000_person_notifications.sql
\i supabase/migrations/20261031240000_death_report_evidence_requests.sql
-- Minimal record_links for the local harness (the real table comes from the Linked People migrations).
CREATE TABLE IF NOT EXISTS public.record_links (id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, record_id uuid NOT NULL, record_type text NOT NULL, person_id uuid NOT NULL, role text NOT NULL, removed_at timestamptz);
-- Like TEST: a notification of a kind added by the death-report change already exists.
INSERT INTO auth.users (id) VALUES ('e0000000-0000-4000-8000-00000000000e') ON CONFLICT DO NOTHING;
INSERT INTO public.user_notifications (recipient_user_id, kind) VALUES ('e0000000-0000-4000-8000-00000000000e', 'more_evidence_requested');
\i supabase/migrations/20261102120000_record_link_tell_person.sql

INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('f0000000-0000-4000-8000-00000000000f');
INSERT INTO public.user_profiles (user_id, display_name) VALUES ('a0000000-0000-4000-8000-00000000000a', 'Olive Owner');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'Joined Person', 'e0000000-0000-4000-8000-00000000000e'),
  ('a5000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-00000000000a', 'Not Joined', NULL);
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'legal', 'power-of-attorney', 'Synthetic LPA');
INSERT INTO public.record_links (id, owner_user_id, record_id, record_type, person_id, role, created_by, manual_origin) VALUES
  ('a7000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'asset', 'a5000000-0000-4000-8000-00000000000a', 'Attorney', 'a0000000-0000-4000-8000-00000000000a', 'people'),
  ('a7000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'asset', 'a5000000-0000-4000-8000-00000000000b', 'Attorney', 'a0000000-0000-4000-8000-00000000000a', 'people');
GRANT SELECT ON public.record_links TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
-- A stranger can't use someone else's link.
SET LOCAL request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
DO $$ DECLARE v_ok boolean := false; BEGIN
  BEGIN PERFORM public.lf_tell_linked_person('a7000000-0000-4000-8000-00000000000a'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'stranger could notify'; END IF;
END $$;
-- The owner tells a joined person; someone who hasn't joined isn't told; repeat taps make one message.
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ BEGIN
  IF NOT public.lf_tell_linked_person('a7000000-0000-4000-8000-00000000000a') THEN RAISE EXCEPTION 'joined person not told'; END IF;
  PERFORM public.lf_tell_linked_person('a7000000-0000-4000-8000-00000000000a');
  IF public.lf_tell_linked_person('a7000000-0000-4000-8000-00000000000b') THEN RAISE EXCEPTION 'unjoined person told'; END IF;
  -- The owner can't insert notifications directly.
  BEGIN INSERT INTO public.user_notifications (recipient_user_id, kind) VALUES ('e0000000-0000-4000-8000-00000000000e', 'record_link_added'); RAISE EXCEPTION 'direct insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- The recipient sees one content-free notification.
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.user_notifications WHERE kind = 'record_link_added') <> 1 THEN RAISE EXCEPTION 'expected exactly one notification'; END IF;
  IF (SELECT owner_display_name FROM public.user_notifications WHERE kind = 'record_link_added') <> 'Olive Owner' THEN RAISE EXCEPTION 'wrong owner name'; END IF;
  IF (SELECT link FROM public.user_notifications WHERE kind = 'record_link_added') <> '/notifications' THEN RAISE EXCEPTION 'link leaks detail'; END IF;
END $$;
RESET ROLE;
SELECT 'record-link-tell: all checks passed';
ROLLBACK;
