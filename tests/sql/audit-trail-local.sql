-- Rollback-only local test for 20261103150000_audit_trail_coverage.sql. Synthetic IDs only.
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
-- Like TEST: history rows using the newest actions already exist.
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('e0000000-0000-4000-8000-00000000000e');
INSERT INTO public.record_history (owner_user_id, record_id, record_type, action, actor_kind) VALUES ('a0000000-0000-4000-8000-00000000000a', gen_random_uuid(), 'asset', 'suggestion_withdrawn', 'person');
\i supabase/migrations/20261103150000_audit_trail_coverage.sql

INSERT INTO public.user_profiles (user_id, display_name) VALUES ('a0000000-0000-4000-8000-00000000000a', 'Olive Owner'), ('e0000000-0000-4000-8000-00000000000e', 'Maya Adviser');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES ('a5000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'Maya Adviser', 'e0000000-0000-4000-8000-00000000000e');
INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES ('e0000000-0000-4000-8000-00000000000e', 2) ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
-- Connection: invite, send, accept (as the system), activate.
INSERT INTO public.contact_invitations (id, owner_user_id, contact_id, contact_name, contact_email, assigned_role, invitation_status)
VALUES ('a4000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000e', 'Maya Adviser', 'maya@example.test', 'professional_advisor', 'pending');
UPDATE public.contact_invitations SET sent_at = now(), last_sent_at = now() WHERE id = 'a4000000-0000-4000-8000-00000000000e';
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Synthetic Bank');
RESET ROLE;
UPDATE public.contact_invitations SET accepted_at = now(), accepted_user_id = 'e0000000-0000-4000-8000-00000000000e', invitation_status = 'accepted' WHERE id = 'a4000000-0000-4000-8000-00000000000e';
INSERT INTO public.account_access_grants (id, owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override) VALUES
  ('a6000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'a5000000-0000-4000-8000-00000000000e', 'professional_advisor', 'accepted', '{}');
UPDATE public.account_access_grants SET activation_status = 'active' WHERE id = 'a6000000-0000-4000-8000-00000000000e';
GRANT SELECT, INSERT, UPDATE ON public.record_links TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.record_links (id, owner_user_id, record_id, record_type, person_id, role, created_by, manual_origin) VALUES ('a7000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'asset', 'a5000000-0000-4000-8000-00000000000e', 'Attorney', 'a0000000-0000-4000-8000-00000000000a', 'people');
UPDATE public.record_links SET removed_at = now() WHERE id = 'a7000000-0000-4000-8000-00000000000a';
INSERT INTO public.record_suggestion_permissions (owner_user_id, grant_id, asset_id) VALUES ('a0000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000e', 'a3000000-0000-4000-8000-000000000001');
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
SELECT public.lf_create_document_suggestion('a3000000-0000-4000-8000-000000000001', 'Secret Statement.pdf', 'application/pdf', 1200, 'a0000000-0000-4000-8000-00000000000a/e0000000-0000-4000-8000-00000000000e/s1/Secret Statement.pdf') AS s1 \gset
SELECT public.lf_comment_on_suggestion(:'s1', 'here');
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
SELECT count(*) FROM public.lf_approve_suggestion(:'s1');
-- A browser can't write or change the audit log.
DO $$ BEGIN
  BEGIN INSERT INTO public.audit_events (category, action, result, resource_type, route) VALUES ('x','x','x','x','x'); RAISE EXCEPTION 'browser wrote audit';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE service_role;
INSERT INTO public.documents (id, organisation_id, wallet_id, asset_id, owner_user_id, storage_path, file_name, mime_type, size_bytes)
VALUES ('a8000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'users/x/Secret Statement.pdf', 'Secret Statement.pdf', 'application/pdf', 1200);
SELECT public.lf_mark_suggestion_applied(:'s1', 'a8000000-0000-4000-8000-000000000001');
SELECT public.lf_mark_suggestion_file_removed(:'s1');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DELETE FROM public.record_suggestion_permissions WHERE grant_id = 'a6000000-0000-4000-8000-00000000000e';
RESET ROLE;

DO $$ DECLARE v_actions text; BEGIN
  SELECT string_agg(DISTINCT action, ',' ORDER BY action) INTO v_actions FROM public.audit_events WHERE category = 'vault_audit';
  IF v_actions <> 'connection.created,connection.invitation_accepted,connection.invitation_created,connection.invitation_sent,connection.invitation_status_changed,connection.status_changed,document.added,person.linked,person.unlinked,suggestion.applied,suggestion.approved,suggestion.commented,suggestion.held_file_removed,suggestion.permission_given,suggestion.permission_removed,suggestion.proposed'
    THEN RAISE EXCEPTION 'audit actions: %', v_actions; END IF;
  -- Actors are recorded: the proposer for proposing, the owner for approving, the System for applying.
  IF (SELECT actor_user_id FROM public.audit_events WHERE action = 'suggestion.proposed') <> 'e0000000-0000-4000-8000-00000000000e' THEN RAISE EXCEPTION 'proposer not recorded'; END IF;
  IF (SELECT actor_user_id FROM public.audit_events WHERE action = 'suggestion.approved') <> 'a0000000-0000-4000-8000-00000000000a' THEN RAISE EXCEPTION 'approver not recorded'; END IF;
  IF (SELECT metadata ->> 'actor' FROM public.audit_events WHERE action = 'suggestion.applied') <> 'system' THEN RAISE EXCEPTION 'apply not by system'; END IF;
  -- No names, file names or titles in the audit log.
  IF EXISTS (SELECT 1 FROM public.audit_events WHERE category = 'vault_audit' AND (metadata::text ~ 'Secret|Synthetic Bank|Maya|maya@' OR coalesce(resource_label, '') <> '')) THEN RAISE EXCEPTION 'audit leaks content'; END IF;
  -- The owner's Record history shows who was allowed to suggest, by name.
  IF NOT EXISTS (SELECT 1 FROM public.record_history WHERE action = 'suggest_allowed' AND subject_label = 'Maya Adviser') OR NOT EXISTS (SELECT 1 FROM public.record_history WHERE action = 'suggest_removed') THEN RAISE EXCEPTION 'history missing suggest changes'; END IF;
  -- Append-only.
  BEGIN UPDATE public.audit_events SET action = 'x' WHERE category = 'vault_audit'; RAISE EXCEPTION 'audit editable'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'audit_events are append-only' THEN RAISE; END IF; END;
END $$;
SELECT 'audit-trail: all checks passed';
ROLLBACK;
