\set ON_ERROR_STOP on
BEGIN;
\ir ../../supabase/migrations/20261020082900_recipient_access_notifications.sql

SELECT gen_random_uuid() AS owner_id, gen_random_uuid() AS recipient_id,
       gen_random_uuid() AS stranger_id, gen_random_uuid() AS asset_id \gset
INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at)
VALUES (:'owner_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'notification-owner@local.test', now()),
       (:'recipient_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'notification-recipient@local.test', now()),
       (:'stranger_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'notification-stranger@local.test', now());

INSERT INTO public.contact_invitations
  (owner_user_id, contact_name, contact_email, assigned_role, invitation_status,
   accepted_user_id, accepted_at)
VALUES (:'owner_id', 'Synthetic Recipient', 'notification-recipient@local.test',
        'friend_or_family', 'accepted', :'recipient_id', now())
RETURNING id AS invitation_id \gset

INSERT INTO public.account_access_grants
  (owner_user_id, linked_user_id, invitation_id, assigned_role, activation_status,
   permissions_override)
VALUES (:'owner_id', :'recipient_id', :'invitation_id', 'friend_or_family', 'active',
        '{"read_only":true,"asset_ids":[],"record_ids":[],"allowed_sections":[]}')
RETURNING id AS grant_id \gset

SELECT set_config('lf_test.invitation_id', :'invitation_id', true),
       set_config('lf_test.grant_id', :'grant_id', true),
       set_config('lf_test.recipient_id', :'recipient_id', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
UPDATE public.account_access_grants
SET permissions_override = jsonb_build_object('read_only', true, 'asset_ids', jsonb_build_array(:'asset_id'),
  'record_ids', '[]'::jsonb, 'allowed_sections', jsonb_build_array('financial'))
WHERE id = :'grant_id' AND owner_user_id = :'owner_id';
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.invitation_events
      WHERE invitation_id = current_setting('lf_test.invitation_id')::uuid
        AND event_type = 'recipient_record_access_updated') <> 1 THEN
    RAISE EXCEPTION 'Grant must create exactly one recipient event';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.invitation_events
             WHERE invitation_id = current_setting('lf_test.invitation_id')::uuid
               AND event_type = 'recipient_record_access_updated') THEN
    RAISE EXCEPTION 'Owner saw recipient-only notification';
  END IF;
END $$;
RESET ROLE;

-- Repeating an identical save, including an order-only change, creates no event.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
UPDATE public.account_access_grants SET permissions_override = permissions_override
WHERE id = :'grant_id' AND owner_user_id = :'owner_id';
RESET ROLE;

-- Wrong user cannot update the owner's grant or read the recipient's event.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'stranger_id', true);
UPDATE public.account_access_grants
SET permissions_override = '{"asset_ids":[]}'::jsonb
WHERE id = :'grant_id';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.invitation_events
             WHERE invitation_id = current_setting('lf_test.invitation_id')::uuid) THEN
    RAISE EXCEPTION 'Wrong user saw recipient notification';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.invitation_events
             WHERE invitation_id = current_setting('lf_test.invitation_id')::uuid) THEN
    RAISE EXCEPTION 'Anonymous user saw recipient notification';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'recipient_id', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.invitation_events
      WHERE invitation_id = current_setting('lf_test.invitation_id')::uuid
        AND owner_user_id = auth.uid()) <> 1 THEN
    RAISE EXCEPTION 'Recipient cannot read their notification';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
UPDATE public.account_access_grants
SET permissions_override = '{"read_only":true,"asset_ids":[],"record_ids":[],"allowed_sections":[]}'::jsonb
WHERE id = :'grant_id' AND owner_user_id = :'owner_id';
RESET ROLE;

-- A failed/rolled-back access change leaves neither a grant nor notification.
SAVEPOINT failed_save;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
UPDATE public.account_access_grants
SET permissions_override = jsonb_build_object('asset_ids', jsonb_build_array(:'asset_id'))
WHERE id = :'grant_id' AND owner_user_id = :'owner_id';
ROLLBACK TO SAVEPOINT failed_save;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.invitation_events
      WHERE invitation_id = current_setting('lf_test.invitation_id')::uuid
        AND event_type LIKE 'recipient_record_access_%') <> 2 THEN
    RAISE EXCEPTION 'Expected one grant and one revoke event, no retry/failed event';
  END IF;
  IF (SELECT count(*) FROM public.invitation_events
      WHERE invitation_id = current_setting('lf_test.invitation_id')::uuid
        AND event_type = 'recipient_record_access_revoked') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one revoke event';
  END IF;
  IF (SELECT count(*) FROM public.audit_events
      WHERE action = 'recipient_notification_created'
        AND resource_id = current_setting('lf_test.grant_id')) <> 2 THEN
    RAISE EXCEPTION 'Notification audit count is incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM public.invitation_events
      WHERE invitation_id = current_setting('lf_test.invitation_id')::uuid
        AND event_type LIKE 'recipient_record_access_%'
        AND (owner_user_id <> current_setting('lf_test.recipient_id')::uuid
          OR payload - 'source' - 'grant_id' - 'in_app_status' - 'email_status' <> '{}'::jsonb
          OR payload ->> 'email_status' <> 'not_configured')) THEN
    RAISE EXCEPTION 'Recipient or privacy-safe delivery state is incorrect';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_access_grants
      WHERE id = current_setting('lf_test.grant_id')::uuid
        AND permissions_override -> 'asset_ids' <> '[]'::jsonb) THEN
    RAISE EXCEPTION 'Revocation did not persist';
  END IF;
END $$;

ROLLBACK;
\echo 'PASS: grant, recipient isolation, idempotency, revoke, rollback, and audit'
