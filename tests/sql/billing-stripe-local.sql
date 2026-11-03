-- Rollback-only local test for 20261103160000_billing_stripe.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261103160000_billing_stripe.sql
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('b0000000-0000-4000-8000-00000000000b');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
-- A browser can create its own profile, but only as Free, whatever it sends.
INSERT INTO public.billing_profiles (user_id, account_plan, plan_status, record_limit, monthly_charge) VALUES ('a0000000-0000-4000-8000-00000000000a', 'premium', 'active', 9999, 0);
DO $$ BEGIN
  IF (SELECT account_plan || '/' || record_limit FROM public.billing_profiles) <> 'starter/25' THEN RAISE EXCEPTION 'browser created premium'; END IF;
  BEGIN UPDATE public.billing_profiles SET account_plan = 'premium'; RAISE EXCEPTION 'browser upgraded itself';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.billing_profiles SET record_limit = 1000; RAISE EXCEPTION 'browser raised its limit';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.billing_profiles SET payment_method_type = 'card';  -- legacy contact fields still editable
END $$;
-- The 26th record is refused on Free.
DO $$ DECLARE i int; BEGIN
  FOR i IN 1..25 LOOP
    INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'other', 'Record ' || i);
  END LOOP;
  BEGIN
    INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'other', 'Record 26');
    RAISE EXCEPTION 'limit not enforced';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_RECORDS%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;

-- Stripe (through the server) upgrades the account; then the 26th record is allowed.
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE service_role;
UPDATE public.billing_profiles SET account_plan = 'premium', plan_status = 'trialing', stripe_customer_id = 'cus_test_synthetic', billing_interval = 'month', trial_used_at = now() WHERE user_id = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.stripe_webhook_events (id, type) VALUES ('evt_test_synthetic', 'customer.subscription.created');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'other', 'Record 26');
DO $$ BEGIN
  BEGIN PERFORM 1 FROM public.stripe_webhook_events; RAISE EXCEPTION 'browser read webhook events';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM public.billing_profiles; RAISE EXCEPTION 'browser deleted its profile';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Someone else can't see or touch this profile.
SET LOCAL request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.billing_profiles) <> 0 THEN RAISE EXCEPTION 'other user sees profile'; END IF;
END $$;
RESET ROLE;
SELECT 'billing-stripe: all checks passed';
ROLLBACK;
