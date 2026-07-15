# Phase 4D Final Commit Manifest

Date: 2026-07-14

## Status

Draft manifest only. No files are staged, committed or pushed by Phase 4D.

## Proposed Controlled Commits

### 1. Admin Access-Control Foundation

- Purpose: capability-gated admin dashboard/API foundation and read-only operational surfaces.
- Paths:
  - `app/admin/**`
  - `app/api/internal/admin/**`
  - `components/admin/**`
  - `lib/admin/**`
  - `lib/access-control/roles.ts`
  - admin Phase 1/2 tests under `tests/admin-*` and related Playwright specs.
- Migrations: `supabase/migrations/20260630170000_admin_phase1_foundation.sql`, `supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql`.
- Rollback: revert app/API/lib/test changes and restore database snapshot if migrations were applied in a target environment.
- Independent revert: mostly yes, except migration dependencies must be handled carefully.

### 2. Probate, Executor and Linked-Access Enforcement

- Purpose: scoped probate/access-grant model, revocation proof and RLS enforcement.
- Paths:
  - probate/admin APIs and helpers.
  - `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql`.
  - linked-access tests and docs.
- Rollback: database snapshot restore or owner-approved forward fix.
- Independent revert: no if target DB has already applied non-reversible migration.

### 3. Customer Vault UI and Canonical Dashboard Refinement

- Purpose: shared category dashboards, record workspace consistency, attachment/contact presentation and owner review UX.
- Paths:
  - `app/(app)/**` customer routes touched in this branch.
  - `components/records/UniversalRecordWorkspace.tsx`
  - `components/documents/AttachmentGallery.tsx`
  - `components/contacts/ContactsNetworkWorkspace.tsx`
  - `lib/assets/**`, `lib/contacts/**`, `lib/legalCategories.ts`.
- Migrations: `20260710120000_trust_contact_auto_invitation.sql`, `20260711120000_category_type_integrity.sql`, `20260713150000_enable_rls_vault_asset_tables.sql`.
- Rollback: revert UI/lib changes; restore DB snapshot if migrations applied.

### 4. UAT Presentation and Isolation Guards

- Purpose: UAT banner/noindex/environment validation and owner review documentation.
- Paths:
  - `components/internal/UatEnvironmentBanner.tsx`
  - `lib/environment/**`
  - `scripts/validate-uat-environment.mjs`
  - `tests/uat-environment-validation.test.mjs`
  - UAT presentation tests/docs.
- Rollback: revert code/tests/docs.
- Independent revert: yes.

### 5. Dependency Remediation

- Purpose: resolve release-check dependency audit advisories.
- Paths:
  - `package.json`
  - `package-lock.json`
- Rollback: revert package files, then rerun install/audit.
- Independent revert: yes, but audit would fail again.

### 6. Release and Architecture Documentation

- Purpose: capture release gates, tech debt, owner review paths and commit exclusions.
- Paths:
  - `docs/BUILD_AND_RELEASE.md`
  - `docs/KNOWN_TECH_DEBT.md`
  - `docs/PROJECT_STRUCTURE.md`
  - `docs/CODEX_HANDOVER.md`
  - `docs/product/**`
  - `docs/release/**`
  - `docs/stabilisation/**`
- Rollback: revert docs.
- Independent revert: yes.

## Required Exclusions

- `.env*` except explicitly approved non-secret examples.
- `supabase/config.toml` unless separately approved.
- `tsconfig.json` until review-sensitive generated include/formatting churn is reviewed.
- Screenshots, Playwright traces/videos, generated files, local uploads, temp scripts and database dumps.
- Any unresolved credential material.

## Review Notes

Some files contain mixed concerns and should be split carefully before commit. Do not use broad `git add .`.
