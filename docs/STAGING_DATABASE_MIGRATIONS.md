# Coolify TEST database migration procedure

This procedure applies only to the Coolify TEST application at `https://test.mylegacyfortress.com` and its separately verified Supabase PostgreSQL service. It does not authorize a migration. Never use the Supabase Cloud connector, production credentials, or the protected application release workflow to apply SQL: that workflow deploys the app only.

## Evidence currently held (27 October 2026)

| Item | Evidence | State |
| --- | --- | --- |
| TEST application | Owner confirms Coolify v4.5.0, project `My first project`, environment `staging_legacy_fortress`, application `Legacy Fortress Staging`, UUID `yka9huzmm56hjpz1gno448fb`. | Owner-reported; API verification pending. |
| Supabase API | `docs/STAGING_ENVIRONMENT_SETUP.md` names `supabase-test.mylegacyfortress.com`. | API origin only; does not identify PostgreSQL. |
| TEST Supabase | Owner confirms service `Legacy Fortress Staging Supabase`; volume identifier `wdf2fyo7hrewev6hnqypd2vc`; data/config mounts at `/var/lib/postgresql/data` and `/etc/postgresql-custom`. Historical script names `supabase-db-wdf2fyo7hrewev6hnqypd2vc`, database `postgres`. | Owner-reported; current API/container/cluster association unverified. Do not run the old script's write path. |
| DB history, policy definitions, drift | No approved current read-only DB connection available in this workspace. | Unverified. |
| Production separation | No current Coolify resource/network/volume comparison or cluster ID evidence. | Unverified. |
| Recovery | Owner reports an enabled daily `supabase-db` schedule, 13 executions, and a successful 27 October 2026 00:01 UTC backup of about 1.53 MB that they downloaded. No S3 destination or isolated restore is verified. | Backup existence is owner-reported; recoverability unverified. |
| Migration authority | Protected GitHub release secrets are app-deploy/acceptance credentials, not DB migration authority. | Named Coolify TEST DB operator required. |

The last verified staging/live app SHA is `9db40543d01e54f211f17cb850b6112cf71cf318`. The proposed security migration is `20261027070000_restrict_linked_grants_to_explicit_scope.sql`; the separately pending document-title migration is `20261027071500_document_display_titles.sql`. Neither is recorded here as applied.

## Repeatable read-only diagnostic

`scripts/staging/verify-test-infrastructure.mjs` calls only documented Coolify `GET` endpoints and PostgreSQL `SELECT` statements. It checks the exact project/environment/application/service, the `supabase-db` component and expected mounts, backup executions, GitHub staging SHA and public `/api/version`. If a separate read-only PostgreSQL connection is configured, it reports the cluster identifier, migration versions and linked-grant/title schema state. Its output is an allowlisted summary; API response bodies, Compose content, backup paths and credentials are never emitted. It exits nonzero when identity, recovery or schema evidence is incomplete. A successful diagnostic is **not** migration approval.

The manual `.github/workflows/staging-infrastructure-diagnostic.yml` job uses the existing `legacy-fortress-staging` environment and branch restriction, `contents: read`, and no deployment or migration token. Its `COOLIFY_READ_TOKEN` secret must refer to an **existing read-capable token** on the correct Coolify team; do not use the deploy token simply because it can also read. Set `COOLIFY_READ_URL` as a protected environment variable for the self-hosted Coolify control-plane origin. Optional `TEST_DB_RO_*` secrets must be a separate read-only PostgreSQL identity; never use `SUPABASE_SERVICE_ROLE_KEY` or migration credentials. An optional `TEST_RESTORE_EVIDENCE_JSON` secret can record a successful isolated drill's backup execution UUID, timestamp, disposable cluster ID, operator and `result: passed` without private rows.

Repository inspection confirms the protected GitHub environment currently permits only `hosted-uat-preparation-20260715` and the repository default branch is `main`. GitHub API access available to this session returned HTTP 403 for *secret-name metadata*, so it could not prove whether `COOLIFY_READ_TOKEN` is already in that environment; no secret values were requested. For manual dispatch, install the same diagnostic workflow and script on `main` (workflow discovery) and staging (the allowed run ref), then select staging in Actions. Do not relax the environment branch policy. The existing staging-release workflow exposes `COOLIFY_DEPLOY_TOKEN`, not a proven separate read-only token, and never applies SQL.

