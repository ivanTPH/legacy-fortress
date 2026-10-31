-- Rollback-only local test for 20261031230000_record_history.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
\i supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql
\i supabase/migrations/20261031230000_record_history.sql

INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('e0000000-0000-4000-8000-00000000000e');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES ('a5000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'Sam Share', 'e0000000-0000-4000-8000-00000000000e');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title, metadata_json) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Account', '{"sort_code":"11-22-33"}');
UPDATE public.assets SET title = 'Renamed account', metadata_json = '{"sort_code":"99-88-77","notes":"x"}' WHERE id = 'a3000000-0000-4000-8000-000000000001';
UPDATE public.assets SET updated_at = timezone('utc', now()) WHERE id = 'a3000000-0000-4000-8000-000000000001';
INSERT INTO public.contact_links (owner_user_id, contact_id, source_kind, source_id) VALUES ('a0000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000e', 'asset', 'a3000000-0000-4000-8000-000000000001');
INSERT INTO public.account_access_grants (id, owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override)
  VALUES ('a6000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'a5000000-0000-4000-8000-00000000000e', 'friend_or_family', 'active', '{"asset_ids":["a3000000-0000-4000-8000-000000000001"]}'::jsonb);
SELECT public.lf_stop_vault_access('a6000000-0000-4000-8000-00000000000e', NULL);
UPDATE public.assets SET deleted_at = timezone('utc', now()) WHERE id = 'a3000000-0000-4000-8000-000000000001';

DO $$
DECLARE v_actions text; v_fields text[]; v_ok boolean := false;
BEGIN
  SELECT string_agg(action, ',' ORDER BY at, action) INTO v_actions FROM public.my_record_history('a3000000-0000-4000-8000-000000000001');
  IF v_actions IS DISTINCT FROM 'access_given,access_stopped,created,deleted,person_linked,updated'
     AND (SELECT array_agg(DISTINCT action ORDER BY action) FROM public.my_record_history('a3000000-0000-4000-8000-000000000001'))
         <> ARRAY['access_given','access_stopped','created','deleted','person_linked','updated'] THEN
    RAISE EXCEPTION 'history wrong: %', v_actions;
  END IF;
  SELECT changed_fields INTO v_fields FROM public.my_record_history('a3000000-0000-4000-8000-000000000001') WHERE action = 'updated';
  IF v_fields <> ARRAY['notes','sort_code','title'] THEN RAISE EXCEPTION 'fields wrong: %', v_fields; END IF;
  IF (SELECT count(*) FROM public.my_record_history('a3000000-0000-4000-8000-000000000001') WHERE action = 'updated') <> 1 THEN RAISE EXCEPTION 'timestamp-only update recorded'; END IF;
  -- Values never stored.
  IF EXISTS (SELECT 1 FROM public.record_history h WHERE row_to_json(h)::text ~ '(11-22-33|99-88-77|Renamed)') THEN RAISE EXCEPTION 'values stored in history'; END IF;
  IF (SELECT actor_name FROM public.my_record_history('a3000000-0000-4000-8000-000000000001') WHERE action = 'created') <> 'You' THEN RAISE EXCEPTION 'actor wrong'; END IF;
  IF (SELECT subject_label FROM public.my_record_history('a3000000-0000-4000-8000-000000000001') WHERE action = 'access_given') <> 'Sam Share' THEN RAISE EXCEPTION 'subject wrong'; END IF;
  -- Append-only.
  BEGIN DELETE FROM public.record_history; EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok AND EXISTS (SELECT 1 FROM public.record_history WHERE false) THEN RAISE EXCEPTION 'delete allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.record_history) THEN RAISE EXCEPTION 'history deleted by owner'; END IF;
END $$;

-- Another person can't read it.
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.my_record_history('a3000000-0000-4000-8000-000000000001')) OR EXISTS (SELECT 1 FROM public.record_history) THEN RAISE EXCEPTION 'history leaked'; END IF; END $$;

RESET ROLE;
SELECT 'record history: all checks passed' AS result;
ROLLBACK;
