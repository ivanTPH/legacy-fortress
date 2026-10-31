-- Rollback-only local test for 20261031210000_person_notifications.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
\i supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql
\i supabase/migrations/20261031170000_nominee_requests_and_release_state.sql
\i supabase/migrations/20261031190000_estate_release_nominations.sql
\i supabase/migrations/20261031210000_person_notifications.sql

INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('e0000000-0000-4000-8000-00000000000e'), ('f0000000-0000-4000-8000-00000000000f');
INSERT INTO public.user_profiles (user_id, display_name) VALUES ('a0000000-0000-4000-8000-00000000000a', 'Olive Owner');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Secret account title');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'Nina', 'e0000000-0000-4000-8000-00000000000e');
INSERT INTO public.contact_invitations (id, owner_user_id, contact_id, invitation_status, accepted_user_id, contact_email, assigned_role, contact_name)
  VALUES ('a7000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000e', 'accepted', 'e0000000-0000-4000-8000-00000000000e', 'n@example.test', 'friend_or_family', 'Nina');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
-- Not told: no notification. Then told: one.
SELECT set_config('lf.nom', public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000e', 'whole_vault', '[]'::jsonb, false)::text, true);
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.user_notifications) THEN RAISE EXCEPTION 'told without consent'; END IF; END $$;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
UPDATE public.vault_nominations SET notify_person = true WHERE id = current_setting('lf.nom')::uuid;
-- Share a record, then stop.
INSERT INTO public.account_access_grants (id, owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override)
  VALUES ('a6000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'a5000000-0000-4000-8000-00000000000e', 'friend_or_family', 'active', '{"asset_ids":["a3000000-0000-4000-8000-000000000001"]}'::jsonb);
SELECT public.lf_stop_vault_access('a6000000-0000-4000-8000-00000000000e', 'note');
UPDATE public.vault_nominations SET status = 'cancelled' WHERE id = current_setting('lf.nom')::uuid;

SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$
DECLARE v_kinds text;
BEGIN
  SELECT string_agg(kind, ',' ORDER BY created_at, kind) INTO v_kinds FROM public.user_notifications;
  IF (SELECT count(*) FROM public.user_notifications) <> 4
     OR (SELECT array_agg(DISTINCT kind ORDER BY kind) FROM public.user_notifications) <> ARRAY['access_given','access_stopped','nomination_added','nomination_ended']
  THEN RAISE EXCEPTION 'unexpected notifications: %', v_kinds; END IF;
  IF EXISTS (SELECT 1 FROM public.user_notifications WHERE owner_display_name <> 'Olive Owner') THEN RAISE EXCEPTION 'owner name wrong'; END IF;
  -- Content-free: no record titles anywhere.
  IF EXISTS (SELECT 1 FROM public.user_notifications n WHERE row_to_json(n)::text ILIKE '%Secret account%') THEN RAISE EXCEPTION 'record title leaked'; END IF;
  -- Can mark read, can't rewrite, can't create.
  UPDATE public.user_notifications SET read_at = timezone('utc', now());
  BEGIN UPDATE public.user_notifications SET kind = 'release_approved'; RAISE EXCEPTION 'rewrite allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'rewrite allowed' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.user_notifications (recipient_user_id, kind) VALUES ('e0000000-0000-4000-8000-00000000000e', 'release_approved'); RAISE EXCEPTION 'insert allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'insert allowed' THEN RAISE; END IF; END;
END $$;
-- Others see none of it.
SET LOCAL request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.user_notifications) THEN RAISE EXCEPTION 'notifications leaked'; END IF; END $$;

RESET ROLE;
SELECT 'person notifications: all checks passed' AS result;
ROLLBACK;
