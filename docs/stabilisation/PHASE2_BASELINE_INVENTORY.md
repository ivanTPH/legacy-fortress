# Phase 2 Baseline Inventory

Date: 2026-07-13

Scope: Repository stabilisation, dirty-file classification, and reproducible local-UAT baseline for Legacy Fortress.

Hard boundary: This inventory is local-only. No hosted Supabase, Vercel, Stripe, production data, real users, deployment, commit, push, reset, clean, or Shure.Fund action was performed.

## Baseline identity

- Repository: `/Users/ivan-imac/legacy-fortress-web`
- Branch: `uat-remediation-preview`
- HEAD: `edda0feaee839ea24aec2443ad86b94a1ace70f5`
- Local review URL: `http://127.0.0.1:3012`
- Local Supabase API target expected for UAT: `http://127.0.0.1:55421`

## Required baseline commands captured before Phase 2 edits

The following commands were run before modifying files for Phase 2:

```bash
git status --short
git status --porcelain=v2
git branch --show-current
git rev-parse HEAD
git diff --stat
git diff --name-status
git diff
git ls-files --others --exclude-standard
```

`git diff` was executed as required; terminal output was too large for a durable inline copy, so this document records the command and the durable summaries below.

## Baseline diff summary

- Modified tracked files at baseline: 52.
- Untracked non-ignored files at baseline: 68.
- Tracked diff stat at baseline: 54 files changed, 4978 insertions, 1146 deletions.
- After Phase 2 test-script/assertion changes: 54 tracked files changed, 4991 insertions, 1151 deletions.

## Baseline modified tracked files

```text
.gitignore
app/(app)/business/page.tsx
app/(app)/components/NavIcons.tsx
app/(app)/components/dashboard/ContactInvitationManager.tsx
app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx
app/(app)/dashboard/page.tsx
app/(app)/executors/page.tsx
app/(app)/finances/page.tsx
app/(app)/layout.tsx
app/(app)/legal/page.tsx
app/(app)/personal/page.tsx
app/(app)/property/page.tsx
app/(app)/vault/digital/page.tsx
app/(app)/vault/personal/page.tsx
app/api/internal/admin/admin-users/route.ts
app/api/internal/admin/session/route.ts
app/api/internal/admin/support/route.ts
app/api/internal/admin/users/route.ts
app/api/internal/admin/verifications/route.ts
app/forgot-password/page.tsx
app/globals.css
app/onboarding/OnboardingPageClient.tsx
components/admin/AdminOpsWorkspace.tsx
components/auth/SignUpForm.tsx
components/contacts/ContactsNetworkWorkspace.tsx
components/documents/AttachmentGallery.tsx
components/records/UniversalRecordWorkspace.tsx
components/sections/SectionWorkspace.tsx
config/routeManifest.tsx
docs/BUILD_AND_RELEASE.md
docs/KNOWN_TECH_DEBT.md
docs/UAT_REMEDIATION_TODO.md
lib/access-control/roles.ts
lib/admin/access.ts
lib/admin/operations.ts
lib/assets/fieldDictionary.ts
lib/assets/workspaceCategoryConfig.ts
lib/contacts/canonicalContacts.ts
lib/contacts/contactStatus.ts
lib/contacts/invitationStatus.ts
lib/contacts/invitations.ts
lib/contacts/sendContactInvite.ts
lib/legalCategories.ts
next.config.ts
package.json
proxy.ts
supabase/config.toml
tests/dashboard-ui-consistency.test.mjs
tests/executors-unification.test.mjs
tests/invitation-linked-access.test.mjs
tests/people-role-unification.test.mjs
tests/platform-architecture-stabilisation.test.mjs
tsconfig.json
```

Phase 2 also modified `tests/auth-and-schema-guards.test.mjs` to correct a stale local-versus-production Supabase auth config assertion.

## Baseline untracked non-ignored files

