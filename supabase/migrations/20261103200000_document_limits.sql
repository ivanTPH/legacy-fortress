-- Document limits (owner decisions 3 Nov 2026). A document is one file: a multi-page PDF counts once.
--   Free: 10 documents.
--   Premium: 100 documents, plus 100 more for each storage pack bought through Stripe (£1 a month or
--   £12 a year), with a hidden 2 GB per 100 documents to stop misuse.
-- Only new uploads by the owner are checked. Nothing existing is hidden or removed.

-- 1. Storage packs, set only from verified Stripe events (the plan guard now covers this column too).
ALTER TABLE public.billing_profiles ADD COLUMN IF NOT EXISTS document_packs integer NOT NULL DEFAULT 0 CHECK (document_packs >= 0);
CREATE OR REPLACE FUNCTION public.lf_guard_billing_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- the server (service role) applies Stripe's decisions
  IF TG_OP = 'INSERT' THEN
    NEW.account_plan := 'starter'; NEW.plan_status := 'active'; NEW.plan_source := 'manual'; NEW.trial_ends_at := NULL;
    NEW.record_limit := 6; NEW.invitation_limit := 1; NEW.monthly_charge := 0;
    NEW.stripe_customer_id := NULL; NEW.stripe_subscription_id := NULL; NEW.billing_interval := NULL;
    NEW.current_period_end := NULL; NEW.cancel_at_period_end := false; NEW.trial_used_at := NULL; NEW.document_packs := 0;
    RETURN NEW;
  END IF;
  IF (NEW.user_id, NEW.account_plan, NEW.plan_status, NEW.plan_source, NEW.trial_ends_at, NEW.record_limit, NEW.invitation_limit, NEW.monthly_charge,
      NEW.stripe_customer_id, NEW.stripe_subscription_id, NEW.billing_interval, NEW.current_period_end, NEW.cancel_at_period_end, NEW.trial_used_at, NEW.document_packs)
     IS DISTINCT FROM
     (OLD.user_id, OLD.account_plan, OLD.plan_status, OLD.plan_source, OLD.trial_ends_at, OLD.record_limit, OLD.invitation_limit, OLD.monthly_charge,
      OLD.stripe_customer_id, OLD.stripe_subscription_id, OLD.billing_interval, OLD.current_period_end, OLD.cancel_at_period_end, OLD.trial_used_at, OLD.document_packs) THEN
    RAISE EXCEPTION 'Plans change only through billing' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. The limits.
CREATE OR REPLACE FUNCTION lf_vault_access_private.enforce_document_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count bigint; v_bytes bigint; v_premium boolean; v_allowance bigint;
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.owner_user_id THEN RETURN NEW; END IF;  -- server copies (approved suggestions)
  SELECT
    (SELECT count(*) FROM public.documents d WHERE d.owner_user_id = NEW.owner_user_id AND d.deleted_at IS NULL)
      + (SELECT count(*) FROM public.attachments a WHERE a.owner_user_id = NEW.owner_user_id),
    (SELECT COALESCE(sum(d.size_bytes), 0) FROM public.documents d WHERE d.owner_user_id = NEW.owner_user_id AND d.deleted_at IS NULL)
      + (SELECT COALESCE(sum(a.size_bytes), 0) FROM public.attachments a WHERE a.owner_user_id = NEW.owner_user_id)
  INTO v_count, v_bytes;
  SELECT COALESCE(b.account_plan = 'premium', false), CASE WHEN b.account_plan = 'premium' THEN 100 * (1 + b.document_packs) ELSE 10 END
    INTO v_premium, v_allowance FROM public.billing_profiles b WHERE b.user_id = NEW.owner_user_id;
  v_premium := COALESCE(v_premium, false); v_allowance := COALESCE(v_allowance, 10);
  IF NOT v_premium AND v_count >= v_allowance THEN
    RAISE EXCEPTION 'PLAN_LIMIT_DOCUMENTS: The free plan holds % documents', v_allowance USING ERRCODE = 'P0001';
  END IF;
  IF v_premium AND v_count >= v_allowance THEN
    RAISE EXCEPTION 'PLAN_LIMIT_DOCUMENT_PACK: % documents included', v_allowance USING ERRCODE = 'P0001';
  END IF;
  IF v_premium AND v_bytes + COALESCE(NEW.size_bytes, 0) > (v_allowance / 100) * 2147483648 THEN
    RAISE EXCEPTION 'PLAN_LIMIT_STORAGE: storage fair-use limit reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS documents_enforce_limits ON public.documents;
CREATE TRIGGER documents_enforce_limits BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.enforce_document_limits();
DROP TRIGGER IF EXISTS attachments_enforce_limits ON public.attachments;
CREATE TRIGGER attachments_enforce_limits BEFORE INSERT ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION lf_vault_access_private.enforce_document_limits();

-- 3. How many documents someone has, for the "90 of 100" note. Their own count only.
CREATE OR REPLACE FUNCTION public.lf_my_document_usage()
RETURNS TABLE (used bigint, included bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    (SELECT count(*) FROM public.documents d WHERE d.owner_user_id = auth.uid() AND d.deleted_at IS NULL)
      + (SELECT count(*) FROM public.attachments a WHERE a.owner_user_id = auth.uid()),
    COALESCE((SELECT CASE WHEN b.account_plan = 'premium' THEN 100 * (1 + b.document_packs) ELSE 10 END
      FROM public.billing_profiles b WHERE b.user_id = auth.uid()), 10);
$$;
REVOKE ALL ON FUNCTION public.lf_my_document_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_my_document_usage() TO authenticated;
