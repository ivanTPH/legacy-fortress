-- Rollback-only local test for 20261103130000_notification_clears.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261103130000_notification_clears.sql
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a'), ('f0000000-0000-4000-8000-00000000000f');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
INSERT INTO public.notification_clears (user_id, item_id) VALUES ('a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001'), ('a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  BEGIN INSERT INTO public.notification_clears (user_id, item_id) VALUES ('f0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-000000000003'); RAISE EXCEPTION 'cleared for someone else';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.notification_clears SET item_id = gen_random_uuid(); RAISE EXCEPTION 'update allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
DELETE FROM public.notification_clears WHERE item_id = 'b0000000-0000-4000-8000-000000000002';
SET LOCAL request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.notification_clears) <> 0 THEN RAISE EXCEPTION 'someone else sees clears'; END IF;
  DELETE FROM public.notification_clears;
END $$;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.notification_clears) <> 1 THEN RAISE EXCEPTION 'expected one clear left'; END IF;
END $$;
RESET ROLE;
SELECT 'notification-clears: all checks passed';
ROLLBACK;
