# Phase 4B Migration And Schema Plan

Date: 2026-07-13

No migration was applied in Phase 4B.

## Migration Inventory

| Migration | Purpose | Main objects affected | Risk | UAT inclusion | Rollback approach |
| --- | --- | --- | --- | --- | --- |
| `20260630170000_admin_phase1_foundation.sql` | Admin role column and append-only audit events | `admin_users.role`, `audit_events`, audit indexes, mutation-prevention triggers | Medium; additive plus trigger enforcement | Yes, after backup | Forward fix or restore backup; remove role column/audit table only with data decision |
| `20260701193000_admin_phase2b_probate_cases.sql` | Probate case/evidence model and legacy verification backfill | `probate_cases`, `probate_case_evidence`, indexes, RLS, backfill from existing verification data | High; backfills from existing tables | Yes, staging proof required | Backup restore preferred; down migration needs careful case/evidence data handling |
| `20260703153000_linked_access_scope_enforcement.sql` | Tighten linked-access RLS to scoped records/documents/storage | SECURITY DEFINER helpers and linked-select policies across assets/documents/records/storage | High; security-critical policy replacement | Yes, required for linked-access UAT | Backup restore or policy forward-fix; must prove denial before/after |
| `20260710120000_trust_contact_auto_invitation.sql` | Trust contact invitation constraints and grant permission propagation | Contact/invitation/access-grant constraints and helper functions | Medium; constraint changes are `NOT VALID`, helper replacement | Review before UAT | Forward fix constraints/functions; ensure no production mail side effect |
| `20260711120000_category_type_integrity.sql` | Finance category/type validation triggers | Functions and triggers on `records` and `assets` | Medium; rejects invalid future writes | Yes after local/staging proof | Drop triggers/functions if blocking legitimate data |
| `20260713150000_enable_rls_vault_asset_tables.sql` | Enable owner-only RLS on older vault asset tables | RLS policies for property/business/digital/personal possession tables | High; access-policy change and review-sensitive comment | Review-sensitive; include only after audit | Backup restore or policy forward-fix; verify no owner regression |

## Ordering

The filenames are unique and ordered after the existing 202603 migration chain. The Phase 2B and linked-access migrations depend on earlier contact/invitation/access-grant tables from the 202603 chain. The trust invitation migration depends on the linked-access helper names and must be reviewed as it overrides helper behaviour to respect locked grants.

## Checks Required Before Hosted UAT

- Confirm target database is UAT only and not shared with production.
- Capture migration history.
- Take a database backup/checkpoint and assign rollback owner.
- Apply migrations in timestamp order only.
- Run schema health.
- Run admin role matrix, probate case workflow, linked-access revocation proof and dashboard/customer privacy tests.
- Confirm no migration inserts synthetic fixture data.

## Phase 4B Limitation

Fresh database reset was not performed in Phase 4B because the current local environment contains active UAT state and no disposable isolated database was created for this audit. Do not treat this as fresh-install proof.
