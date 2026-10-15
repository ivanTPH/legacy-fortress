-- Synthetic fixtures are rolled back. Original UAT requires an explicit local
-- TCP target, the approved 61-migration schema, and a session opt-in.
\set ON_ERROR_STOP on
SELECT COALESCE((
  current_database() LIKE 'lf_phase4_rehearsal%'
  OR (
    current_database() = 'postgres'
    AND current_user = 'postgres'
    AND host(inet_server_addr()) = '127.0.0.1'
    AND inet_server_port() = 5432
    AND current_setting('lf.phase4_local_uat_test', true) = 'approved'
    AND (SELECT count(*) FROM supabase_migrations.schema_migrations) = 61
  )
), false) AS approved_target \gset
\if :approved_target
\else
  \echo Refusing security test outside an approved local Phase 4 database
  SELECT 1/0;
  \quit
\endif

BEGIN;
\o /dev/null
SELECT owner_user_id AS owner_id, id AS wallet_id, organisation_id AS org_id FROM public.wallets LIMIT 1 \gset
SELECT u.id AS linked_id
FROM auth.users u LEFT JOIN public.admin_users au ON au.user_id=u.id
WHERE u.id <> :'owner_id' AND au.user_id IS NULL AND u.email LIKE '%@local.test'
ORDER BY u.id LIMIT 1 \gset
SELECT id AS stranger_id FROM auth.users WHERE id NOT IN (:'owner_id', :'linked_id') ORDER BY id LIMIT 1 \gset
SELECT set_config('lf.test.owner_id', :'owner_id', true);
SELECT set_config('lf.test.linked_id', :'linked_id', true);
SELECT set_config('lf.test.stranger_id', :'stranger_id', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM auth.users WHERE email LIKE '%@local.test') <> 8 THEN
    RAISE EXCEPTION 'synthetic_user_precondition_failed';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'anon_uid_not_null'; END IF;
  BEGIN PERFORM public.lf_identity_assurance_level(current_setting('lf.test.linked_id')::uuid);
    RAISE EXCEPTION 'anon_identity_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_vault_lifecycle_state(current_setting('lf.test.owner_id')::uuid);
    RAISE EXCEPTION 'anon_vault_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_vault_allows_owner_mutation(current_setting('lf.test.owner_id')::uuid);
    RAISE EXCEPTION 'anon_mutation_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_identity_presence_level(current_setting('lf.test.linked_id')::uuid);
    RAISE EXCEPTION 'anon_presence_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS anonymous helper execution denied';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'owner_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.lf_identity_assurance_level(auth.uid()) <> 1
    OR public.lf_vault_lifecycle_state(auth.uid()) <> 'OWNER_ACTIVE'
    OR NOT public.lf_vault_allows_owner_mutation(auth.uid())
    OR public.lf_identity_assurance_level(current_setting('lf.test.linked_id')::uuid) IS NOT NULL
    OR public.lf_identity_presence_level(current_setting('lf.test.linked_id')::uuid) IS NOT NULL
    OR public.lf_vault_lifecycle_state(current_setting('lf.test.linked_id')::uuid) IS NOT NULL
  THEN RAISE EXCEPTION 'owner_or_cross_user_guard_failed'; END IF;
  RAISE NOTICE 'PASS owner state and cross-user denial';
END $$;
INSERT INTO public.assets (organisation_id,wallet_id,owner_user_id,section_key,category_key,title)
VALUES (:'org_id',:'wallet_id',:'owner_id','finances','bank_accounts','clone-only-assigned')
RETURNING id AS asset_id \gset
RESET ROLE;
INSERT INTO public.assets (organisation_id,wallet_id,owner_user_id,section_key,category_key,title)
VALUES (:'org_id',:'wallet_id',:'owner_id','finances','bank_accounts','clone-only-unassigned')
RETURNING id AS other_asset_id \gset
INSERT INTO public.enterprise_organisations (legal_name,organisation_type)
VALUES ('Clone Only Enterprise','employer') RETURNING id AS enterprise_id \gset
INSERT INTO public.account_access_grants (owner_user_id,linked_user_id,assigned_role,activation_status,permissions_override)
VALUES (:'owner_id',:'linked_id','friend_or_family','pending_verification',jsonb_build_object('asset_ids',jsonb_build_array(:'asset_id'::text)))
RETURNING id AS grant_id \gset

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets WHERE owner_user_id=current_setting('lf.test.owner_id')::uuid) <> 0
    OR public.lf_vault_lifecycle_state(current_setting('lf.test.owner_id')::uuid) IS NOT NULL
    OR public.lf_identity_assurance_level(auth.uid()) <> 1
  THEN RAISE EXCEPTION 'pending_linked_access_exposed'; END IF;
  RAISE NOTICE 'PASS pending linked denied';
END $$;
RESET ROLE;
UPDATE public.account_access_grants SET activation_status='active' WHERE id=:'grant_id';
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets WHERE owner_user_id=current_setting('lf.test.owner_id')::uuid) <> 0
    OR public.lf_vault_lifecycle_state(current_setting('lf.test.owner_id')::uuid) IS NOT NULL
  THEN RAISE EXCEPTION 'unverified_linked_access_exposed'; END IF;
  RAISE NOTICE 'PASS unverified linked denied';
