# Phase 4B Proposed Commit Sequence

Date: 2026-07-13

Do not use one large commit. Do not stage with `git add .`.

## Proposed Sequence

1. Release hygiene and safe templates
   - Files: `.gitignore`, `.env.example`, `.env.staging.example`, `AGENTS.md`, safe release docs.
   - Tests: `git diff --check`, secret scan.
   - Notes: Keep env templates placeholder-only.

2. Auth/session/local CSP reliability
   - Files: `app/(app)/layout.tsx`, `app/forgot-password/page.tsx`, `components/auth/SignUpForm.tsx`, `lib/auth/browserAuthClient.ts`, `next.config.ts`, `proxy.ts`, auth/CSP tests.
   - Tests: auth unit tests, CSP tests, lint/build, auth Playwright.

3. Admin foundation
   - Files: `/admin` routes, `app/api/internal/admin/*` excluding probate, `components/admin/AdminDashboardWorkspace.tsx`, `lib/admin/access.ts`, `lib/admin/audit.ts`, `lib/admin/capabilities.ts`, `lib/admin/dashboardSummary.ts`, `lib/access-control/roles.ts`, admin docs/tests.
   - Migration: `20260630170000_admin_phase1_foundation.sql`.
   - Tests: admin Phase 1 node tests and admin role matrix.

4. Probate and linked-access workflow
   - Files: probate APIs, `lib/admin/probateCases.ts`, linked-access tests.
   - Migrations: `20260701193000_admin_phase2b_probate_cases.sql`, `20260703153000_linked_access_scope_enforcement.sql`.
   - Tests: Phase 2B tests, Phase 4 linked-access revocation Playwright.

5. Trust/contact invitations
   - Files: `ContactInvitationManager`, contact helpers, legal category config, trust/legal tests.
   - Migration: `20260710120000_trust_contact_auto_invitation.sql`.
   - Tests: trust contact auto-invitation and linked-contact tests.

6. Customer dashboard and overview cards
   - Files: `DashboardAssetSummaryCard`, `CanonicalAssetOverviewGrid`, customer overview routes, `lib/dashboard/financeRows.ts`, dashboard docs/tests.
   - Tests: Phase 3 and Phase 4A dashboard tests.

7. Shared asset forms and attachments
   - Files: `UniversalRecordWorkspace`, `AttachmentGallery`, `SectionWorkspace`, `fieldDictionary`, `workspaceCategoryConfig`, CSS.
   - Tests: shared form, trusts document, finance type and attachment tests.
   - Notes: This is a likely manual-split area.

8. Finance type integrity
   - Files: finance type registry/script/tests.
   - Migration: `20260711120000_category_type_integrity.sql`.
   - Tests: category type integrity tests and finance dashboard tests.

9. RLS hardening for older asset tables
   - Migration: `20260713150000_enable_rls_vault_asset_tables.sql`.
   - Notes: Remove/review hosted-context comment before commit.
   - Tests: schema/RLS proof and browser regression.

10. Documentation only
    - Files: docs not included above.
    - Tests: doc guard tests where present.

## Deferred Or Excluded

- `supabase/config.toml` unless a separate local-config commit is explicitly approved.
- `tsconfig.json` until generated include and formatting churn are reviewed.
- Any ignored env/local runtime artefact.
