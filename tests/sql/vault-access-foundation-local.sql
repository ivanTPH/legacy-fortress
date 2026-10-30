-- Rollback-only local test for 20261030200000_vault_access_foundation.sql. Synthetic IDs only.
-- Run: psql -v ON_ERROR_STOP=1 -f supabase/migrations/20261030200000_vault_access_foundation.sql (inside BEGIN)
--      then this file. Owner A, other owner B, nominee N.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql

INSERT INTO auth.users (id) VALUES
  ('a0000000-0000-4000-8000-00000000000a'), ('b0000000-0000-4000-8000-00000000000b'), ('e0000000-0000-4000-8000-00000000000e');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES
  ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org'),
  ('b1000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'B org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES
  ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a'),
  ('b2000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'legal', 'wills', 'Synthetic will asset'),
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'legal', 'wills', 'Other owner will');
INSERT INTO public.contacts (id, owner_user_id, full_name, linked_user_id) VALUES
  ('a5000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'Nina Nominee', 'e0000000-0000-4000-8000-00000000000e'),
  ('b5000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'B contact', NULL);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';

DO $$
DECLARE v_nom uuid; v_sel uuid; v_auth uuid; v_count int;
BEGIN
  -- 13. A whole-Vault nomination is one Vault-level row and creates no record links or grants.
  INSERT INTO public.vault_nominations (owner_user_id, vault_id, person_id, scope)
  VALUES (auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000a', 'whole_vault')
  RETURNING id INTO v_nom;
  IF (SELECT release_condition FROM public.vault_nominations WHERE id = v_nom) <> 'death_release_and_probate' THEN
    RAISE EXCEPTION 'release must wait for probate';
  END IF;
  IF EXISTS (SELECT 1 FROM public.record_links WHERE owner_user_id = auth.uid()) THEN RAISE EXCEPTION 'nomination created record links'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_access_grants WHERE owner_user_id = auth.uid()) THEN RAISE EXCEPTION 'nomination created access'; END IF;

  -- Exceptions only for whole Vault, only from the owner's own Vault.
  INSERT INTO public.vault_nomination_records (nomination_id, owner_user_id, vault_id, record_type, record_id, mode)
  VALUES (v_nom, auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'asset', 'a3000000-0000-4000-8000-000000000001', 'exclude');
  BEGIN
    INSERT INTO public.vault_nomination_records (nomination_id, owner_user_id, vault_id, record_type, record_id, mode)
    VALUES (v_nom, auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'asset', 'b3000000-0000-4000-8000-000000000001', 'exclude');
    RAISE EXCEPTION 'another owner''s record was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%was accepted%' THEN RAISE; END IF;
  END;

  -- One active nomination per person.
  BEGIN
    INSERT INTO public.vault_nominations (owner_user_id, vault_id, person_id, scope)
    VALUES (auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000a', 'whole_vault');
    RAISE EXCEPTION 'duplicate active nomination accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- Cross-owner person refused.
  BEGIN
    INSERT INTO public.vault_nominations (owner_user_id, vault_id, person_id, scope)
    VALUES (auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'b5000000-0000-4000-8000-00000000000b', 'whole_vault');
    RAISE EXCEPTION 'cross-owner person accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%accepted%' THEN RAISE; END IF;
  END;

  -- An owner session can never mark a nomination released.
  BEGIN
    UPDATE public.vault_nominations SET status = 'released' WHERE id = v_nom;
    RAISE EXCEPTION 'owner released a nomination';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%owner released%' THEN RAISE; END IF;
  END;

  -- 21. Cancel is immediate and stamped; a cancelled nomination is closed.
  UPDATE public.vault_nominations SET status = 'cancelled' WHERE id = v_nom;
  IF (SELECT cancelled_by FROM public.vault_nominations WHERE id = v_nom) <> auth.uid() THEN RAISE EXCEPTION 'cancel not stamped'; END IF;
  BEGIN
    UPDATE public.vault_nominations SET status = 'active' WHERE id = v_nom;
    RAISE EXCEPTION 'cancelled nomination reopened';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%reopened%' THEN RAISE; END IF;
  END;

  -- 15. A selected nomination needs at least one record (checked at commit via SET CONSTRAINTS).
  INSERT INTO public.vault_nominations (owner_user_id, vault_id, person_id, scope)
  VALUES (auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000a', 'selected')
  RETURNING id INTO v_sel;
  INSERT INTO public.vault_nomination_records (nomination_id, owner_user_id, vault_id, record_type, record_id, mode)
  VALUES (v_sel, auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'asset', 'a3000000-0000-4000-8000-000000000001', 'include');
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- 16/20. A Power of Attorney starts waiting for a check; the owner can't confirm or activate it.
  INSERT INTO public.legal_authorities (owner_user_id, vault_id, person_id, authority_type, registered, usable_when, scope_areas)
  VALUES (auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000a', 'lpa_property_finance', 'yes', 'with_consent', ARRAY['finances','property'])
  RETURNING id INTO v_auth;
  BEGIN
    UPDATE public.legal_authorities SET status = 'confirmed' WHERE id = v_auth;
    RAISE EXCEPTION 'owner confirmed an authority';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%owner confirmed%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.legal_authorities SET scope_areas = ARRAY['finances','property','legal'] WHERE id = v_auth;
    RAISE EXCEPTION 'scope widened';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%scope widened%' THEN RAISE; END IF;
  END;
  UPDATE public.legal_authorities SET scope_areas = ARRAY['finances'] WHERE id = v_auth;
  -- Health and welfare is always "only if I lack capacity".
  BEGIN
    INSERT INTO public.legal_authorities (owner_user_id, vault_id, person_id, authority_type, registered, usable_when)
    VALUES (auth.uid(), 'a2000000-0000-4000-8000-00000000000a', 'a5000000-0000-4000-8000-00000000000a', 'lpa_health_welfare', 'yes', 'with_consent');
    RAISE EXCEPTION 'health and welfare with consent accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- Withdraw is immediate.
  UPDATE public.legal_authorities SET status = 'withdrawn', withdrawn_reason = 'Synthetic test' WHERE id = v_auth;
  IF (SELECT withdrawn_at FROM public.legal_authorities WHERE id = v_auth) IS NULL THEN RAISE EXCEPTION 'withdraw not stamped'; END IF;

  -- Still no access anywhere.
  IF EXISTS (SELECT 1 FROM public.account_access_grants WHERE owner_user_id = auth.uid()) THEN RAISE EXCEPTION 'access was created'; END IF;
  -- Audit written, no values.
  SELECT count(*) INTO v_count FROM public.audit_events WHERE category = 'vault_access' AND metadata = '{}'::jsonb;
  RAISE NOTICE 'audit events visible to owner: %', v_count;
END $$;

-- One-step save through the RPC (selected needs a record; it is all-or-nothing).
DO $$
DECLARE v uuid;
BEGIN
  UPDATE public.vault_nominations SET status = 'cancelled' WHERE status = 'active';
  BEGIN
    PERFORM public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000a', 'selected', '[]'::jsonb, false);
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'empty selected nomination saved';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%empty selected%' THEN RAISE; END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  v := public.lf_save_vault_nomination('a5000000-0000-4000-8000-00000000000a', 'selected',
    '[{"type":"asset","id":"a3000000-0000-4000-8000-000000000001"}]'::jsonb, true);
  SET CONSTRAINTS ALL IMMEDIATE;
  IF (SELECT count(*) FROM public.vault_nomination_records WHERE nomination_id = v) <> 1 THEN RAISE EXCEPTION 'rpc scope missing'; END IF;
  SET CONSTRAINTS ALL DEFERRED;
END $$;

-- 17. The other owner sees nothing of A's nominations or authorities.
SET LOCAL request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.vault_nominations) OR EXISTS (SELECT 1 FROM public.legal_authorities)
     OR EXISTS (SELECT 1 FROM public.vault_nomination_records) THEN
    RAISE EXCEPTION 'cross-owner read';
  END IF;
END $$;

-- 17. The nominee sees nothing in the tables and, without an accepted invitation, nothing from the status function.
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.vault_nominations) OR EXISTS (SELECT 1 FROM public.vault_nomination_records) THEN
    RAISE EXCEPTION 'nominee read nomination rows';
  END IF;
  IF EXISTS (SELECT 1 FROM public.my_vault_nomination_status()) THEN
    RAISE EXCEPTION 'nominee saw status before accepting the invitation';
  END IF;
END $$;

RESET ROLE;
SELECT 'vault access foundation: all checks passed' AS result;
ROLLBACK;