END $$;
RESET ROLE;
INSERT INTO public.identity_assurance_states (user_id,identity_level,provider_key,provider_assurance_class)
VALUES (:'linked_id',2,'clone_fixture','level_2_verified')
ON CONFLICT (user_id) DO UPDATE SET identity_level=2;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.lf_identity_assurance_level(auth.uid()) <> 2
    OR public.lf_identity_presence_level(auth.uid()) <> 2
    OR public.lf_vault_lifecycle_state(current_setting('lf.test.owner_id')::uuid) <> 'OWNER_ACTIVE'
    OR public.lf_vault_allows_owner_mutation(current_setting('lf.test.owner_id')::uuid)
    OR (SELECT count(*) FROM public.assets WHERE owner_user_id=current_setting('lf.test.owner_id')::uuid) <> 1
    OR (SELECT count(*) FROM public.admin_users) <> 0
    OR (SELECT count(*) FROM public.enterprise_organisations) <> 0
    OR public.is_active_enterprise_operator()
  THEN RAISE EXCEPTION 'verified_scope_or_admin_isolation_failed'; END IF;
  RAISE NOTICE 'PASS verified assigned-only and admin/enterprise isolation';
END $$;
RESET ROLE;

UPDATE public.identity_assurance_states
SET verified_at=pg_catalog.timezone('utc',pg_catalog.now()),
    presence_reverified_at=pg_catalog.timezone('utc',pg_catalog.now()),
    metadata=jsonb_build_object('presence_expires_at',(pg_catalog.timezone('utc',pg_catalog.now())+interval '10 minutes')::text)
WHERE user_id=:'linked_id';
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.lf_identity_assurance_level(auth.uid()) <> 2
    OR public.lf_identity_presence_level(auth.uid()) <> 3
  THEN RAISE EXCEPTION 'level3_presence_did_not_preserve_level2'; END IF;
  RAISE NOTICE 'PASS Level 3 presence preserves durable Level 2';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'stranger_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets WHERE owner_user_id=current_setting('lf.test.owner_id')::uuid) <> 0
    OR public.lf_identity_assurance_level(current_setting('lf.test.linked_id')::uuid) IS NOT NULL
    OR public.lf_identity_presence_level(current_setting('lf.test.linked_id')::uuid) IS NOT NULL
    OR public.lf_vault_lifecycle_state(current_setting('lf.test.owner_id')::uuid) IS NOT NULL
    OR public.lf_vault_allows_owner_mutation(current_setting('lf.test.owner_id')::uuid)
  THEN RAISE EXCEPTION 'wrong_user_access_exposed'; END IF;
  RAISE NOTICE 'PASS wrong-user disclosure and asset denial';
END $$;
RESET ROLE;

UPDATE public.account_access_grants SET activation_status='revoked' WHERE id=:'grant_id';
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets WHERE owner_user_id=current_setting('lf.test.owner_id')::uuid) <> 0
    OR public.lf_vault_lifecycle_state(current_setting('lf.test.owner_id')::uuid) IS NOT NULL
  THEN RAISE EXCEPTION 'revoked_access_exposed'; END IF;
  RAISE NOTICE 'PASS revoked linked denied';
END $$;
RESET ROLE;

UPDATE public.account_access_grants SET activation_status='active' WHERE id=:'grant_id';
UPDATE public.wallets SET vault_lifecycle_state='PROTECTIVE_LOCK' WHERE id=:'wallet_id';
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'linked_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.assets WHERE owner_user_id=current_setting('lf.test.owner_id')::uuid) <> 0
    OR public.lf_vault_lifecycle_state(current_setting('lf.test.owner_id')::uuid) <> 'PROTECTIVE_LOCK'
  THEN RAISE EXCEPTION 'protective_lock_linked_access_failed'; END IF;
  RAISE NOTICE 'PASS protective lock removes linked asset access';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'owner_id',true);
SET LOCAL ROLE authenticated;
WITH changed AS (UPDATE public.assets SET title='should-not-write' WHERE id=:'asset_id' RETURNING id)
SELECT count(*) AS blocked_owner_updates FROM changed \gset
DO $$ BEGIN
  IF current_setting('lf.test.owner_id')::uuid <> auth.uid()
    OR public.lf_vault_allows_owner_mutation(auth.uid())
    OR (SELECT count(*) FROM public.assets WHERE owner_user_id=auth.uid()) <> 2
  THEN RAISE EXCEPTION 'protective_lock_owner_access_failed'; END IF;
  RAISE NOTICE 'PASS protective lock retains owner read and denies mutation';
END $$;
RESET ROLE;
\if :blocked_owner_updates
  \echo Protective lock allowed an owner update
  SELECT 1/0;
  \quit
\endif

SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE service_role;
DO $$ BEGIN
  IF public.lf_identity_assurance_level(current_setting('lf.test.linked_id')::uuid) <> 2
    OR public.lf_vault_lifecycle_state(current_setting('lf.test.owner_id')::uuid) <> 'PROTECTIVE_LOCK'
  THEN RAISE EXCEPTION 'privileged_service_access_failed'; END IF;
  RAISE NOTICE 'PASS privileged service operations retained';
END $$;
RESET ROLE;
\o
ROLLBACK;
