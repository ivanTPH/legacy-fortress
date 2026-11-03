-- Rollback-only local test for 20261103200000_document_limits.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
\i supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql
\i supabase/migrations/20261031170000_nominee_requests_and_release_state.sql
\i supabase/migrations/20261031190000_estate_release_nominations.sql
\i supabase/migrations/20261031210000_person_notifications.sql
\i supabase/migrations/20261031230000_record_history.sql
\i supabase/migrations/20261031240000_death_report_evidence_requests.sql
CREATE TABLE IF NOT EXISTS public.record_links (id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, record_id uuid NOT NULL, record_type text NOT NULL, person_id uuid NOT NULL, role text NOT NULL, removed_at timestamptz);
\i supabase/migrations/20261102120000_record_link_tell_person.sql
\i supabase/migrations/20261103120000_record_suggestions.sql
\i supabase/migrations/20261103160000_billing_stripe.sql
\i supabase/migrations/20261103170000_free_plan_limits.sql
\i supabase/migrations/20261103190000_free_plan_sharing.sql
\i supabase/migrations/20261103180000_fix_authority_record_sync.sql
\i supabase/migrations/20261103200000_document_limits.sql
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.organisations (id, owner_user_id, name) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'A org');
INSERT INTO public.wallets (id, organisation_id, owner_user_id) VALUES ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a');
INSERT INTO public.assets (id, organisation_id, wallet_id, owner_user_id, section_key, category_key, title) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'finances', 'other', 'Synthetic Bank');
INSERT INTO public.records (id, owner_user_id, section_key, category_key, title) VALUES ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'personal', 'wishes', 'Wishes');
INSERT INTO public.billing_profiles (user_id) VALUES ('a0000000-0000-4000-8000-00000000000a');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ DECLARE i int; BEGIN
  -- 8 documents on a record and 2 attachments on a personal record make 10; the 11th of either is refused.
  FOR i IN 1..8 LOOP
    INSERT INTO public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'p/' || i, 'doc' || i || '.pdf', 'application/pdf', 200000);
  END LOOP;
  FOR i IN 1..2 LOOP
    INSERT INTO public.attachments (record_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'a/' || i, 'att' || i || '.pdf', 'application/pdf', 100000);
  END LOOP;
  BEGIN
    INSERT INTO public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'p/11', 'doc11.pdf', 'application/pdf', 1);
    RAISE EXCEPTION 'document limit not enforced';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_DOCUMENTS%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.attachments (record_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'a/3', 'att3.pdf', 'application/pdf', 1);
    RAISE EXCEPTION 'attachment limit not enforced';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_DOCUMENTS%' THEN RAISE; END IF; END;
  -- Removing one frees a place.
  UPDATE public.documents SET deleted_at = now() WHERE storage_path = 'p/1';
  INSERT INTO public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'p/12', 'doc12.pdf', 'application/pdf', 1);
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE service_role;
UPDATE public.billing_profiles SET account_plan = 'premium' WHERE user_id = 'a0000000-0000-4000-8000-00000000000a';
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ DECLARE i int; BEGIN
  -- Premium: 100 included (10 already), the 101st offers a storage pack.
  FOR i IN 1..90 LOOP
    INSERT INTO public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'q/' || i, 'q.pdf', 'application/pdf', 1000);
  END LOOP;
  IF (SELECT used || '/' || included FROM public.lf_my_document_usage()) <> '100/100' THEN RAISE EXCEPTION 'usage wrong: %', (SELECT used || '/' || included FROM public.lf_my_document_usage()); END IF;
  BEGIN
    INSERT INTO public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'q/101', 'q.pdf', 'application/pdf', 1000);
    RAISE EXCEPTION 'premium allowance not enforced';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_DOCUMENT_PACK%' THEN RAISE; END IF; END;
  -- The browser can't give itself a storage pack.
  BEGIN UPDATE public.billing_profiles SET document_packs = 5; RAISE EXCEPTION 'browser added packs';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE service_role;
UPDATE public.billing_profiles SET document_packs = 1 WHERE user_id = 'a0000000-0000-4000-8000-00000000000a';
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
DO $$ BEGIN
  -- With one pack (200 included, 4 GB): more documents fit, but not past the size cap.
  INSERT INTO public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'q/102', 'q.pdf', 'application/pdf', 1000);
  BEGIN
    INSERT INTO public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'q/103', 'big.pdf', 'application/pdf', 5000000000);
    RAISE EXCEPTION 'size cap not enforced';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'PLAN_LIMIT_STORAGE%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
-- The server (approved suggestions) is never refused.
SET LOCAL request.jwt.claim.sub = '';
INSERT INTO public.documents (organisation_id, wallet_id, asset_id, owner_user_id, storage_bucket, storage_path, file_name, mime_type, size_bytes) VALUES ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'vault-docs', 'p/15', 'doc15.pdf', 'application/pdf', 5000000000);
SELECT 'document-limits: all checks passed';
ROLLBACK;