```text
.env.example
.env.staging.example
AGENTS.md
app/(app)/vault/digital/records/page.tsx
app/(app)/vault/personal/records/page.tsx
app/admin/access-denied/page.tsx
app/admin/page.tsx
app/api/internal/admin/audit-history/route.ts
app/api/internal/admin/dashboard-summary/route.ts
app/api/internal/admin/local-role-override/route.ts
app/api/internal/admin/probate-cases/[caseId]/actions/route.ts
app/api/internal/admin/probate-cases/[caseId]/evidence/[evidenceId]/signed-url/route.ts
app/api/internal/admin/probate-cases/[caseId]/evidence/route.ts
app/api/internal/admin/probate-cases/[caseId]/route.ts
app/api/internal/admin/probate-cases/route.ts
components/admin/AdminDashboardWorkspace.tsx
docs/ADMIN_BACKOFFICE_DELIVERY_PLAN.md
docs/ADMIN_DASHBOARD_METRICS.md
docs/ADMIN_FOUNDATION.md
docs/ADMIN_ROLE_MATRIX.md
docs/ADMIN_UAT.md
docs/AI_PROJECT_STATE.md
docs/CODEX_HANDOVER.md
docs/HOSTED_STAGING_READINESS_PLAN.md
docs/LOCAL_SAFETY_CHECKLIST.md
docs/LOCAL_UAT_REVIEW_ACCESS.md
docs/STAGING_ENVIRONMENT_SETUP.md
lib/admin/audit.ts
lib/admin/capabilities.ts
lib/admin/dashboardSummary.ts
lib/admin/probateCases.ts
lib/assets/categoryTypeIntegrity.mjs
lib/auth/browserAuthClient.ts
lib/dashboard/financeRows.ts
scripts/audit-category-type-integrity.mjs
scripts/prepare-local-uat-review-users.mjs
supabase/migrations/20260630170000_admin_phase1_foundation.sql
supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql
supabase/migrations/20260703153000_linked_access_scope_enforcement.sql
supabase/migrations/20260710120000_trust_contact_auto_invitation.sql
supabase/migrations/20260711120000_category_type_integrity.sql
tests/admin-phase1-foundation.test.mjs
tests/admin-phase2b-probate-cases.test.mjs
tests/auth-browser-client.test.mjs
tests/category-dashboard-consistency.test.mjs
tests/category-type-integrity.test.mjs
tests/csp-local-supabase.test.mjs
tests/e2e/admin-role-matrix-local.spec.ts
tests/e2e/auth-email-local.spec.ts
tests/e2e/auth-hydration-console.spec.ts
tests/e2e/auth-session-phase1.spec.ts
tests/e2e/final-uat-contained-fixes.spec.ts
tests/e2e/final-uat-workflows.spec.ts
tests/e2e/local-uat-review-access.spec.ts
tests/e2e/phase4-linked-access-revocation.spec.ts
tests/e2e/preview-readiness-release-gate.spec.ts
tests/e2e/trust-contact-auto-invitation.spec.ts
tests/e2e/trusts-collapsible-form.spec.ts
tests/finance-dashboard-rows.test.mjs
tests/finance-type-selection.test.mjs
tests/legal-linked-contacts.test.mjs
tests/local-uat-review-access-doc.test.mjs
tests/shared-asset-form-consistency.test.mjs
tests/trust-contact-auto-invitation.test.mjs
tests/trust-linked-contact-role-card.test.mjs
tests/trusts-collapsible-form.test.mjs
tests/trusts-document-form.test.mjs
tests/workspace-category-config.test.mjs
```

## Ignored local/generated inventory observed

Ignored files include local secrets and generated artifacts:

- `.env.local`
- `.env.phase1.local`
- `.env.phase1.local.raw`
- `.next/`
- `.vercel/`
- `next-env.d.ts`
- `node_modules/`
- `supabase/.branches/`
- `supabase/.temp/`
- `test-results/`
- `tsconfig.tsbuildinfo`
- `.codex-uat-runner.mjs`

These must not be committed or deployed unless a future prompt explicitly audits and approves a safe subset. Secret-bearing `.env*` files remain ignored, while `.env.example` and `.env.staging.example` are intentionally unignored safe templates.

## Environment-name inspection

Values were not printed. Name/category inspection only:

- `.env.local`: Supabase URL, anon key, service-role key categories. This file is ignored and may point to hosted services; do not use it for local UAT unless separately approved.
- `.env.phase1.local`: local Supabase URL, anon key, service-role key, local DB URL, Mailpit URL, base URL, test-persona flags, internal test-login flag, environment label. This is the current ignored local-UAT mechanism.
- `.env.example`: safe template categories for Supabase, app URL, Playwright, local review flags, smoke-test placeholders, Stripe placeholders, OAuth placeholders.
- `.env.staging.example`: safe staging handover template categories only. No real URLs, keys, tokens, passwords, project IDs, database strings, or credentials should be added.

## Supabase local config finding

`supabase/config.toml` is currently a local UAT Supabase CLI config:

- Project ID category: local UAT identity.
- API port: `55421`.
- DB port: `55422`.
- Studio port: `55423`.
- Inbucket/Mailpit web port: `55424`.
- Auth `site_url`: `http://localhost:3012`.
- Auth additional redirects include `127.0.0.1:3012`, `localhost:3012`, and production callback/reset/sign-in origins.
- Email confirmations are enabled locally.

