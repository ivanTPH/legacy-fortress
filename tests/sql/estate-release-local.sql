-- Rollback-only local test for 20261031190000_estate_release_nominations.sql. Synthetic IDs only.
-- Owner A (deceased in the scenario), nominee N (whole Vault minus one), nominee M (selected, ID not verified),
-- lifetime sharer L (owner grant, paused at death).
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
\i supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql
\i supabase/migrations/20261031170000_nominee_requests_and_release_state.sql
\i supabase/migrations/20261031190000_estate_release_nominations.sql

INSERT INTO auth.users (id) VALUES
  ('a0000000-0000-4000-8000-00000000000a'), ('e0000000-0000-4000-8000-00000000000e'),
  ('d0000000-0000-4000-8000-00000000000d'), ('c0000000-0000-4000-8000-00000000000c'), ('f0000000-0000-4000-8000-00000000000f');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Account one'),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'property', 'property', 'House'),
  ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'digital', 'accounts', 'Private diary');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000a', 'Nina', 'e0000000-0000-4000-8000-00000000000e'),
  ('a5000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-00000000000a', 'Mark', 'd0000000-0000-4000-8000-00000000000d'),
  ('a5000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-00000000000a', 'Lee', 'c0000000-0000-4000-8000-00000000000c');
INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES
  ('e0000000-0000-4000-8000-00000000000e', 2), ('c0000000-0000-4000-8000-00000000000c', 2);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
SELECT public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000e', 'whole_vault', '[{"type":"asset","id":"a3000000-0000-4000-8000-000000000003"}]'::jsonb, true);
SELECT public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000d', 'selected', '[{"type":"asset","id":"a3000000-0000-4000-8000-000000000002"}]'::jsonb, true);
-- Lee: lifetime sharing of the house.
INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override)
  VALUES ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000c', 'a5000000-0000-4000-8000-00000000000c',
          'friend_or_family', 'active', '{"asset_ids":["a3000000-0000-4000-8000-000000000002"]}'::jsonb);
-- An owner can't release.
DO $$ DECLARE v_ok boolean := false; BEGIN
  BEGIN PERFORM public.lf_release_vault_nominations('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', gen_random_uuid()); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'owner released'; END IF;
END $$;

-- Death reported and estate locked; probate case approved but no grant of probate yet.
RESET ROLE;
UPDATE public.wallets SET vault_lifecycle_state = 'ESTATE_LOCKED' WHERE id = 'a2000000-0000-4000-8000-00000000000a';
INSERT INTO public.probate_cases (id, owner_user_id, status, case_type, applicant_status_message, required_evidence, audit_event_ids)
  VALUES ('a8000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'approved', 'probate_access', 'Approved', '[]'::jsonb, '{}');

-- Lifetime sharing paused at death.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.assets) THEN RAISE EXCEPTION 'lifetime sharing survived death'; END IF; END $$;

RESET ROLE;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claim.sub = '';
DO $$ DECLARE v_ok boolean := false; BEGIN
  BEGIN PERFORM public.lf_release_vault_nominations('a0000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-00000000000f', 'a8000000-0000-4000-8000-00000000000a'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'released without the grant of probate'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.probate_case_evidence (case_id, owner_user_id, evidence_type, source, storage_bucket, storage_path, file_name, mime_type, size_bytes)
  VALUES ('a8000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'probate_grant', 'case_upload', 'vault-docs', 'x/y.pdf', 'grant.pdf', 'application/pdf', 10);
SET LOCAL ROLE service_role;
DO $$ DECLARE v record; BEGIN
  SELECT * INTO v FROM public.lf_release_vault_nominations('a0000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-00000000000f', 'a8000000-0000-4000-8000-00000000000a');
  IF v.released <> 1 OR v.waiting_for_id <> 1 THEN RAISE EXCEPTION 'release counts wrong: %', row_to_json(v); END IF;
END $$;

-- Nina sees the whole Vault except the excluded diary, view only.
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets) <> 2 THEN RAISE EXCEPTION 'Nina sees % assets', (SELECT count(*) FROM public.assets); END IF;
  IF EXISTS (SELECT 1 FROM public.assets WHERE id = 'a3000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'exception visible'; END IF;
  IF (SELECT status FROM public.my_vault_nomination_status()) <> 'released' THEN RAISE EXCEPTION 'Nina not shown released'; END IF;
  UPDATE public.assets SET title = 'changed';
  IF FOUND THEN RAISE EXCEPTION 'Nina could change a record'; END IF;
END $$;
-- Mark (ID not verified) sees nothing; Lee still nothing.
SET LOCAL request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000d';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.assets) THEN RAISE EXCEPTION 'unverified nominee sees records'; END IF; END $$;
SET LOCAL request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.assets) THEN RAISE EXCEPTION 'lifetime sharer sees records after release'; END IF; END $$;

-- An owner-made grant can't pose as an estate release.
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ DECLARE v_ok boolean := false; BEGIN
  BEGIN
    INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, assigned_role, activation_status, source, permissions_override)
      VALUES ('a0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-00000000000d', 'trustee', 'active', 'estate_release', '{"asset_ids":["a3000000-0000-4000-8000-000000000001"]}'::jsonb);
  EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'owner made an estate-release grant'; END IF;
END $$;

-- Mark verifies; the review team runs the release again; only Mark's selected record.
RESET ROLE;
INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES ('d0000000-0000-4000-8000-00000000000d', 2);
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claim.sub = '';
DO $$ DECLARE v record; BEGIN
  SELECT * INTO v FROM public.lf_release_vault_nominations('a0000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-00000000000f', 'a8000000-0000-4000-8000-00000000000a');
  IF v.released <> 1 THEN RAISE EXCEPTION 'second release counts wrong: %', row_to_json(v); END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000d';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets) <> 1 OR NOT EXISTS (SELECT 1 FROM public.assets WHERE id = 'a3000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Mark scope wrong'; END IF;
END $$;

RESET ROLE;
SELECT 'estate release: all checks passed' AS result;
ROLLBACK;
