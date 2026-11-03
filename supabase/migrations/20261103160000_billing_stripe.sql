-- Stripe subscriptions (owner decision 3 Nov 2026: Free and Premium, £3.99 a month or £39 a year, 14-day trial,
-- Stripe sandbox on TEST). Plans change only when Stripe tells the server: a browser session can no longer
-- set its own plan, and the free record limit is enforced by the database, not just the app.

-- 1. Subscription details on the existing billing profile.
ALTER TABLE public.billing_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_interval text CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year')),
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS billing_profiles_stripe_customer_uidx ON public.billing_profiles (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- 2. A browser session may create its own Free profile and edit its legacy contact fields, nothing about the plan.
CREATE OR REPLACE FUNCTION public.lf_guard_billing_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- the server (service role) applies Stripe's decisions
  IF TG_OP = 'INSERT' THEN
    NEW.account_plan := 'starter'; NEW.plan_status := 'active'; NEW.plan_source := 'manual'; NEW.trial_ends_at := NULL;
    NEW.record_limit := 25; NEW.invitation_limit := 5; NEW.monthly_charge := 0;
    NEW.stripe_customer_id := NULL; NEW.stripe_subscription_id := NULL; NEW.billing_interval := NULL;
    NEW.current_period_end := NULL; NEW.cancel_at_period_end := false; NEW.trial_used_at := NULL;
    RETURN NEW;
  END IF;
  IF (NEW.user_id, NEW.account_plan, NEW.plan_status, NEW.plan_source, NEW.trial_ends_at, NEW.record_limit, NEW.invitation_limit, NEW.monthly_charge,
      NEW.stripe_customer_id, NEW.stripe_subscription_id, NEW.billing_interval, NEW.current_period_end, NEW.cancel_at_period_end, NEW.trial_used_at)
     IS DISTINCT FROM
     (OLD.user_id, OLD.account_plan, OLD.plan_status, OLD.plan_source, OLD.trial_ends_at, OLD.record_limit, OLD.invitation_limit, OLD.monthly_charge,
      OLD.stripe_customer_id, OLD.stripe_subscription_id, OLD.billing_interval, OLD.current_period_end, OLD.cancel_at_period_end, OLD.trial_used_at) THEN
    RAISE EXCEPTION 'Plans change only through billing' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS billing_profiles_guard_plan ON public.billing_profiles;
CREATE TRIGGER billing_profiles_guard_plan BEFORE INSERT OR UPDATE ON public.billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lf_guard_billing_plan();
REVOKE DELETE ON public.billing_profiles FROM authenticated;

-- 3. The free record limit, enforced when an owner adds a record. Nothing existing is touched or hidden.
CREATE OR REPLACE FUNCTION public.lf_enforce_record_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan text; v_limit integer; v_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> NEW.owner_user_id OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT b.account_plan, b.record_limit INTO v_plan, v_limit FROM public.billing_profiles b WHERE b.user_id = NEW.owner_user_id;
  IF COALESCE(v_plan, 'starter') = 'premium' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.assets a WHERE a.owner_user_id = NEW.owner_user_id AND a.deleted_at IS NULL;
  IF v_count >= COALESCE(v_limit, 25) THEN
    RAISE EXCEPTION 'PLAN_LIMIT_RECORDS: Free plan limit reached (% records)', COALESCE(v_limit, 25) USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS assets_enforce_record_limit ON public.assets;
CREATE TRIGGER assets_enforce_record_limit BEFORE INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.lf_enforce_record_limit();

-- 4. Stripe events already applied, so a repeated delivery changes nothing. Server only.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;