Review branches are `ci/test-infra-diagnostic-main` (base `main`) and `docs/test-database-migration-procedure` (base staging). This session's GitHub tokens received HTTP 403 when attempting to create draft PRs, so the repository owner must open those two compare links, review and merge **main first, staging second**. No branch was merged by this work. After confirming that an existing *read-only* Coolify token is safely mapped to protected `COOLIFY_READ_TOKEN` and `COOLIFY_READ_URL` points to the approved self-hosted control plane, open **Actions → Legacy Fortress TEST infrastructure diagnostic → Run workflow**, select `hosted-uat-preparation-20260715`, and inspect the sanitized JSON result. The workflow fails when database access, cluster separation, schema or restore proof is missing. Do not map `COOLIFY_DEPLOY_TOKEN` into the diagnostic job. PostgreSQL inspection requires separate `TEST_DB_RO_*` protected secrets and a network path to the private TEST database; without them, the job reports database evidence unavailable.

Official Coolify API references: [read token permissions](https://coolify.io/docs/api/permissions), [service database listing](https://coolify.io/docs/api/endpoints/service-databases/list-service-databases-by-service-uuid), [service storage listing](https://coolify.io/docs/api/endpoints/services/list-storages-by-service-uuid), and [backup executions](https://coolify.io/docs/api/endpoints/databases/list-backup-executions).

## Gate 1: identify the resource without revealing secrets

The named Coolify operator records the current TEST application resource UUID, environment group, repository, branch, deployment SHA and its referenced Supabase resource UUID from Coolify. Verify that the DB container/service and persistent volume actually belong to that Supabase resource. Compare the TEST and production Supabase resource UUIDs, container identities, database network/volume IDs and PostgreSQL cluster identifiers; they must be distinct. The public API hostname alone is insufficient.

Using a read-only session to the **verified TEST container**, record `current_database()`, `current_user`, `inet_server_addr()`, `inet_server_port()`, server version and `pg_postmaster_start_time()`. If permitted, record the cluster system identifier from `pg_control_system()`; otherwise use the Coolify resource and persistent-volume identities. Record identifiers in the restricted operator evidence location, with a redacted summary in the handover. Do not print environment variables, keys, passwords, connection strings, customer rows or document contents.

Stop if the app resource cannot be tied to exactly one non-production Supabase/PostgreSQL resource, or if TEST/production separation remains uncertain.

## Gate 2: read-only schema and migration comparison

The operator uses the approved TEST DB connection, ideally a read-only role. If only `supabase_admin` is available, open an explicit read-only transaction before inspection. Query only system catalogues and count aggregates. Save a timestamped, access-restricted evidence bundle containing:

```sql
BEGIN READ ONLY;
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC;
SELECT proname, md5(pg_get_functiondef(p.oid)) AS definition_hash
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN (
  'linked_grant_allows_asset', 'linked_grant_allows_record',
  'linked_grant_allows_document', 'linked_grant_allows_storage_object',
  'lf_linked_grant_satisfies_identity');
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN
  ('assets','records','documents','attachments','contact_links','record_contacts'))
   OR (schemaname = 'storage' AND tablename = 'objects' AND policyname = 'vault_docs_linked_select')
ORDER BY schemaname, tablename, policyname;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'documents'
  AND column_name IN ('display_title','file_name','storage_path','document_kind');
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.documents'::regclass AND NOT tgisinternal;
ROLLBACK;
```

Compare the **full** TEST function/policy definitions privately with `20260820120000_phase1_verified_access_policy_foundation.sql` and the proposed security migration; a hash alone is not compatibility proof. Confirm the identity/Vault-state helper still gates linked access. Confirm `documents_owner_update`, `audit_events`, and `lf_internal` match Release #93's title migration prerequisites. Check whether either proposed migration version, column, constraint, function or trigger already exists. Stop on drift rather than relying on `CREATE OR REPLACE` or `IF NOT EXISTS` to conceal it.

Record aggregate counts only for active grants with explicit `asset_ids`/`record_ids` and active grants with empty explicit scope but matching legacy `contact_links`/`record_contacts`. This establishes potential sharing impact without exposing owner, contact or asset identities. Investigate owner intent separately; never backfill all associations into grants.

## Gate 3: recoverability and approval

The Coolify TEST DB operator records the backup owner, backup job/resource ID, latest successful backup ID and timestamp, storage location, retention, and how to restore **only TEST**. Verify the archive is readable and perform a restore drill to an isolated non-production target, or provide an already documented recent successful drill with matching backup format and schema. A scheduled job or file listing alone is not a usable recovery point. Record the rollback decision-maker and expected recovery time.

For each migration, the owner approves the **exact SHA-256 of the reviewed SQL file**, target DB resource/cluster identity, named operator, backup ID, execution window and recovery plan. Approval for one migration does not approve the next. Do not apply migrations while the target or approval is ambiguous.

### Isolated restore drill (not yet authorised or performed)

The owner/operator first confirms the downloaded backup belongs to the verified TEST database and remains inside approved non-production storage. Determine whether Coolify produced a single-database PostgreSQL custom-format dump (`pg_restore --list`) or an all-database gzip SQL dump (`gzip -t`, inspect headers without printing rows). On an **isolated disposable** PostgreSQL instance with no public port, no production network route and distinct data volume/cluster ID, restore a copy of that backup. Verify `supabase_migrations.schema_migrations`, core table definitions, policy/function presence and row-count totals only; do not output customer rows or filenames. Record the backup execution UUID, disposable cluster ID, successful restore time, operator and cleanup owner. Do not run `pg_restore`, `psql`, `createdb`, or a container command against the live TEST DB for this drill. Destroy the disposable target only under the operator's approved cleanup procedure. A downloaded archive or successful schedule alone does not satisfy this gate.

## Gate 4: apply one reviewed migration

1. Freeze the exact SQL artifact and verify its checksum on the operator host. Recheck the TEST resource identity, migration history and backup immediately before execution.
2. Use the established Supabase migration tool with an explicit TEST DB connection and a migration directory containing **only the approved pending migration**. Compare its pending list first; abort if it would apply any other version. Alternatively, use the established operator's transactional `psql` procedure only after confirming the actual `schema_migrations` column convention, with SQL application and history recording in the **same transaction**. Never run a broad `db push` against the full repository or guess history-table columns.
3. Verify one history row for the approved version, expected function/column/trigger definitions and no unrelated schema changes. Store execution timestamp, operator, migration checksum, history result and DB resource ID in restricted release evidence. Do not place secrets or private data in GitHub logs.
4. If verification fails, halt app promotion; the named operator uses the reviewed TEST restore or forward-recovery plan. Do not improvise a down migration.

**Order:** Apply and verify `20261027070000_restrict_linked_grants_to_explicit_scope.sql` first. Its only intended change is requiring IDs selected in `account_access_grants.permissions_override`; it must not broaden grants. Then, after separate approval, apply and verify `20261027071500_document_display_titles.sql`. The latter adds display metadata, original-file immutability and title-change audit; it must not change document bytes, storage path or original filename.

## Gate 5: hosted synthetic acceptance and application release

After the security migration, test with approved synthetic TEST accounts: explicit asset/record grants still work; unselected canonical assets, legacy records, linked documents, attachments and storage URLs deny; direct IDs and search do not disclose; revocation, Vault locks, insufficient IDV and cross-owner access deny. Check known legitimate grants with explicit scope. Record pass/fail and evidence without private identifiers.

After the separate title migration, verify owner title creation/rename and append-only audit; immutable original file identity; existing document reads; linked-reader read-only behaviour; cross-owner denial. Confirm the security migration remains effective. Do not deploy the Release #93 application before these database checks pass.

Promote only compatible reviewed application commits to `hosted-uat-preparation-20260715`, using fast-forward/PR checks that preserve unrelated work. Dispatch `.github/workflows/staging-release.yml` with the exact `expected_sha`; its protected environment performs the app deploy and hosted IDV/Admin acceptance. Confirm the workflow succeeds and `https://test.mylegacyfortress.com/api/version` equals the released SHA. Record workflow run, SHA, hosted security results and owner acceptance separately.

## Current blocker and owner action

The named Coolify TEST DB operator must provide current resource/production-separation evidence, read-only history and schema comparison, a restorable backup with owner, and the established exact-migration execution method. The owner must then explicitly approve the security migration; Release #93 requires a second approval. Until these gates pass, no hosted SQL or Release #93 application promotion is authorised.
