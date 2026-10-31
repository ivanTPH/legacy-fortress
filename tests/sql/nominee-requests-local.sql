-- Rollback-only local test for 20261031170000_nominee_requests_and_release_state.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
\i supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql
\i supabase/migrations/20261031170000_nominee_requests_and_release_state.sql

INSERT INTO auth.users (id) VALUES
  ('a0000000-0000-4000-8000-00000000000a'), ('e0000000-0000-4000-8000-00000000000e'), ('f0000000-0000-4000-8000-00000000000f');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Synthetic account');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'Nina Nominee', 'e0000000-0000-4000-8000-00000000000e'),
  ('a5000000-0000-4000-8000-00000000000f', 'a0000000-0000-4000-8000-00000000000a', 'Other contact', 'f0000000-0000-4000-8000-00000000000f');
INSERT INTO public.contact_invitations (id, owner_user_id, contact_id, invitation_status, accepted_user_id, contact_email, assigned_role, contact_name)
  VALUES ('a7000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000a', 'accepted', 'e0000000-0000-4000-8000-00000000000e', 'nina@example.test', 'friend_or_family', 'Nina Nominee');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
SELECT set_config('lf.test_nom', public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000a', 'whole_vault', '[]'::jsonb, true)::text, true);

-- Nominee sees name, kind, state, release stage; can ask once; asking shares nothing.
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$
DECLARE v record; v_ok boolean := false;
BEGIN
  SELECT * INTO v FROM public.my_vault_nomination_status();
  IF v IS NULL OR v.release_stage <> 'none' OR v.open_request THEN RAISE EXCEPTION 'status wrong: %', row_to_json(v); END IF;
  PERFORM public.lf_request_early_access(v.nomination_ref, 'Need the insurance details');
  IF NOT (SELECT open_request FROM public.my_vault_nomination_status()) THEN RAISE EXCEPTION 'open request not shown'; END IF;
  BEGIN PERFORM public.lf_request_early_access(v.nomination_ref, 'again'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'second open request allowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.assets) THEN RAISE EXCEPTION 'asking shared something'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_access_grants) THEN RAISE EXCEPTION 'asking created a grant'; END IF;
  -- The nominee can't answer their own request.
  UPDATE public.vault_early_access_requests SET status = 'shared';
  IF FOUND THEN RAISE EXCEPTION 'nominee answered own request'; END IF;
END $$;

-- Someone else can't ask with the reference.
SET LOCAL request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN PERFORM public.lf_request_early_access(current_setting('lf.test_nom')::uuid, 'x'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'stranger could ask'; END IF;
  IF EXISTS (SELECT 1 FROM public.my_vault_nomination_status()) THEN RAISE EXCEPTION 'stranger sees nomination'; END IF;
  IF EXISTS (SELECT 1 FROM public.vault_early_access_requests) THEN RAISE EXCEPTION 'stranger sees request'; END IF;
END $$;

-- Owner sees it, declines it; can't edit the message; history records both.
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$
DECLARE v_ok boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.vault_early_access_requests WHERE status = 'open') <> 1 THEN RAISE EXCEPTION 'owner cannot see request'; END IF;
  BEGIN UPDATE public.vault_early_access_requests SET message = 'changed'; EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'owner changed message'; END IF;
  UPDATE public.vault_early_access_requests SET status = 'declined';
  IF (SELECT decided_at FROM public.vault_early_access_requests) IS NULL THEN RAISE EXCEPTION 'decision not stamped'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.my_vault_access_history('a5000000-0000-4000-8000-00000000000a') WHERE action = 'early_access.requested' AND NOT by_owner) THEN RAISE EXCEPTION 'request not in history'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.my_vault_access_history('a5000000-0000-4000-8000-00000000000a') WHERE action = 'early_access.declined' AND by_owner) THEN RAISE EXCEPTION 'decline not in history'; END IF;
END $$;

-- Ask again, then the owner shares a record: the request closes as shared.
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
SELECT public.lf_request_early_access(current_setting('lf.test_nom')::uuid, 'Second ask');
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override)
  VALUES ('a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'a5000000-0000-4000-8000-00000000000a',
          'friend_or_family', 'active', '{"asset_ids":["a3000000-0000-4000-8000-000000000002"]}'::jsonb);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.vault_early_access_requests WHERE status = 'open') THEN RAISE EXCEPTION 'request not closed by sharing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vault_early_access_requests WHERE status = 'shared') THEN RAISE EXCEPTION 'request not marked shared'; END IF;
END $$;
RESET ROLE;
DELETE FROM public.account_access_grants;
SET LOCAL ROLE authenticated;

-- A reported death shows as release in progress; nothing opens.
RESET ROLE;
UPDATE public.wallets SET vault_lifecycle_state = 'DEATH_REPORTED' WHERE id = 'a2000000-0000-4000-8000-00000000000a';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF (SELECT release_stage FROM public.my_vault_nomination_status()) <> 'in_progress' THEN RAISE EXCEPTION 'release stage not shown'; END IF;
  IF EXISTS (SELECT 1 FROM public.assets) THEN RAISE EXCEPTION 'death report opened records'; END IF;
END $$;

RESET ROLE;
SELECT 'nominee requests and release state: all checks passed' AS result;
ROLLBACK;
