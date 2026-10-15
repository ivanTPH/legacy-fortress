-- Disposable-clone-only invitation preview/acceptance regression.
-- The entire synthetic fixture is rolled back; no email is sent.
\set ON_ERROR_STOP on
SELECT current_database() LIKE 'lf_phase4_rehearsal%' AS disposable_clone \gset
\if :disposable_clone
\else
  \echo Refusing invitation test outside a disposable Phase 4 clone
  SELECT 1/0;
  \quit
\endif

BEGIN;
\o /dev/null
SELECT owner_user_id AS owner_id FROM public.wallets LIMIT 1 \gset
SELECT u.id AS linked_id,u.email AS linked_email
FROM auth.users u LEFT JOIN public.admin_users au ON au.user_id=u.id
WHERE u.id<>:'owner_id' AND au.user_id IS NULL AND u.email LIKE '%@local.test'
ORDER BY u.id LIMIT 1 \gset
SELECT id AS wrong_id FROM auth.users WHERE id NOT IN (:'owner_id',:'linked_id') ORDER BY id LIMIT 1 \gset
INSERT INTO public.contact_invitations (owner_user_id,contact_name,contact_email,assigned_role,invitation_status,invite_token_hash,expires_at)
VALUES (:'owner_id','Clone Linked',:'linked_email','executor','pending',encode(extensions.digest('clone-only-token','sha256'),'hex'),pg_catalog.timezone('utc',pg_catalog.now())+interval '1 day')
RETURNING id AS invitation_id \gset
SELECT set_config('lf.test.invitation_id',:'invitation_id',true);
SELECT set_config('lf.test.owner_id',:'owner_id',true);
SELECT set_config('lf.test.linked_id',:'linked_id',true);

SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.get_public_contact_invitation(current_setting('lf.test.invitation_id')::uuid,'clone-only-token')) <> 1
    OR (SELECT count(*) FROM public.get_public_contact_invitation(current_setting('lf.test.invitation_id')::uuid,'wrong-token')) <> 0
  THEN RAISE EXCEPTION 'invitation_preview_token_gate_failed'; END IF;
  BEGIN
    PERFORM public.accept_contact_invitation(current_setting('lf.test.invitation_id')::uuid,'clone-only-token');
    RAISE EXCEPTION 'anonymous_invitation_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Not authenticated' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS token-gated preview and anonymous acceptance denial';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'wrong_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.accept_contact_invitation(current_setting('lf.test.invitation_id')::uuid,'clone-only-token');
    RAISE EXCEPTION 'wrong_account_invitation_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'This invitation is for %' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS wrong-account acceptance denied';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.accept_contact_invitation(current_setting('lf.test.invitation_id')::uuid,'wrong-token');
    RAISE EXCEPTION 'wrong_token_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Invitation link is invalid or has expired' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS wrong token acceptance denied';
END $$;
SELECT grant_id AS accepted_grant_id FROM public.accept_contact_invitation(:'invitation_id','clone-only-token') \gset
RESET ROLE;
SELECT set_config('lf.test.accepted_grant_id',:'accepted_grant_id',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.get_public_contact_invitation(current_setting('lf.test.invitation_id')::uuid,'clone-only-token')) <> 0
    OR (SELECT count(*) FROM public.contact_invitations ci WHERE ci.id=current_setting('lf.test.invitation_id')::uuid AND ci.invitation_status='accepted' AND ci.token_consumed_at IS NOT NULL AND ci.accepted_user_id=current_setting('lf.test.linked_id')::uuid) <> 1
    OR (SELECT count(*) FROM public.account_access_grants g WHERE g.id=current_setting('lf.test.accepted_grant_id')::uuid AND g.linked_user_id=current_setting('lf.test.linked_id')::uuid AND g.activation_status='pending_verification' AND g.required_identity_level=2 AND g.vault_lifecycle_state='OWNER_ACTIVE') <> 1
  THEN RAISE EXCEPTION 'invitation_acceptance_state_failed'; END IF;
  RAISE NOTICE 'PASS accepted invitation consumes token';
END $$;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.has_linked_account_access(current_setting('lf.test.owner_id')::uuid) THEN
    RAISE EXCEPTION 'acceptance_unlocked_protected_access';
  END IF;
  BEGIN
    PERFORM public.accept_contact_invitation(current_setting('lf.test.invitation_id')::uuid,'clone-only-token');
    RAISE EXCEPTION 'single_use_invitation_reaccepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'This invitation has already been used%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS acceptance remains verification-locked and single-use';
END $$;
RESET ROLE;

INSERT INTO public.contact_invitations (owner_user_id,contact_name,contact_email,assigned_role,invitation_status,invite_token_hash,expires_at)
VALUES (:'owner_id','Clone Expired',:'linked_email','accountant','pending',encode(extensions.digest('clone-expired-token','sha256'),'hex'),pg_catalog.timezone('utc',pg_catalog.now())-interval '1 second')
RETURNING id AS expired_id \gset
INSERT INTO public.contact_invitations (owner_user_id,contact_name,contact_email,assigned_role,invitation_status,invite_token_hash,expires_at)
VALUES (:'owner_id','Clone Revoked',:'linked_email','lawyer','revoked',encode(extensions.digest('clone-revoked-token','sha256'),'hex'),pg_catalog.timezone('utc',pg_catalog.now())+interval '1 day')
RETURNING id AS revoked_id \gset
SELECT set_config('lf.test.expired_id',:'expired_id',true),set_config('lf.test.revoked_id',:'revoked_id',true);
SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.get_public_contact_invitation(current_setting('lf.test.expired_id')::uuid,'clone-expired-token')) <> 0
    OR (SELECT count(*) FROM public.get_public_contact_invitation(current_setting('lf.test.revoked_id')::uuid,'clone-revoked-token')) <> 0
  THEN RAISE EXCEPTION 'expired_or_revoked_preview_exposed'; END IF;
  RAISE NOTICE 'PASS expired and revoked preview hidden';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.accept_contact_invitation(current_setting('lf.test.expired_id')::uuid,'clone-expired-token');
    RAISE EXCEPTION 'expired_invitation_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Invitation link is invalid or has expired' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.accept_contact_invitation(current_setting('lf.test.revoked_id')::uuid,'clone-revoked-token');
    RAISE EXCEPTION 'revoked_invitation_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'This invitation has already been used%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS expired and revoked acceptance denied';
END $$;
RESET ROLE;
\o
ROLLBACK;
