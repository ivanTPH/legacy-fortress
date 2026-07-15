# Phase 4B Dirty Tree Attribution

Date: 2026-07-13

Branch: `uat-remediation-preview`
HEAD: `edda0feaee839ea24aec2443ad86b94a1ace70f5`
Upstream: `origin/uat-remediation-preview`

This inventory attributes the current dirty tree for controlled review. It does not approve commit, push, deployment, migration application or merge.

## Summary

- Modified tracked files: 55.
- Untracked files: 83 before these Phase 4B release documents.
- Staged files: none observed before Phase 4B documentation.
- Mixed/review-sensitive files: `.gitignore`, `docs/BUILD_AND_RELEASE.md`, `supabase/config.toml`, `tsconfig.json`, `components/records/UniversalRecordWorkspace.tsx`, `app/globals.css`, and `supabase/migrations/20260713150000_enable_rls_vault_asset_tables.sql`.
- Must exclude from any normal commit: ignored env files, local Supabase runtime state, `.next`, `.vercel`, `test-results`, generated reports, local database/storage artefacts, and `supabase/config.toml` unless separately approved.

## Attribution Rules Used

Evidence came from `git status --short`, `git diff --stat`, `git diff --name-status`, file diffs, project docs, package scripts, migration SQL, and `docs/CODEX_HANDOVER.md`.

Confidence levels:

- High: purpose is directly supported by diff, tests, migration name, or documentation.
- Medium: purpose is clear from grouped files and docs but file has mixed edits.
- Low: needs manual review before inclusion.

## Modified Tracked Files

