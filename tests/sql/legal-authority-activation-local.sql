-- Rollback-only local test for 20261031120000_legal_authority_activation.sql. Synthetic IDs only.
-- Owner A, attorney E (joined, contact of A), other owner B.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql

INSERT INTO auth.users (id) VALUES
  ('a0000000-0000-4000-8000-00000000000a'), ('b0000000-0000-4000-8000-00000000000b'),
  ('e0000000-0000-4000-8000-00000000000e'), ('f0000000-0000-4000-8000-00000000000f');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES
  ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org'),
  ('b1000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'B org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES
  ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a'),
  ('b2000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'legal', 'wills', 'Synthetic will'),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Synthetic bank'),
  ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'property', 'property', 'Synthetic house'),
  ('a3000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'digital', 'accounts', 'Synthetic email'),
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'finances', 'other', 'Other owner bank');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'Ada Attorney', 'e0000000-0000-4000-8000-00000000000e'),
  ('a5000000-0000-4000-8000-00000000000f', 'a0000000-0000-4000-8000-00000000000a', 'Not joined', NULL);

-- Owner records a property and finances authority, then narrows it to finances and property.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$
DECLARE v_auth uuid; v_ok boolean;
BEGIN
  INSERT INTO public.legal_authorities (owner_user_id, vault_id, person_id, authority_type, registered, usable_when, scope_areas)
    VALUES ('a0000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000a',
            'lpa_property_finance', 'yes', 'with_consent', ARRAY['finances','property','business'])
    RETURNING id INTO v_auth;
  PERFORM set_config('lf.test_auth', v_auth::text, true);
  UPDATE public.legal_authorities SET scope_areas = ARRAY['finances','property'] WHERE id = v_auth;

  -- The owner can't confirm, activate, or call activation.
  v_ok := false;
  BEGIN UPDATE public.legal_authorities SET status = 'confirmed' WHERE id = v_auth; EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'owner confirmed an authority'; END IF;
  v_ok := false;
  BEGIN PERFORM public.lf_activate_legal_authority(v_auth, 'a0000000-0000-4000-8000-00000000000a'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'owner activated an authority'; END IF;
  -- Owners can't make an authority grant themselves.
  v_ok := false;
  BEGIN
    INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, assigned_role, activation_status, source, source_id)
      VALUES ('a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'power_of_attorney', 'active', 'legal_authority', v_auth);
  EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'owner created an authority grant'; END IF;
  -- Owners can't read review history they don't own, and can't write it.
  v_ok := false;
  BEGIN
    INSERT INTO public.legal_authority_reviews (authority_id, owner_user_id, action, reviewer_user_id)
      VALUES (v_auth, 'a0000000-0000-4000-8000-00000000000a', 'confirmed', 'a0000000-0000-4000-8000-00000000000a');
  EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'owner wrote review history'; END IF;
END $$;

-- The person already had an owner-made power_of_attorney grant sharing one digital record.
RESET ROLE;
INSERT INTO public.account_access_grants (owner_user_id, linked_user_id, contact_id, assigned_role, activation_status, permissions_override)
  VALUES ('a0000000-0000-4000-8000-00000000000a', 'e0000000-0000-4000-8000-00000000000e', 'a5000000-0000-4000-8000-00000000000a',
          'power_of_attorney', 'verified', '{"asset_ids":["a3000000-0000-4000-8000-000000000004"]}'::jsonb);
-- Review team (server, service role).
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claim.sub = '';
DO $$
DECLARE v_auth uuid := current_setting('lf.test_auth')::uuid; v_ok boolean; v_grant uuid; v_over jsonb;
BEGIN
  -- Not confirmed yet: refused.
  v_ok := false;
  BEGIN PERFORM public.lf_activate_legal_authority(v_auth, 'f0000000-0000-4000-8000-00000000000f'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'activated before confirmation'; END IF;
  UPDATE public.legal_authorities SET status = 'confirmed' WHERE id = v_auth;
  -- ID not verified: refused.
  v_ok := false;
  BEGIN PERFORM public.lf_activate_legal_authority(v_auth, 'f0000000-0000-4000-8000-00000000000f'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'activated without verified ID'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_access_grants WHERE source_id = v_auth) THEN RAISE EXCEPTION 'grant made without ID'; END IF;

  INSERT INTO public.identity_assurance_states (user_id, identity_level) VALUES ('e0000000-0000-4000-8000-00000000000e', 2);
  v_grant := public.lf_activate_legal_authority(v_auth, 'f0000000-0000-4000-8000-00000000000f');
  SELECT permissions_override INTO v_over FROM public.account_access_grants WHERE id = v_grant;
  IF NOT (v_over -> 'asset_ids') ? 'a3000000-0000-4000-8000-000000000002' THEN RAISE EXCEPTION 'finances missing'; END IF;
  IF NOT (v_over -> 'asset_ids') ? 'a3000000-0000-4000-8000-000000000003' THEN RAISE EXCEPTION 'property missing'; END IF;
  IF (v_over -> 'asset_ids') ? 'a3000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'Will included'; END IF;
  -- Digital isn't in the authority's areas; it's here only because the owner had shared it before.
  IF NOT (v_over -> 'asset_ids') ? 'a3000000-0000-4000-8000-000000000004' THEN RAISE EXCEPTION 'owner''s earlier sharing dropped'; END IF;
  IF (v_over -> 'previous_grant' -> 'override' -> 'asset_ids') ? 'a3000000-0000-4000-8000-000000000003' THEN RAISE EXCEPTION 'previous copy polluted'; END IF;
  IF NOT v_over ? 'previous_grant' THEN RAISE EXCEPTION 'previous owner grant not kept'; END IF;
  IF (v_over -> 'asset_ids') ? 'b3000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'other Vault included'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_authorities WHERE id = v_auth AND activated_at IS NOT NULL) THEN RAISE EXCEPTION 'activation not stamped'; END IF;
  -- Twice: refused.
  v_ok := false;
  BEGIN PERFORM public.lf_activate_legal_authority(v_auth, 'f0000000-0000-4000-8000-00000000000f'); EXCEPTION WHEN OTHERS THEN v_ok := true; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'activated twice'; END IF;
END $$;

-- Attorney sees finances and property only, through the existing access functions.
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.assets) <> 3 THEN RAISE EXCEPTION 'attorney sees % assets, expected 3', (SELECT count(*) FROM public.assets); END IF;
  IF EXISTS (SELECT 1 FROM public.assets WHERE section_key = 'legal') THEN RAISE EXCEPTION 'attorney sees a Will'; END IF;
END $$;

-- Owner adds a finance record later: covered. Adds a legal one: not covered. Then withdraws.
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Later savings'),
  ('a3000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'legal', 'wills', 'Later will');
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.assets WHERE id = 'a3000000-0000-4000-8000-000000000005') THEN RAISE EXCEPTION 'later finance record not covered'; END IF;
  IF EXISTS (SELECT 1 FROM public.assets WHERE id = 'a3000000-0000-4000-8000-000000000006') THEN RAISE EXCEPTION 'later Will covered'; END IF;
END $$;

-- Owner narrows to property: finances drop at once. Owner can't revive the grant.
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
UPDATE public.legal_authorities SET scope_areas = ARRAY['property'] WHERE id = current_setting('lf.test_auth')::uuid;
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    UPDATE public.account_access_grants SET permissions_override = permissions_override || '{"asset_ids":["a3000000-0000-4000-8000-000000000001"]}'::jsonb
      WHERE source_id = current_setting('lf.test_auth')::uuid;
    IF FOUND THEN RAISE EXCEPTION 'owner widened authority grant'; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'owner widened authority grant' THEN RAISE; END IF;
    v_ok := true;
  END;
END $$;
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.assets) <> 2 THEN RAISE EXCEPTION 'after narrowing attorney sees %', (SELECT count(*) FROM public.assets); END IF;
END $$;

SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
UPDATE public.legal_authorities SET status = 'withdrawn', withdrawn_reason = 'Synthetic test' WHERE id = current_setting('lf.test_auth')::uuid;
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$
BEGIN
  -- Only what the owner had shared before remains.
  IF EXISTS (SELECT 1 FROM public.assets WHERE id <> 'a3000000-0000-4000-8000-000000000004') THEN RAISE EXCEPTION 'attorney still sees authority records after withdrawal'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assets WHERE id = 'a3000000-0000-4000-8000-000000000004') THEN RAISE EXCEPTION 'owner''s earlier sharing not restored'; END IF;
END $$;

RESET ROLE;
SELECT 'legal authority activation: all checks passed' AS result;
ROLLBACK;
