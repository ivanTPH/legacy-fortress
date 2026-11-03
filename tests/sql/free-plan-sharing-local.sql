-- Rollback-only local test for 20261103190000_free_plan_sharing.sql. Synthetic IDs only.
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
\i supabase/migrations/20261103160000_billing_stripe.sql
\i supabase/migrations/20261103170000_free_plan_limits.sql
\i supabase/migrations/20261103190000_free_plan_sharing.sql
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('e0000000-0000-4000-8000-00000000000e'), ('b0000000-0000-4000-8000-00000000000b');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Synthetic Bank'),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Other Bank');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'Maya', 'e0000000-0000-4000-8000-00000000000e'),
  ('a5000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-00000000000a', 'Ben', 'b0000000-0000-4000-8000-00000000000b');
INSERT INTO public.billing_profiles (user_id) VALUES ('a0000000-0000-4000-8000-00000000000a');
-- A connection accepted on Free (created by the server or the invitee) starts with nothing shared now.
INSERT INTO public.account_access_grants (id, owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override) VALUES
  ('a6000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'a5000000-0000-4000-8000-00000000000e', 'professional_advisor', 'active', '{"asset_ids": ["a3000000-0000-4000-8000-000000000001"], "allowed_sections": ["finances"]}');
DO $$ BEGIN
  IF (SELECT jsonb_array_length(permissions_override -> 'asset_ids') FROM public.account_access_grants WHERE id = 'a6000000-0000-4000-8000-00000000000e') <> 0 THEN RAISE EXCEPTION 'free connection kept records'; END IF;
  IF (SELECT permissions_override ->> 'allowed_sections' FROM public.account_access_grants WHERE id = 'a6000000-0000-4000-8000-00000000000e') IS NULL THEN RAISE EXCEPTION 'other settings lost'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ BEGIN
  -- Free: sharing a record now is refused; changing other settings is fine.
  BEGIN UPDATE public.account_access_grants SET permissions_override = permissions_override || '{"asset_ids": ["a3000000-0000-4000-8000-000000000001"]}' WHERE id = 'a6000000-0000-4000-8000-00000000000e'; RAISE EXCEPTION 'free shared now';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_SHARING%' THEN RAISE; END IF; END;
  UPDATE public.account_access_grants SET permissions_override = permissions_override || '{"read_only": true}' WHERE id = 'a6000000-0000-4000-8000-00000000000e';
  -- Free: adviser suggestions are refused.
  BEGIN INSERT INTO public.record_suggestion_permissions (owner_user_id, grant_id, asset_id) VALUES ('a0000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000e', 'a3000000-0000-4000-8000-000000000001'); RAISE EXCEPTION 'free suggestions';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_SUGGESTIONS%' THEN RAISE; END IF; END;
END $$;
-- Free: one nominee for later; a second is refused.
SELECT public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000e', 'whole_vault', '[]'::jsonb, false);
DO $$ BEGIN
  BEGIN PERFORM public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000b', 'whole_vault', '[]'::jsonb, false); RAISE EXCEPTION 'second nominee on free';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_NOMINEES%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;

-- Premium (set by the server): all three are allowed.
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE service_role;
UPDATE public.billing_profiles SET account_plan = 'premium' WHERE user_id = 'a0000000-0000-4000-8000-00000000000a';
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
UPDATE public.account_access_grants SET permissions_override = permissions_override || '{"asset_ids": ["a3000000-0000-4000-8000-000000000001", "a3000000-0000-4000-8000-000000000002"]}' WHERE id = 'a6000000-0000-4000-8000-00000000000e';
INSERT INTO public.record_suggestion_permissions (owner_user_id, grant_id, asset_id) VALUES ('a0000000-0000-4000-8000-00000000000a', 'a6000000-0000-4000-8000-00000000000e', 'a3000000-0000-4000-8000-000000000001');
SELECT public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000b', 'whole_vault', '[]'::jsonb, false) IS NOT NULL;
RESET ROLE;

-- Back on Free: what's shared stays, and can be reduced, but not added to.
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE service_role;
UPDATE public.billing_profiles SET account_plan = 'starter' WHERE user_id = 'a0000000-0000-4000-8000-00000000000a';
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
UPDATE public.account_access_grants SET permissions_override = permissions_override || '{"asset_ids": ["a3000000-0000-4000-8000-000000000001"]}' WHERE id = 'a6000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  BEGIN UPDATE public.account_access_grants SET permissions_override = permissions_override || '{"asset_ids": ["a3000000-0000-4000-8000-000000000001", "a3000000-0000-4000-8000-000000000002"]}' WHERE id = 'a6000000-0000-4000-8000-00000000000e'; RAISE EXCEPTION 'free re-added a record';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_SHARING%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
-- Grants from a Power of Attorney or estate release are never limited by plan.
INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, source, permissions_override) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b', 'a5000000-0000-4000-8000-00000000000b', 'executor', 'active', 'estate_release', '{"asset_ids": ["a3000000-0000-4000-8000-000000000002"]}');
DO $$ BEGIN
  IF (SELECT jsonb_array_length(permissions_override -> 'asset_ids') FROM public.account_access_grants WHERE source = 'estate_release') <> 1 THEN RAISE EXCEPTION 'release grant limited'; END IF;
END $$;
SELECT 'free-plan-sharing: all checks passed';
ROLLBACK;