| Path | Status | Attribution | Type | Commit safety | Suggested group | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `.gitignore` | M | Env template allowlist plus generated/local artefact exclusions | Configuration | Review | Release hygiene | High |
| `app/(app)/business/page.tsx` | M | Phase 4A customer dashboard overview/card standard | App code | Review | Customer dashboard | High |
| `app/(app)/components/NavIcons.tsx` | M | Shared navigation icon additions | App code | Review | Customer dashboard/UI | Medium |
| `app/(app)/components/dashboard/ContactInvitationManager.tsx` | M | Contact/invitation status wording or mapping | App code | Review | Contacts/invitations | Medium |
| `app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx` | M | Phase 3 shared dashboard tile standard | App code | Review | Customer dashboard | High |
| `app/(app)/dashboard/page.tsx` | M | Customer dashboard summary/search/avatar/action-centre refinement | App code | Review | Customer dashboard | Medium |
| `app/(app)/executors/page.tsx` | M | Executor/contact unification | App code | Review | Contacts/executors | Medium |
| `app/(app)/finances/page.tsx` | M | Finance dashboard order and shared tile actions | App code | Review | Customer dashboard/finance | High |
| `app/(app)/layout.tsx` | M | Auth/session, app shell, avatar/nav refinements | App code | Review | Auth/app shell | Medium |
| `app/(app)/legal/page.tsx` | M | Legal dashboard shared tile standard | App code | Review | Customer dashboard/legal | High |
| `app/(app)/personal/page.tsx` | M | Personal/possession overview standard | App code | Review | Customer dashboard | High |
| `app/(app)/property/page.tsx` | M | Phase 4A property overview | App code | Review | Customer dashboard | High |
| `app/(app)/vault/digital/page.tsx` | M | Phase 4A digital overview | App code | Review | Customer dashboard | High |
| `app/(app)/vault/personal/page.tsx` | M | Phase 4A possessions overview | App code | Review | Customer dashboard | High |
| `app/api/internal/admin/admin-users/route.ts` | M | Admin role/capability enforcement | App API | Review | Admin foundation | High |
| `app/api/internal/admin/session/route.ts` | M | Admin session/role checks | App API | Review | Admin foundation | High |
| `app/api/internal/admin/support/route.ts` | M | Admin support capability gating | App API | Review | Admin foundation | High |
| `app/api/internal/admin/users/route.ts` | M | Admin user lookup capability gating | App API | Review | Admin foundation | High |
| `app/api/internal/admin/verifications/route.ts` | M | Verification/probate capability gating | App API | Review | Admin/probate | High |
| `app/forgot-password/page.tsx` | M | Auth helper/client consolidation | App code | Review | Auth reliability | Medium |
| `app/globals.css` | M | Large UI standardisation across dashboard/forms/profile | Styling | Manual split/review | Mixed UI | Medium |
| `app/onboarding/OnboardingPageClient.tsx` | M | Onboarding responsive and terms UX | App code | Review | Onboarding/customer UX | Medium |
| `components/admin/AdminOpsWorkspace.tsx` | M | Admin operations workspace changes | App code | Review | Admin foundation | High |
| `components/auth/SignUpForm.tsx` | M | Auth helper/client consolidation | App code | Review | Auth reliability | Medium |
| `components/contacts/ContactsNetworkWorkspace.tsx` | M | Canonical contact/invitation display | App code | Review | Contacts/invitations | Medium |
| `components/documents/AttachmentGallery.tsx` | M | Shared attachment UI/action consistency | App code | Review | Attachments | High |
| `components/records/UniversalRecordWorkspace.tsx` | M | Shared record CRUD, legal forms, documents, linked contacts, finance types | App code | Manual split/review | Mixed core workspace | Medium |
| `components/sections/SectionWorkspace.tsx` | M | Legacy section attachment/action consistency | App code | Review | Legacy compatibility | Medium |
| `config/routeManifest.tsx` | M | Route/admin/customer manifest updates | App config | Review | Navigation/routing | Medium |
| `docs/BUILD_AND_RELEASE.md` | M | Release and local-UAT documentation; Phase 4B redacted credential-like example | Documentation | Review | Documentation | High |
| `docs/KNOWN_TECH_DEBT.md` | M | Known debt updates from phases 1-4A | Documentation | Review | Documentation | High |
| `docs/PROJECT_STRUCTURE.md` | M | Current structure/admin/dashboard docs | Documentation | Review | Documentation | High |
| `docs/UAT_REMEDIATION_TODO.md` | M | UAT remediation evidence | Documentation | Review | Documentation | High |
| `lib/access-control/roles.ts` | M | Role/capability model | App library | Review | Admin foundation | High |
| `lib/admin/access.ts` | M | Admin access checks | App library | Review | Admin foundation | High |
| `lib/admin/operations.ts` | M | Admin operation helpers/audit | App library | Review | Admin foundation | High |
| `lib/assets/fieldDictionary.ts` | M | Asset field/dropdown standardisation | App library | Review | Customer forms | High |
| `lib/assets/workspaceCategoryConfig.ts` | M | Category config refinement | App library | Review | Customer forms | High |
| `lib/contacts/canonicalContacts.ts` | M | Canonical contact compatibility | App library | Review | Contacts/invitations | Medium |
| `lib/contacts/contactStatus.ts` | M | Contact status mapping | App library | Review | Contacts/invitations | High |
| `lib/contacts/invitationStatus.ts` | M | Invitation status mapping | App library | Review | Contacts/invitations | High |
| `lib/contacts/invitations.ts` | M | Invitation helper updates | App library | Review | Contacts/invitations | High |
| `lib/contacts/sendContactInvite.ts` | M | Trust/contact invite sending helper | App library | Review | Contacts/invitations | High |
| `lib/legalCategories.ts` | M | Legal category roles/forms | App library | Review | Legal forms | High |
| `next.config.ts` | M | Local-only CSP image/connect allowance | Build config | Review | Auth/local UAT | High |
| `package.json` | M | Test script registration | Build/test config | Review | Test harness | High |
| `proxy.ts` | M | Admin/prototype route guard logic | App middleware | Review | Admin foundation | High |
| `supabase/config.toml` | M | Isolated local Supabase ports and local redirect/email settings | Local config | Exclude unless approved | Local UAT config | High |
| `tests/auth-and-schema-guards.test.mjs` | M | Auth/schema guard expectations | Test | Review | Tests | Medium |
| `tests/dashboard-ui-consistency.test.mjs` | M | Dashboard/onboarding UI assertions | Test | Review | Tests | Medium |
| `tests/executors-unification.test.mjs` | M | Executor/contact tests | Test | Review | Tests | High |
| `tests/invitation-linked-access.test.mjs` | M | Invitation/access test updates | Test | Review | Tests | High |
| `tests/people-role-unification.test.mjs` | M | Contact role unification test | Test | Review | Tests | High |
| `tests/platform-architecture-stabilisation.test.mjs` | M | Architecture guardrail updates | Test | Review | Tests | High |
| `tsconfig.json` | M | Formatting plus generated `.next/dev/dev/types` include | Build config | Review-sensitive | Build config | Low |

