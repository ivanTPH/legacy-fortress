-- Rollback-only local test for 20261104130000_new_device_check_on.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261104120000_new_device_check.sql
CREATE TABLE IF NOT EXISTS auth.sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL);
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a');
INSERT INTO auth.sessions (id, user_id) VALUES ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-00000000000a');
\i supabase/migrations/20261104130000_new_device_check_on.sql
DO $$ BEGIN
  IF NOT (SELECT new_device_check FROM public.lf_security_switches) THEN RAISE EXCEPTION 'switch not on'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trusted_sessions WHERE session_id = 'c0000000-0000-4000-8000-000000000009' AND method = 'existing_session') THEN RAISE EXCEPTION 'open session not kept'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"a0000000-0000-4000-8000-00000000000a","aal":"aal1","amr":[{"method":"password","timestamp":1}],"session_id":"c0000000-0000-4000-8000-000000000009"}';
DO $$ BEGIN IF NOT (SELECT public.lf_session_trusted()) THEN RAISE EXCEPTION 'open session interrupted'; END IF; END $$;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"a0000000-0000-4000-8000-00000000000a","aal":"aal1","amr":[{"method":"password","timestamp":1}],"session_id":"c0000000-0000-4000-8000-000000000010"}';
DO $$ BEGIN IF (SELECT public.lf_session_trusted()) THEN RAISE EXCEPTION 'new password session trusted'; END IF; END $$;
RESET ROLE;
SELECT 'new-device-check-on: all checks passed';
ROLLBACK;
