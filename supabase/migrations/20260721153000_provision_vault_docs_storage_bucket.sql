-- Provision the canonical private vault document bucket.
--
-- Canonical records and legacy section uploads store owner files under:
--   users/{owner_user_id}/...
--
-- Linked/executor reads remain governed by the linked-access helper policies
-- introduced in 20260703153000_linked_access_scope_enforcement.sql. Service-role
-- admin/probate evidence operations continue to use server-side signed access.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-docs',
  'vault-docs',
  false,
  15728640,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'vault_docs_owner_select'
  ) THEN
    CREATE POLICY vault_docs_owner_select ON storage.objects
      FOR SELECT USING (
        bucket_id = 'vault-docs'
        AND split_part(name, '/', 1) = 'users'
        AND split_part(name, '/', 2) = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'vault_docs_owner_insert'
  ) THEN
    CREATE POLICY vault_docs_owner_insert ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'vault-docs'
        AND split_part(name, '/', 1) = 'users'
        AND split_part(name, '/', 2) = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'vault_docs_owner_update'
  ) THEN
    CREATE POLICY vault_docs_owner_update ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'vault-docs'
        AND split_part(name, '/', 1) = 'users'
        AND split_part(name, '/', 2) = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'vault-docs'
        AND split_part(name, '/', 1) = 'users'
        AND split_part(name, '/', 2) = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'vault_docs_owner_delete'
  ) THEN
    CREATE POLICY vault_docs_owner_delete ON storage.objects
      FOR DELETE USING (
        bucket_id = 'vault-docs'
        AND split_part(name, '/', 1) = 'users'
        AND split_part(name, '/', 2) = auth.uid()::text
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'linked_grant_allows_storage_object'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'vault_docs_linked_select'
  ) THEN
    CREATE POLICY vault_docs_linked_select ON storage.objects
      FOR SELECT USING (
        bucket_id = 'vault-docs'
        AND public.linked_grant_allows_storage_object(bucket_id, name)
      );
  END IF;
END$$;
