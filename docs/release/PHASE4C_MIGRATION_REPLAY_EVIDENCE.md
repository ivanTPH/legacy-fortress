# Phase 4C Migration Replay Evidence

Date: 2026-07-13

## Scope

Phase 4C replay was performed against a disposable local database named for this phase inside the already-running isolated Legacy Fortress local Supabase Postgres instance. The active local UAT database was not reset, dropped, or modified.

## Inventory

- Migration files inspected: 37.
- First migration: `20260304092034_init_schema.sql`.
- Last migration: `20260713150000_enable_rls_vault_asset_tables.sql`.
- Duplicate timestamp count: 0.
- Empty early baseline files: 3 zero-line files.

## Replay Method

The disposable database was created locally, bootstrapped with minimal Supabase-compatible `auth`, `storage`, `extensions`, and local API roles required by the project migration chain, then every file in `supabase/migrations` was applied in filename order using `psql` with `ON_ERROR_STOP`.

This is fresh SQL replay evidence for the repository migration chain. It is not a replacement for hosted UAT migration proof against a real Supabase project.

## Result

Clean replay from zero succeeded on the final run.

Verified result summary:

- Public tables: 39.
- Public tables with RLS enabled: 39.
- Public policies: 59.
- Public functions: 18.
- Expected core tables present: `admin_users`, `audit_events`, `probate_cases`, `probate_case_evidence`, `assets`, `documents`, `records`, `attachments`, `contacts`, `contact_invitations`, `account_access_grants`, `section_entries`.
- Admin/audit indexes present: 9.
- Probate indexes present: 12.
- Audit append-only triggers present: 2.
- Linked-access helper functions present: 1.
- Auth users inserted by migrations: 0.
- Asset, record and contact rows inserted by migrations: 0.

## Notes

- `contact_invitations` currently exposes `sent_at` and `accepted_at` from the invitation lifecycle fields checked here. Richer invitation/access status is implemented through the application model and related tables rather than every proposed tracking label being present as a direct column on this table.
- No production data or hosted system was used.

## Rollback Strategy

No down migrations were proven. Hosted UAT must use a database backup/checkpoint before applying migrations. If a hosted migration fails, rollback is backup restore or forward-fix by explicit owner approval.
