-- Additional regression for the later-migration SECURITY DEFINER grant gap.
-- Synthetic fixtures only; all writes roll back.
\set ON_ERROR_STOP on
SELECT current_database() LIKE 'lf_phase4_rehearsal%' AS disposable_clone \gset
\if :disposable_clone
\else
  \echo Refusing privacy test outside a disposable Phase 4 clone
  SELECT 1/0;
  \quit
\endif

BEGIN;
\o /dev/null
SELECT owner_user_id AS owner_id FROM public.wallets LIMIT 1 \gset
SELECT id AS subject_id FROM auth.users WHERE id<>:'owner_id' AND email LIKE '%@local.test' ORDER BY id LIMIT 1 \gset
SELECT id AS other_id FROM auth.users WHERE id NOT IN (:'owner_id',:'subject_id') ORDER BY id LIMIT 1 \gset
INSERT INTO public.enterprise_organisations (legal_name,organisation_type)
VALUES ('Clone Privacy Enterprise','employer') RETURNING id AS org_id \gset
INSERT INTO public.privacy_consents (user_id,purpose,partner_organisation_id,channel,status,notice_version,notice_reference)
VALUES (:'subject_id','marketing',:'org_id','email','given','clone','clone-only');
INSERT INTO public.retention_items (subject_user_id,classification,resource_type,retention_state)
VALUES (:'subject_id','billing_record','clone_fixture','restricted') RETURNING id AS item_id \gset
INSERT INTO public.recovery_access_requests (owner_user_id,requested_by_user_id,reason)
VALUES (:'subject_id',:'subject_id','clone-only') RETURNING id AS request_id \gset
INSERT INTO public.recovery_approval_events (recovery_access_request_id,approver_user_id,decision,reason)
VALUES (:'request_id',:'other_id','approved','clone-only');
SELECT set_config('lf.test.subject_id',:'subject_id',true),set_config('lf.test.other_id',:'other_id',true),set_config('lf.test.org_id',:'org_id',true);
SELECT set_config('lf.test.item_id',:'item_id',true),set_config('lf.test.request_id',:'request_id',true);

SELECT set_config('request.jwt.claim.role','anon',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.lf_partner_campaign_user_marketing_eligible(current_setting('lf.test.subject_id')::uuid,current_setting('lf.test.org_id')::uuid,'email');
    RAISE EXCEPTION 'anon_marketing_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_retention_item_effective_state(current_setting('lf.test.item_id')::uuid);
    RAISE EXCEPTION 'anon_retention_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_recovery_access_quorum_met(current_setting('lf.test.request_id')::uuid,1);
    RAISE EXCEPTION 'anon_recovery_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lf_privacy_export_is_downloadable(current_setting('lf.test.item_id')::uuid);
    RAISE EXCEPTION 'anon_export_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.is_active_admin_user();
    RAISE EXCEPTION 'anon_admin_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.is_active_enterprise_operator();
    RAISE EXCEPTION 'anon_enterprise_execute_exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS anonymous later-helper execution denied';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'other_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.lf_partner_campaign_user_marketing_eligible(current_setting('lf.test.subject_id')::uuid,current_setting('lf.test.org_id')::uuid,'email')
    OR public.lf_retention_item_effective_state(current_setting('lf.test.item_id')::uuid) IS NOT NULL
    OR public.lf_recovery_access_quorum_met(current_setting('lf.test.request_id')::uuid,1)
  THEN RAISE EXCEPTION 'cross_user_privacy_disclosure'; END IF;
  RAISE NOTICE 'PASS wrong-user consent, retention and recovery hidden';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',:'subject_id',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT public.lf_partner_campaign_user_marketing_eligible(auth.uid(),current_setting('lf.test.org_id')::uuid,'email')
    OR public.lf_retention_item_effective_state(current_setting('lf.test.item_id')::uuid) <> 'restricted'
    OR NOT public.lf_recovery_access_quorum_met(current_setting('lf.test.request_id')::uuid,1)
  THEN RAISE EXCEPTION 'subject_privacy_access_lost'; END IF;
  RAISE NOTICE 'PASS subject-authorised privacy helpers retained';
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE service_role;
DO $$ BEGIN
  IF NOT public.lf_partner_campaign_user_marketing_eligible(current_setting('lf.test.subject_id')::uuid,current_setting('lf.test.org_id')::uuid,'email')
    OR public.lf_retention_item_effective_state(current_setting('lf.test.item_id')::uuid) <> 'restricted'
    OR NOT public.lf_recovery_access_quorum_met(current_setting('lf.test.request_id')::uuid,1)
  THEN RAISE EXCEPTION 'service_privacy_access_lost'; END IF;
  RAISE NOTICE 'PASS privileged privacy operations retained';
END $$;
RESET ROLE;
\o
ROLLBACK;