The stale `tests/auth-and-schema-guards.test.mjs` assertion expecting production `site_url` was corrected. The production origin should stay allow-listed, but the local CLI `site_url` should remain local for local confirmation email links.

## Migration-chain snapshot

Current migration ordering is chronological:

```text
20260304092034_init_schema.sql
20260304142711_init_schema.sql
20260304143200_create_profile_trigger.sql
20260306191500_safe_schema_hardening.sql
20260306233000_add_vault_tables_property_business_digital_profile.sql
20260306235000_create_property_assets.sql
20260307074500_add_category_system_fields.sql
20260307113000_account_security_and_profile_hardening.sql
20260307124500_dashboard_roles_invitations_completion.sql
20260307151500_signup_onboarding_consent_flow.sql
20260307190000_route_parity_workspace_tables.sql
20260307201000_add_avatar_path_column_if_missing.sql
20260307213000_ensure_section_entries_workspace.sql
20260309113000_add_universal_record_pattern_tables.sql
20260309122000_backfill_possessions_into_universal_records.sql
20260315162000_canonical_wallet_asset_document_model.sql
20260315171000_normalize_financial_provider_logo_paths.sql
20260321123000_fix_asset_payload_pgcrypto_schema_qualification.sql
20260323153000_ensure_asset_payload_pgcrypto_runtime.sql
20260323183000_canonical_contacts_phase1.sql
20260323191500_backfill_canonical_contacts_phase2.sql
20260323201500_contacts_user_id_compat.sql
20260324103000_contact_invitation_view_only_access.sql
20260324112000_fix_public_contact_invitation_profile_join.sql
20260324114000_fix_accept_contact_invitation_function.sql
20260324162000_admin_ops_access.sql
20260324175500_linked_profile_contact_address_read.sql
20260324190000_owner_plan_framework.sql
20260328143000_add_vault_preferences_to_user_profiles.sql
20260328184500_contact_validation_overrides.sql
20260329091500_add_accessibility_preferences_to_user_profiles.sql
20260630170000_admin_phase1_foundation.sql
20260701193000_admin_phase2b_probate_cases.sql
20260703153000_linked_access_scope_enforcement.sql
20260710120000_trust_contact_auto_invitation.sql
20260711120000_category_type_integrity.sql
```

Fresh reset was not performed in Phase 2 because the current local review environment and synthetic users must be preserved unless separately approved. Reproducibility is therefore partially proven by static migration review and test coverage, not by a destructive reset.

## Phase 2 test reproduction findings

Initial reproduction:

- `npm run test:core` failed one stale Supabase config assertion that expected local CLI `site_url` to be production.
- `npm run test:stabilisation` failed two stale UI assertions:
  - profile-chip helper signature still expected removed telephone setter plumbing;
  - onboarding copy still expected the old "Set up your vault in stages" milestone implementation.
- `node --test tests/admin-phase1-foundation.test.mjs` passed.

Phase 2 corrections:

- Updated the Supabase config test to assert local `site_url` plus production redirect allow-list.
- Updated the dashboard UI consistency test to match the current profile-chip and onboarding behavior.
- Added a `npm test` hierarchy in `package.json`:
  - `npm test`
  - `npm run test:unit`
  - `npm run test:uat:local`
  - `npm run test:uat:admin`

Post-correction proof:

- `npm run test:core` passed.
- `npm run test:stabilisation` passed.
- `npm test` passed.

## Final Phase 2 check results

Commands run after the Phase 2 corrections:

```bash
git status --short
npx tsc --noEmit --pretty false
npm test
npm run test:core
npm run test:stabilisation
npm run lint
npm run build
node --test tests/admin-phase1-foundation.test.mjs
curl -sS http://127.0.0.1:3012/api/health/schema
set -a; source .env.phase1.local; set +a; PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/admin-role-matrix-local.spec.ts --project=desktop-chromium --reporter=line
set -a; source .env.phase1.local; set +a; PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/local-uat-review-access.spec.ts --project=desktop-chromium --reporter=line
```

Results:

- `npx tsc --noEmit --pretty false`: passed.
- `npm test`: passed.
- `npm run test:core`: passed.
- `npm run test:stabilisation`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `node --test tests/admin-phase1-foundation.test.mjs`: passed.
- `curl -sS http://127.0.0.1:3012/api/health/schema`: passed with schema checks ok.
- `tests/e2e/local-uat-review-access.spec.ts`: passed 3/3.
- `tests/e2e/admin-role-matrix-local.spec.ts`: passed 13/13 when run by itself.

Browser proof note: the first parallel attempt to run both Playwright suites together failed the admin role matrix because both specs reset passwords for shared synthetic users. That is a test isolation/race issue, not a product auth failure. The suites should be run serially or changed to use separate email namespaces.