## Untracked Files

| Path | Attribution | Type | Commit safety | Suggested group | Confidence |
| --- | --- | --- | --- | --- | --- |
| `.env.example` | Safe placeholder local env template | Env template | Review | Release hygiene | High |
| `.env.staging.example` | Safe placeholder staging template | Env template | Review | Release hygiene | High |
| `AGENTS.md` | Local agent operating rules | Documentation | Review | Documentation | High |
| `app/(app)/components/dashboard/CanonicalAssetOverviewGrid.tsx` | Phase 4A canonical overview grid | App code | Review | Customer dashboard | High |
| `app/(app)/vault/digital/records/page.tsx` | Digital canonical records route | App code | Review | Customer dashboard | High |
| `app/(app)/vault/personal/records/page.tsx` | Possessions canonical records route | App code | Review | Customer dashboard | High |
| `app/admin/access-denied/page.tsx` | Admin safe denial route | App code | Review | Admin foundation | High |
| `app/admin/page.tsx` | Admin dashboard route | App code | Review | Admin foundation | High |
| `app/api/internal/admin/audit-history/route.ts` | Read-only audit history API | App API | Review | Admin foundation | High |
| `app/api/internal/admin/dashboard-summary/route.ts` | Admin aggregate dashboard API | App API | Review | Admin foundation | High |
| `app/api/internal/admin/local-role-override/route.ts` | Local-only role test harness | App API | Review-sensitive | Admin test harness | High |
| `app/api/internal/admin/probate-cases/*` | Probate case APIs and evidence routes | App API | Review | Probate workflow | High |
| `components/admin/AdminDashboardWorkspace.tsx` | Admin aggregate dashboard UI | App code | Review | Admin foundation | High |
| `docs/ADMIN_*.md` | Admin foundation/role/UAT docs | Documentation | Review | Documentation | High |
| `docs/AI_PROJECT_STATE.md` | Project state summary | Documentation | Review | Documentation | Medium |
| `docs/CODEX_HANDOVER.md` | Active handover | Documentation | Review | Documentation | High |
| `docs/HOSTED_STAGING_READINESS_PLAN.md` | Staging readiness plan | Documentation | Review | Documentation | High |
| `docs/LOCAL_SAFETY_CHECKLIST.md` | Local safety checklist | Documentation | Review | Documentation | High |
| `docs/LOCAL_UAT_REVIEW_ACCESS.md` | Local review access guide | Documentation | Review | Documentation | High |
| `docs/STAGING_ENVIRONMENT_SETUP.md` | Staging env setup guide | Documentation | Review | Documentation | High |
| `docs/architecture/*` | Dashboard architecture docs | Documentation | Review | Documentation | High |
| `docs/product/*` | Product dashboard/backlog docs | Documentation | Review | Documentation | High |
| `docs/stabilisation/*` | Phase 2 dirty-tree/stabilisation docs | Documentation | Review | Documentation | High |
| `lib/admin/audit.ts` | Audit event helper | App library | Review | Admin foundation | High |
| `lib/admin/capabilities.ts` | Capability matrix | App library | Review | Admin foundation | High |
| `lib/admin/dashboardSummary.ts` | Safe aggregate admin metrics | App library | Review | Admin foundation | High |
| `lib/admin/probateCases.ts` | Probate case service | App library | Review | Probate workflow | High |
| `lib/assets/categoryTypeIntegrity.mjs` | Finance category/type registry | App library | Review | Customer finance | High |
| `lib/auth/browserAuthClient.ts` | Browser auth client consolidation | App library | Review | Auth reliability | High |
| `lib/dashboard/financeRows.ts` | Finance dashboard rows | App library | Review | Customer dashboard | High |
| `scripts/audit-category-type-integrity.mjs` | Local category/type audit | Script | Review | Test/harness | High |
| `scripts/prepare-local-uat-review-users.mjs` | Local synthetic user provisioning | Script | Review-sensitive | Local UAT harness | High |
| `supabase/migrations/20260630170000_admin_phase1_foundation.sql` | Admin roles/audit foundation | Migration | Review | Migration package | High |
| `supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql` | Probate cases/evidence | Migration | Review | Migration package | High |
| `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql` | Linked-access RLS remediation | Migration | Review | Migration package | High |
| `supabase/migrations/20260710120000_trust_contact_auto_invitation.sql` | Trust invite/access helper changes | Migration | Review | Migration package | High |
| `supabase/migrations/20260711120000_category_type_integrity.sql` | Finance type integrity triggers | Migration | Review | Migration package | High |
| `supabase/migrations/20260713150000_enable_rls_vault_asset_tables.sql` | RLS enablement for legacy asset tables; contains hosted-apply note | Migration | Review-sensitive | Migration package | Medium |
| `tests/admin-phase1-foundation.test.mjs` | Admin foundation tests | Test | Review | Tests | High |
| `tests/admin-phase2b-probate-cases.test.mjs` | Probate tests | Test | Review | Tests | High |
| `tests/auth-browser-client.test.mjs` | Auth client tests | Test | Review | Tests | High |
| `tests/category-dashboard-consistency.test.mjs` | Dashboard card standard tests | Test | Review | Tests | High |
| `tests/category-type-integrity.test.mjs` | Finance category type tests | Test | Review | Tests | High |
| `tests/csp-local-supabase.test.mjs` | Local CSP test | Test | Review | Tests | High |
| `tests/e2e/*.spec.ts` | Browser UAT/admin/auth/dashboard/trust tests | Test | Review | Tests | High |
| `tests/finance-*.test.mjs` | Finance dashboard/type tests | Test | Review | Tests | High |
| `tests/fixtures/*` | Synthetic fixture packs | Fixture | Review | Tests/fixtures | High |
| `tests/legal-linked-contacts.test.mjs` | Legal linked contact tests | Test | Review | Tests | High |
| `tests/local-uat-review-access-doc.test.mjs` | Local review doc guard | Test | Review | Tests | High |
| `tests/phase3-product-governance.test.mjs` | Product governance tests | Test | Review | Tests | High |
| `tests/phase4a-customer-dashboard-data-proof.test.mjs` | Phase 4A data proof | Test | Review | Tests | High |
| `tests/shared-asset-form-consistency.test.mjs` | Shared form consistency tests | Test | Review | Tests | High |
| `tests/trust*.test.mjs` | Trust form/invitation tests | Test | Review | Tests | High |
| `tests/workspace-category-config.test.mjs` | Category config tests | Test | Review | Tests | High |

## Mixed Files Requiring Manual Split Or Careful Review

- `components/records/UniversalRecordWorkspace.tsx`: combines form layout, save confirmation, legal linked contacts, finance document logic and shared upload behaviour.
- `app/globals.css`: combines dashboard, onboarding, profile, form and card styling.
- `docs/BUILD_AND_RELEASE.md`: contains legitimate release updates and a Phase 4B redaction of a credential-like example; old history still needs owner review.
- `tsconfig.json`: includes formatting churn plus a generated Next types include.
- `supabase/config.toml`: local UAT runtime settings, not deployable configuration.
- `supabase/migrations/20260713150000_enable_rls_vault_asset_tables.sql`: schema hardening intent is valid, but its comment references prior hosted application context and must be reviewed before commit.
