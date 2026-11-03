-- Rollback-only local test for 20261103170000_free_plan_limits.sql (on top of 20261103160000). Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261103160000_billing_stripe.sql
\i supabase/migrations/20261103170000_free_plan_limits.sql
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.billing_profiles (user_id, record_limit, invitation_limit) VALUES ('a0000000-0000-4000-8000-00000000000a', 500, 50);
DO $$ DECLARE i int; BEGIN
  IF (SELECT record_limit || '/' || invitation_limit FROM public.billing_profiles) <> '6/1' THEN RAISE EXCEPTION 'free limits not 6/1'; END IF;
  -- Two of a type are fine; the third is refused.
  INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'other', 'Other 1'), ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'other', 'Other 2');
  BEGIN
    INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'other', 'Other 3');
    RAISE EXCEPTION 'type limit not enforced';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_RECORDS_TYPE%' THEN RAISE; END IF; END;
  -- Six in total across types; the seventh is refused.
  FOR i IN 1..4 LOOP
    INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'type-' || i, 'Record ' || i);
  END LOOP;
  BEGIN
    INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'type-new', 'Record 7');
    RAISE EXCEPTION 'record limit not enforced';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_RECORDS:%' THEN RAISE; END IF; END;

  INSERT INTO public.contact_invitations (id, owner_user_id, contact_name, contact_email, assigned_role, invitation_status) VALUES ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'Sarah', 'sarah@example.test', 'executor', 'pending');
  BEGIN
    INSERT INTO public.contact_invitations (owner_user_id, contact_name, contact_email, assigned_role, invitation_status) VALUES ('a0000000-0000-4000-8000-00000000000a', 'Tom', 'tom@example.test', 'executor', 'pending');
    RAISE EXCEPTION 'invitation limit not enforced';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_INVITATIONS%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
-- A revoked invitation frees the place.
UPDATE public.contact_invitations SET invitation_status = 'revoked' WHERE id = 'c0000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
INSERT INTO public.contact_invitations (owner_user_id, contact_name, contact_email, assigned_role, invitation_status) VALUES ('a0000000-0000-4000-8000-00000000000a', 'Tom', 'tom@example.test', 'executor', 'pending');
RESET ROLE;
-- Premium (set by the server) has no limits.
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE service_role;
UPDATE public.billing_profiles SET account_plan = 'premium' WHERE user_id = 'a0000000-0000-4000-8000-00000000000a';
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'other', 'Other 3');
INSERT INTO public.contact_invitations (owner_user_id, contact_name, contact_email, assigned_role, invitation_status) VALUES ('a0000000-0000-4000-8000-00000000000a', 'Ann', 'ann@example.test', 'executor', 'pending');
RESET ROLE;
SELECT 'free-plan-limits: all checks passed';
ROLLBACK;
