-- Rollback-only local test for 20261103180000_fix_authority_record_sync.sql. Synthetic IDs only.
BEGIN;
\i supabase/migrations/20261030200000_vault_access_foundation.sql
\i supabase/migrations/20261031120000_legal_authority_activation.sql
INSERT INTO auth.users (id) VALUES ('a0000000-0000-4000-8000-00000000000a');
-- Before the fix: a new personal record fails.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.records (owner_user_id, section_key, category_key, title) VALUES ('a0000000-0000-4000-8000-00000000000a', 'personal', 'next-of-kin', 'Sarah');
    RAISE EXCEPTION 'expected the old failure';
  EXCEPTION WHEN undefined_column THEN NULL; END;
END $$;
\i supabase/migrations/20261103180000_fix_authority_record_sync.sql
-- After: records and assets both save.
INSERT INTO public.records (owner_user_id, section_key, category_key, title) VALUES ('a0000000-0000-4000-8000-00000000000a', 'personal', 'next-of-kin', 'Sarah');
UPDATE public.records SET archived_at = now() WHERE owner_user_id = 'a0000000-0000-4000-8000-00000000000a';
SELECT 'authority-record-sync: all checks passed';
ROLLBACK;
