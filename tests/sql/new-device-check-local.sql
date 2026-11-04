-- Rollback-only local test for 20261104120000_new_device_check.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261104120000_new_device_check.sql
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Synthetic Bank');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'lf_trusted_session' AND polrelid = 'public.assets'::regclass AND NOT polpermissive) THEN RAISE EXCEPTION 'no restrictive policy on assets'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'lf_trusted_session' AND polrelid = 'storage.objects'::regclass) THEN RAISE EXCEPTION 'no policy on stored files'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"a0000000-0000-4000-8000-00000000000a","aal":"aal1","amr":[{"method":"password","timestamp":1}],"session_id":"c0000000-0000-4000-8000-000000000001"}';
-- Switch off: a password session works exactly as today.
DO $$ BEGIN IF (SELECT count(*) FROM public.assets) <> 1 THEN RAISE EXCEPTION 'switch off changed access'; END IF; END $$;
RESET ROLE;
UPDATE public.lf_security_switches SET new_device_check = true;
SET LOCAL ROLE authenticated;
-- Switch on: a password-only session on a new device sees nothing and can't write.
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets) <> 0 THEN RAISE EXCEPTION 'untrusted session saw records'; END IF;
  BEGIN
    INSERT INTO public.assets (organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Sneaky');
    RAISE EXCEPTION 'untrusted session wrote';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT public.lf_session_trusted()) THEN RAISE EXCEPTION 'reported trusted'; END IF;
END $$;
-- Emailed code (otp), two-step (aal2) and OAuth sessions are trusted.
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"a0000000-0000-4000-8000-00000000000a","aal":"aal1","amr":[{"method":"otp","timestamp":2}],"session_id":"c0000000-0000-4000-8000-000000000002"}';
DO $$ BEGIN IF (SELECT count(*) FROM public.assets) <> 1 THEN RAISE EXCEPTION 'emailed code not trusted'; END IF; END $$;
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"a0000000-0000-4000-8000-00000000000a","aal":"aal2","amr":[{"method":"password","timestamp":1},{"method":"totp","timestamp":3}],"session_id":"c0000000-0000-4000-8000-000000000003"}';
DO $$ BEGIN IF (SELECT count(*) FROM public.assets) <> 1 THEN RAISE EXCEPTION 'aal2 not trusted'; END IF; END $$;
-- The browser can't trust its own session.
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"a0000000-0000-4000-8000-00000000000a","aal":"aal1","amr":[{"method":"password","timestamp":1}],"session_id":"c0000000-0000-4000-8000-000000000001"}';
DO $$ BEGIN
  BEGIN INSERT INTO public.trusted_sessions (session_id, user_id, method) VALUES ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'remembered_device'); RAISE EXCEPTION 'browser trusted itself';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.lf_security_switches SET new_device_check = false; RAISE EXCEPTION 'browser turned the switch off';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- A remembered device (recorded by the server) makes the same password session trusted.
INSERT INTO public.trusted_sessions (session_id, user_id, method) VALUES ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'remembered_device');
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.assets) <> 1 THEN RAISE EXCEPTION 'remembered device not trusted'; END IF; END $$;
-- ...but not someone else's session id.
SET LOCAL request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"b0000000-0000-4000-8000-00000000000b","aal":"aal1","amr":[{"method":"password","timestamp":1}],"session_id":"c0000000-0000-4000-8000-000000000001"}';
DO $$ BEGIN IF (SELECT public.lf_session_trusted()) THEN RAISE EXCEPTION 'borrowed session id trusted'; END IF; END $$;
RESET ROLE;
-- The server (service role) is never affected.
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
SET LOCAL ROLE service_role;
DO $$ BEGIN IF (SELECT count(*) FROM public.assets) <> 1 THEN RAISE EXCEPTION 'server affected'; END IF; END $$;
RESET ROLE;
SELECT 'new-device-check: all checks passed';
ROLLBACK;
