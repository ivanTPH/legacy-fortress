-- Rollback-only local test for 20261031150000_vault_access_history_and_end_dates.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
\i supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql

INSERT INTO auth.users (id) VALUES
  ('a0000000-0000-4000-8000-00000000000a'), ('b0000000-0000-4000-8000-00000000000b'), ('e0000000-0000-4000-8000-00000000000e');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Synthetic account');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'Sam Share', 'e0000000-0000-4000-8000-00000000000e');
INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES ('e0000000-0000-4000-8000-00000000000e', 2);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
-- Owner shares one record now, until a future date.
INSERT INTO public.account_access_grants (id, owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override, ends_at)
  VALUES ('a6000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'a5000000-0000-4000-8000-00000000000a',
          'friend_or_family', 'active', '{"asset_ids":["a3000000-0000-4000-8000-000000000002"]}'::jsonb, timezone('utc', now()) + interval '2 days');
DO $$
DECLARE v_ok boolean := false;
BEGIN
  -- Past end dates are refused.
  BEGIN UPDATE public.account_access_grants SET ends_at = timezone('utc', now()) - interval '1 day' WHERE id = 'a6000000-0000-4000-8000-00000000000a';
  EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'past end date accepted'; END IF;
END $$;

SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets) <> 1 THEN RAISE EXCEPTION 'shared record not visible before end date'; END IF;
END $$;

-- Time passes: simulate the end date arriving (as the database owner, bypassing the future-date check).
RESET ROLE;
ALTER TABLE public.account_access_grants DISABLE TRIGGER account_access_grants_validate_end;
UPDATE public.account_access_grants SET ends_at = timezone('utc', now()) - interval '1 minute' WHERE id = 'a6000000-0000-4000-8000-00000000000a';
ALTER TABLE public.account_access_grants ENABLE TRIGGER account_access_grants_validate_end;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.assets) THEN RAISE EXCEPTION 'record still visible after end date'; END IF;
END $$;

-- Owner gives access again with no end date, then stops it with a note.
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
RESET ROLE;
UPDATE public.account_access_grants SET ends_at = NULL WHERE id = 'a6000000-0000-4000-8000-00000000000a';
SET LOCAL ROLE authenticated;
SELECT public.lf_stop_vault_access('a6000000-0000-4000-8000-00000000000a', 'Changed adviser');
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.assets) THEN RAISE EXCEPTION 'record visible after stop'; END IF;
  -- The person can't read the owner's history.
  IF EXISTS (SELECT 1 FROM public.my_vault_access_history('a5000000-0000-4000-8000-00000000000a')) THEN RAISE EXCEPTION 'history leaked to the person'; END IF;
END $$;

SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$
DECLARE v_stopped record;
BEGIN
  SELECT * INTO v_stopped FROM public.my_vault_access_history('a5000000-0000-4000-8000-00000000000a') WHERE action = 'access.stopped' LIMIT 1;
  IF v_stopped IS NULL THEN RAISE EXCEPTION 'stop not in history'; END IF;
  IF v_stopped.note IS DISTINCT FROM 'Changed adviser' OR v_stopped.record_count <> 1 OR NOT v_stopped.by_owner THEN RAISE EXCEPTION 'stop history wrong: %', row_to_json(v_stopped); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.my_vault_access_history('a5000000-0000-4000-8000-00000000000a') WHERE action = 'access.given') THEN RAISE EXCEPTION 'give not in history'; END IF;
  -- Another owner's person: nothing.
  PERFORM set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-00000000000b', true);
  IF EXISTS (SELECT 1 FROM public.my_vault_access_history('a5000000-0000-4000-8000-00000000000a')) THEN RAISE EXCEPTION 'history leaked across Vaults'; END IF;
END $$;

RESET ROLE;
SELECT 'vault access history and end dates: all checks passed' AS result;
ROLLBACK;
