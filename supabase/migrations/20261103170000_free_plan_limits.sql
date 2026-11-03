-- Free plan limits (owner decision 3 Nov 2026): on Free, 2 records of each type (say, 2 bank accounts), 6 records
-- in total and 1 person, so Free shows how it works and Premium finishes the job. Existing records and invitations are never hidden or removed; only new ones are refused.

-- 1. New and existing Free profiles.
ALTER TABLE public.billing_profiles ALTER COLUMN record_limit SET DEFAULT 6, ALTER COLUMN invitation_limit SET DEFAULT 1;
UPDATE public.billing_profiles SET record_limit = 6, invitation_limit = 1 WHERE account_plan IS DISTINCT FROM 'premium';

-- 2. The plan guard and record limit from 20261103160000, with the new numbers and the per-type limit.
CREATE OR REPLACE FUNCTION public.lf_guard_billing_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- the server (service role) applies Stripe's decisions
  IF TG_OP = 'INSERT' THEN
    NEW.account_plan := 'starter'; NEW.plan_status := 'active'; NEW.plan_source := 'manual'; NEW.trial_ends_at := NULL;
    NEW.record_limit := 6; NEW.invitation_limit := 1; NEW.monthly_charge := 0;
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

CREATE OR REPLACE FUNCTION public.lf_enforce_record_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan text; v_limit integer; v_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> NEW.owner_user_id OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT b.account_plan, b.record_limit INTO v_plan, v_limit FROM public.billing_profiles b WHERE b.user_id = NEW.owner_user_id;
  IF COALESCE(v_plan, 'starter') = 'premium' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.assets a WHERE a.owner_user_id = NEW.owner_user_id AND a.deleted_at IS NULL;
  IF v_count >= COALESCE(v_limit, 6) THEN
    RAISE EXCEPTION 'PLAN_LIMIT_RECORDS: Free plan limit reached (% records)', COALESCE(v_limit, 6) USING ERRCODE = 'P0001';
  END IF;
  -- 2 of each type on Free. Fixed here, not a profile column, so nobody can raise it from the browser.
  SELECT count(*) INTO v_count FROM public.assets a
    WHERE a.owner_user_id = NEW.owner_user_id AND a.deleted_at IS NULL AND a.category_key IS NOT DISTINCT FROM NEW.category_key;
  IF v_count >= 2 THEN
    RAISE EXCEPTION 'PLAN_LIMIT_RECORDS_TYPE: Free plan holds 2 records of each type' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. The free invitation limit, enforced on the server too. Only pending and accepted invitations count.
CREATE OR REPLACE FUNCTION public.lf_enforce_invitation_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_plan text; v_limit integer; v_count integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> NEW.owner_user_id THEN RETURN NEW; END IF;
  SELECT b.account_plan, b.invitation_limit INTO v_plan, v_limit FROM public.billing_profiles b WHERE b.user_id = NEW.owner_user_id;
  IF COALESCE(v_plan, 'starter') = 'premium' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.contact_invitations i
    WHERE i.owner_user_id = NEW.owner_user_id AND i.invitation_status IN ('pending', 'accepted');
  IF v_count >= COALESCE(v_limit, 1) THEN
    RAISE EXCEPTION 'PLAN_LIMIT_INVITATIONS: Free plan limit reached (% people)', COALESCE(v_limit, 1) USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS contact_invitations_enforce_limit ON public.contact_invitations;
CREATE TRIGGER contact_invitations_enforce_limit BEFORE INSERT ON public.contact_invitations
  FOR EACH ROW EXECUTE FUNCTION public.lf_enforce_invitation_limit();
