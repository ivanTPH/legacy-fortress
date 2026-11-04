-- New-device check (owner decision 4 Nov 2026). On a new phone or computer, a password alone isn't enough:
-- the person also enters a 6-digit code emailed to them (Supabase's own email code), or uses an
-- authenticator app or passkey. "Remember this device" skips the code on their own devices.
--
-- Enforced by the database: one restrictive policy per table refuses vault data to an untrusted session,
-- so a stolen password can't be used against the API directly. Controlled by a switch that starts OFF;
-- a later, separately approved change turns it on (and trusts every session open at that moment).
-- No existing policy, grant or access rule changes; this only ever narrows access.

-- 1. The switch (server only).
CREATE TABLE IF NOT EXISTS public.lf_security_switches (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  new_device_check boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
INSERT INTO public.lf_security_switches (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.lf_security_switches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lf_security_switches FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.lf_security_switches TO service_role;

-- 2. Sessions that passed the check, and devices people chose to remember (server only; hashes only).
CREATE TABLE IF NOT EXISTS public.trusted_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('remembered_device', 'existing_session')),
  trusted_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS trusted_sessions_user_idx ON public.trusted_sessions (user_id);
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_used_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL DEFAULT (timezone('utc', now()) + interval '180 days')
);
CREATE INDEX IF NOT EXISTS trusted_devices_user_idx ON public.trusted_devices (user_id);
ALTER TABLE public.trusted_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trusted_sessions, public.trusted_devices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.trusted_sessions, public.trusted_devices TO service_role;

-- 3. Is this session trusted? Staff and two-step users (aal2), people who signed in with an emailed code
--    or link, OAuth, and remembered devices are. A password-only session on a new device isn't.
CREATE OR REPLACE FUNCTION public.lf_session_trusted()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_jwt jsonb := COALESCE(auth.jwt(), '{}'::jsonb); v_session uuid;
BEGIN
  IF NOT COALESCE((SELECT s.new_device_check FROM public.lf_security_switches s WHERE s.id), false) THEN RETURN true; END IF;
  IF COALESCE(v_jwt ->> 'role', '') <> 'authenticated' THEN RETURN true; END IF;
  IF v_jwt ->> 'aal' = 'aal2' THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_jwt -> 'amr', '[]'::jsonb)) e
             WHERE e ->> 'method' IN ('otp', 'magiclink', 'email/signup', 'invite', 'recovery', 'email_change', 'oauth', 'sso/saml', 'totp', 'webauthn', 'passkey')) THEN
    RETURN true;
  END IF;
  BEGIN v_session := (v_jwt ->> 'session_id')::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN v_session IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trusted_sessions t WHERE t.session_id = v_session AND t.user_id = auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.lf_session_trusted() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_session_trusted() TO authenticated, service_role;

-- 4. One restrictive policy on every table that already has row security, plus stored files.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND c.relname NOT IN ('lf_security_switches', 'trusted_sessions', 'trusted_devices')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS lf_trusted_session ON public.%I', r.relname);
    EXECUTE format('CREATE POLICY lf_trusted_session ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.lf_session_trusted())) WITH CHECK ((SELECT public.lf_session_trusted()))', r.relname);
  END LOOP;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS lf_trusted_session ON storage.objects';
    EXECUTE 'CREATE POLICY lf_trusted_session ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.lf_session_trusted())) WITH CHECK ((SELECT public.lf_session_trusted()))';
  END IF;
END $$;
