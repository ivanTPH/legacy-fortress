ALTER TABLE public.billing_profiles
  ADD COLUMN IF NOT EXISTS account_plan text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS record_limit integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS invitation_limit integer NOT NULL DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'billing_profiles' AND c.conname = 'billing_profiles_account_plan_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.billing_profiles
      ADD CONSTRAINT billing_profiles_account_plan_check
      CHECK (account_plan IN ('starter', 'premium'))
      NOT VALID
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'billing_profiles' AND c.conname = 'billing_profiles_plan_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.billing_profiles
      ADD CONSTRAINT billing_profiles_plan_status_check
      CHECK (plan_status IN ('active', 'trialing', 'past_due', 'canceled'))
      NOT VALID
    $sql$;
  END IF;
END$$;

UPDATE public.billing_profiles
SET
  account_plan = COALESCE(account_plan, 'starter'),
  plan_status = COALESCE(plan_status, 'active'),
  plan_source = COALESCE(NULLIF(trim(plan_source), ''), 'manual'),
  record_limit = COALESCE(record_limit, 25),
  invitation_limit = COALESCE(invitation_limit, 5)
WHERE true;
