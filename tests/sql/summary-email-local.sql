-- Rollback-only local test for 20261103140000_summary_email.sql (with the suggestions migration before it). Synthetic IDs only.
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
\i supabase/migrations/20261103120000_record_suggestions.sql
\i supabase/migrations/20261103140000_summary_email.sql

INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('e0000000-0000-4000-8000-00000000000e');
INSERT INTO public.user_notifications (recipient_user_id, kind) VALUES ('a0000000-0000-4000-8000-00000000000a', 'access_given'), ('e0000000-0000-4000-8000-00000000000e', 'access_given');
INSERT INTO public.record_history (owner_user_id, record_id, record_type, action, actor_kind) VALUES
  ('a0000000-0000-4000-8000-00000000000a', gen_random_uuid(), 'asset', 'updated', 'owner'),
  ('a0000000-0000-4000-8000-00000000000a', gen_random_uuid(), 'asset', 'document_added', 'system');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
SELECT public.lf_set_summary_frequency('weekly');
DO $$ BEGIN
  IF (SELECT frequency FROM public.summary_email_preferences) <> 'weekly' THEN RAISE EXCEPTION 'frequency not saved'; END IF;
  BEGIN PERFORM public.lf_set_summary_frequency('daily'); RAISE EXCEPTION 'bad frequency accepted'; EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN UPDATE public.summary_email_preferences SET last_sent_at = now(); RAISE EXCEPTION 'direct update allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_summary_counts('a0000000-0000-4000-8000-00000000000a', now() - interval '1 month'); RAISE EXCEPTION 'browser read counts'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_summary_unsubscribe(gen_random_uuid()); RAISE EXCEPTION 'browser unsubscribe'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.summary_email_preferences) <> 0 THEN RAISE EXCEPTION 'sees others preferences'; END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$ DECLARE v_todo int; v_updates int; v_token uuid; BEGIN
  SELECT todo_count, update_count INTO v_todo, v_updates FROM public.lf_summary_counts('a0000000-0000-4000-8000-00000000000a', now() - interval '1 month');
  -- The owner's own edit isn't an update; the System's document and one notification are.
  IF v_todo <> 0 OR v_updates <> 2 THEN RAISE EXCEPTION 'counts wrong: % %', v_todo, v_updates; END IF;
  SELECT unsubscribe_token INTO v_token FROM public.summary_email_preferences WHERE user_id = 'a0000000-0000-4000-8000-00000000000a';
  IF NOT public.lf_summary_unsubscribe(v_token) THEN RAISE EXCEPTION 'unsubscribe failed'; END IF;
  IF public.lf_summary_unsubscribe(gen_random_uuid()) THEN RAISE EXCEPTION 'unknown token accepted'; END IF;
  IF (SELECT frequency FROM public.summary_email_preferences WHERE user_id = 'a0000000-0000-4000-8000-00000000000a') <> 'off' THEN RAISE EXCEPTION 'not off'; END IF;
END $$;
RESET ROLE;
SELECT 'summary-email: all checks passed';
ROLLBACK;
