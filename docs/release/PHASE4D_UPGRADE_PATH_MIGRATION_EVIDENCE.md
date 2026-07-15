# Phase 4D Upgrade-Path Migration Evidence

Date: 2026-07-14

## Status

Older-baseline upgrade replay completed against a disposable local database inside the isolated local Supabase Postgres instance. The active local UAT database was not reset or modified.

## Baseline

Baseline cutoff: all migrations through `20260701193000_admin_phase2b_probate_cases.sql`.

This baseline is representative because it includes the admin foundation, probate case tables, canonical assets/documents, legacy compatibility tables, contacts, invitations and audit structures before the later linked-access/category/RLS release-candidate migrations.

## Release-Candidate Migration Range

Applied in order:

1. `20260703153000_linked_access_scope_enforcement.sql`
2. `20260710120000_trust_contact_auto_invitation.sql`
3. `20260711120000_category_type_integrity.sql`
4. `20260713150000_enable_rls_vault_asset_tables.sql`

## Pre-Upgrade Synthetic Data

The replay inserted representative synthetic local data only:

- Owner/auth users and wallet.
- Canonical finance asset.
- Unrelated canonical finance asset for isolation checks.
- Legacy `records` finance row.
- Legacy `section_entries` row.
- Canonical document and legacy attachment reference.
- Canonical contact, contact links, record contacts and contact invitation.
- Role assignment and account-access grant.
- Probate case and evidence.
- Admin user and audit event.

## Result

The migration replay command completed successfully with `upgrade replay passed`.

Verified by the replay sequence:

- Migrations applied without manual SQL edits after fixture constraints were corrected.
- No duplicate object failure halted the replay.
- No policy-name collision halted the replay.
- No function-signature conflict halted the replay.
- Representative customer, legacy, contact, probate/access and audit data survived the upgrade.
- Production migrations did not insert fixture users or customer records.

## Verification Limitation

A follow-up direct `psql` query for table counts/RLS details was blocked by the execution approval system during Phase 4D. The replay success is recorded, but DB-level post-query evidence should be re-run by the owner/operator before any push/deploy decision.

## Recovery Method

No down migrations were proven. For hosted UAT or staging, use a backup/checkpoint before migration, then rollback by snapshot restore or owner-approved forward fix.

## Release Impact

The upgrade path is substantially proven locally but should remain a pre-push/pre-deploy review item until the blocked post-query verification is rerun.
