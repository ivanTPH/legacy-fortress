-- How each customer account was created, and a Test marker for organisations.
--
-- account_origins: one row per account that was created to join a partner organisation
-- or to accept a customer's invitation. No row means the person signed up directly.
-- The first origin wins and is never overwritten by later events, so a customer who
-- signed up on the website and later accepts an invitation stays "direct".
-- Only the service role (Platform Admin server code) can read or write it.
--
-- enterprise_organisations.is_test: marks synthetic organisations so Admin can tag
-- and hide them and a TEST-only clear-out can find them. Nothing is deleted here.
--
-- Triggers never block the action that fires them: any error is swallowed so an
-- invitation acceptance, enrolment or organisation creation always completes.

-- 1. Test e-mail rule (matches lib/admin/operations.ts isTestAccountEmail).
CREATE OR REPLACE FUNCTION public.lf_is_test_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    split_part(lower(trim(p_email)), '@', 2) ~ '^example\.(test|com|net|org)$'
    OR split_part(lower(trim(p_email)), '@', 2) ~ '\.(test|invalid|localhost)$',
    false
  );
$$;

-- 2. Account origins.
CREATE TABLE IF NOT EXISTS public.account_origins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('partner', 'invited')),
  organisation_id uuid REFERENCES public.enterprise_organisations(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.contact_invitations(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES public.enterprise_memberships(id) ON DELETE SET NULL,
  recorded_by text NOT NULL DEFAULT 'event' CHECK (recorded_by IN ('event', 'backfill')),
  recorded_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS account_origins_source_idx ON public.account_origins (source);
CREATE INDEX IF NOT EXISTS account_origins_organisation_idx ON public.account_origins (organisation_id);

ALTER TABLE public.account_origins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_origins FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_origins TO service_role;

-- Records an origin only when the account was created on or after the moment the
-- invitation or partner link existed (so it was made for this purpose) and no origin
-- is recorded yet.
CREATE OR REPLACE FUNCTION public.lf_record_account_origin(
  p_user_id uuid,
  p_source text,
  p_since timestamptz,
  p_organisation_id uuid DEFAULT NULL,
  p_invitation_id uuid DEFAULT NULL,
  p_membership_id uuid DEFAULT NULL,
  p_recorded_by text DEFAULT 'event'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_since IS NULL THEN
    RETURN;
  END IF;
  SELECT u.created_at INTO v_created FROM auth.users u WHERE u.id = p_user_id;
  IF v_created IS NULL OR v_created < p_since THEN
    RETURN;
  END IF;
  INSERT INTO public.account_origins (user_id, source, organisation_id, invitation_id, membership_id, recorded_by)
  VALUES (p_user_id, p_source, p_organisation_id, p_invitation_id, p_membership_id, p_recorded_by)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.lf_record_account_origin(uuid, text, timestamptz, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Invitation accepted (customer invited someone, they created an account to accept).
CREATE OR REPLACE FUNCTION public.lf_origin_from_access_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  BEGIN
    IF NEW.invitation_id IS NOT NULL THEN
      SELECT coalesce(ci.invited_at, ci.sent_at, ci.created_at) INTO v_since
      FROM public.contact_invitations ci WHERE ci.id = NEW.invitation_id;
      PERFORM public.lf_record_account_origin(NEW.linked_user_id, 'invited', v_since, NULL, NEW.invitation_id, NULL, 'event');
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lf_origin_from_access_grant ON public.account_access_grants;
CREATE TRIGGER lf_origin_from_access_grant
  AFTER INSERT ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.lf_origin_from_access_grant();

-- Partner seat or partner invitation taken up.
CREATE OR REPLACE FUNCTION public.lf_origin_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF NEW.user_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      PERFORM public.lf_record_account_origin(NEW.user_id, 'partner', coalesce(NEW.invited_at, NEW.created_at), NEW.organisation_id, NULL, NEW.id, 'event');
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lf_origin_from_membership ON public.enterprise_memberships;
CREATE TRIGGER lf_origin_from_membership
  AFTER INSERT OR UPDATE OF user_id ON public.enterprise_memberships
  FOR EACH ROW EXECUTE FUNCTION public.lf_origin_from_membership();

-- Partner registration link claimed (account made shortly before claiming).
CREATE OR REPLACE FUNCTION public.lf_origin_from_enrolment_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM public.lf_record_account_origin(NEW.claimed_by_user_id, 'partner', NEW.created_at - interval '1 day', NEW.organisation_id, NULL, NEW.membership_id, 'event');
  EXCEPTION WHEN others THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lf_origin_from_enrolment_claim ON public.enterprise_enrolment_claims;
CREATE TRIGGER lf_origin_from_enrolment_claim
  AFTER INSERT ON public.enterprise_enrolment_claims
  FOR EACH ROW EXECUTE FUNCTION public.lf_origin_from_enrolment_claim();

REVOKE ALL ON FUNCTION public.lf_origin_from_access_grant() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lf_origin_from_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lf_origin_from_enrolment_claim() FROM PUBLIC, anon, authenticated;

-- Backfill existing accounts with the same rules (partner first, then invited).
SELECT public.lf_record_account_origin(m.user_id, 'partner', coalesce(m.invited_at, m.created_at), m.organisation_id, NULL, m.id, 'backfill')
FROM public.enterprise_memberships m
WHERE m.user_id IS NOT NULL
ORDER BY m.created_at;

SELECT public.lf_record_account_origin(c.claimed_by_user_id, 'partner', c.created_at - interval '1 day', c.organisation_id, NULL, c.membership_id, 'backfill')
FROM public.enterprise_enrolment_claims c
WHERE c.claimed_by_user_id IS NOT NULL
ORDER BY c.created_at;

SELECT public.lf_record_account_origin(g.linked_user_id, 'invited', coalesce(ci.invited_at, ci.sent_at, ci.created_at), NULL, g.invitation_id, NULL, 'backfill')
FROM public.account_access_grants g
JOIN public.contact_invitations ci ON ci.id = g.invitation_id
ORDER BY g.created_at;

-- 3. Test marker for organisations.
ALTER TABLE public.enterprise_organisations
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS enterprise_organisations_is_test_idx ON public.enterprise_organisations (is_test);

CREATE OR REPLACE FUNCTION public.lf_mark_test_organisation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    IF NOT NEW.is_test AND (
      public.lf_is_test_email(NEW.primary_contact_email)
      OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.created_by_user_id AND public.lf_is_test_email(u.email))
    ) THEN
      NEW.is_test := true;
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lf_mark_test_organisation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lf_mark_test_organisation ON public.enterprise_organisations;
CREATE TRIGGER lf_mark_test_organisation
  BEFORE INSERT ON public.enterprise_organisations
  FOR EACH ROW EXECUTE FUNCTION public.lf_mark_test_organisation();

-- Backfill: created by a test account, a test contact e-mail, a UAT reference
-- (LF-PHASE…-UAT-…), or carrying a synthetic run marker on its memberships,
-- invitations or registration links.
UPDATE public.enterprise_organisations o
SET is_test = true
WHERE NOT o.is_test AND (
  public.lf_is_test_email(o.primary_contact_email)
  OR o.registration_number ILIKE 'LF-PHASE%-UAT-%'
  OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.created_by_user_id AND public.lf_is_test_email(u.email))
  OR EXISTS (SELECT 1 FROM public.enterprise_memberships m WHERE m.organisation_id = o.id AND m.synthetic_run_marker IS NOT NULL)
  OR EXISTS (SELECT 1 FROM public.enterprise_invitations i WHERE i.organisation_id = o.id AND i.synthetic_run_marker IS NOT NULL)
  OR EXISTS (SELECT 1 FROM public.enterprise_enrolment_links l WHERE l.organisation_id = o.id AND l.synthetic_run_marker IS NOT NULL)
);
