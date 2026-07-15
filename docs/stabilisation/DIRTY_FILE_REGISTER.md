# Dirty File Register

Date: 2026-07-13

Classification key:

- A: Approved application/security change.
- B: Approved migration/data fixture.
- C: Test/proof evidence.
- D: Documentation.
- E: Local-only configuration/template.
- F: Generated artifact.
- G: Obsolete/duplicate candidate.
- H: Uncertain/review-sensitive.

Shared defaults unless overridden: introduced by prior approved UAT/admin/customer-vault remediation unless marked `UNCONFIRMED`; secret-sensitive `No`; recommended action `retain for review`; removal risk `medium until covered by release checklist`; verification `lint/build/unit/e2e as applicable`.

## Modified tracked files

| File | Class | Reason | Introduced by | Dependencies | Tracked | Secret-sensitive | Recommended action | Removal risk | Verification required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `.gitignore` | E | Keeps secret env/generated files ignored while allowing safe templates. | Phase 5A | env templates | Yes | No | Retain; review with env packaging | Low | `git check-ignore` |
| `app/(app)/business/page.tsx` | A | Customer dashboard/category UI route changes. | Prior UI remediation | route manifest, category config | Yes | No | Retain | Medium | browser CRUD smoke |
| `app/(app)/components/NavIcons.tsx` | A | Navigation icon support. | Prior UI remediation | dashboard/sidebar | Yes | No | Retain | Low | lint/build |
| `app/(app)/components/dashboard/ContactInvitationManager.tsx` | A | Contact invitation display/status adjustment. | Contact/invitation remediation | contacts/invitations | Yes | No | Retain | Medium | contact invite tests |
| `app/(app)/components/dashboard/DashboardAssetSummaryCard.tsx` | A | Shared dashboard tile/card behavior and add/open actions. | Dashboard UI remediation | category dashboards | Yes | No | Retain | Medium | dashboard consistency tests |
| `app/(app)/dashboard/page.tsx` | A | Customer dashboard summary/search/layout behavior. | Dashboard UI remediation | financeRows, discovery | Yes | No | Retain | Medium | dashboard/search e2e |
| `app/(app)/executors/page.tsx` | A | Executor/contact flow alignment. | Contact role remediation | contacts, roles | Yes | No | Retain | Medium | executor tests |
| `app/(app)/finances/page.tsx` | A | Finance dashboard/order/summary behavior. | Finance UI remediation | financeRows | Yes | No | Retain | Medium | finance dashboard tests |
| `app/(app)/layout.tsx` | A | Auth shell, avatar chip, route/menu and local review behavior. | Auth/profile/admin review remediation | auth/session/profile | Yes | No | Retain; review carefully | High | auth/session/e2e |
| `app/(app)/legal/page.tsx` | A | Legal category dashboard standardization. | Legal UI remediation | legalCategories | Yes | No | Retain | Medium | category dashboard tests |
| `app/(app)/personal/page.tsx` | A | Personal/possessions dashboard flow. | Personal UI remediation | category config | Yes | No | Retain | Medium | category dashboard tests |
| `app/(app)/property/page.tsx` | A | Property category dashboard flow. | Property UI remediation | route manifest | Yes | No | Retain | Medium | browser CRUD smoke |
| `app/(app)/vault/digital/page.tsx` | A | Digital dashboard/category cards. | Digital category remediation | route aliases | Yes | No | Retain | Medium | category tests |
| `app/(app)/vault/personal/page.tsx` | A | Possessions/personal dashboard cards. | Possessions remediation | route aliases | Yes | No | Retain | Medium | category tests |
| `app/api/internal/admin/admin-users/route.ts` | A | Admin API capability enforcement. | Admin Phase 1 | admin access/audit | Yes | No | Retain | High | admin role matrix |
| `app/api/internal/admin/session/route.ts` | A | Admin session/capability API behavior. | Admin Phase 1 | admin access | Yes | No | Retain | High | admin tests |
| `app/api/internal/admin/support/route.ts` | A | Support admin API guard behavior. | Admin Phase 1 | admin access/audit | Yes | No | Retain | Medium | admin route tests |
| `app/api/internal/admin/users/route.ts` | A | User lookup admin API guard behavior. | Admin Phase 1 | admin access/audit | Yes | No | Retain | Medium | admin route tests |
| `app/api/internal/admin/verifications/route.ts` | A | Verification admin API guard behavior. | Admin Phase 1 | admin access/audit | Yes | No | Retain | Medium | admin route tests |
| `app/forgot-password/page.tsx` | A | Auth email/local callback flow. | Auth/email remediation | auth callback | Yes | No | Retain | Medium | auth e2e |
| `app/globals.css` | A | Broad UI/layout styles for dashboard, forms, linked contacts, onboarding. | UI remediation | many components | Yes | No | Retain; review visual scope | High | responsive/browser smoke |
| `app/onboarding/OnboardingPageClient.tsx` | A | Onboarding flow/copy/terms behavior. | Onboarding UX remediation | onboarding/vault prefs | Yes | No | Retain | Medium | auth/onboarding tests |
| `components/admin/AdminOpsWorkspace.tsx` | A | Admin/prototype workspace foundation. | Admin Phase 1 | admin docs/API | Yes | No | Retain | Medium | admin tests |
| `components/auth/SignUpForm.tsx` | A | Local sign-up/auth UX. | Auth/email remediation | Supabase auth | Yes | No | Retain | Medium | auth tests |
| `components/contacts/ContactsNetworkWorkspace.tsx` | A | Canonical contact UI behavior. | Contact remediation | contacts libs | Yes | No | Retain | Medium | contacts tests |
| `components/documents/AttachmentGallery.tsx` | A | Shared attachment actions/preview/download UI. | Attachment remediation | documentLinks | Yes | No | Retain | Medium | attachment tests |
| `components/records/UniversalRecordWorkspace.tsx` | A | Main canonical asset forms, dashboards, linked-contact rows, attachments. | Core workflow remediation | assets, contacts, docs | Yes | No | Retain; high-review file | High | full CRUD/e2e |
| `components/sections/SectionWorkspace.tsx` | A | Legacy section compatibility attachment/actions. | Legacy compatibility remediation | section_entries | Yes | No | Retain until migration | Medium | legacy flow tests |
| `config/routeManifest.tsx` | A | Route inventory/navigation parity. | Navigation remediation | route tests | Yes | No | Retain | Medium | route parity |
| `docs/BUILD_AND_RELEASE.md` | D | Release notes and local UAT gates. | Prior docs | release docs | Yes | No | Retain/update | Low | doc review |
| `docs/KNOWN_TECH_DEBT.md` | D | Known debt register. | Prior docs | all phases | Yes | No | Retain/update | Low | doc review |
| `docs/UAT_REMEDIATION_TODO.md` | D | UAT remediation state. | Prior docs | all phases | Yes | No | Retain/update | Low | doc review |
| `lib/access-control/roles.ts` | A | Role/access constants. | Linked-access/admin remediation | viewer access | Yes | No | Retain | High | access tests |
| `lib/admin/access.ts` | A | Admin capability enforcement. | Admin Phase 1 | admin APIs | Yes | No | Retain | High | admin role matrix |
| `lib/admin/operations.ts` | A | Admin operational helpers. | Admin Phase 1 | audit/admin APIs | Yes | No | Retain | High | admin tests |
| `lib/assets/fieldDictionary.ts` | A | Shared asset field definitions. | Form/category remediation | UniversalRecordWorkspace | Yes | No | Retain | Medium | shared form tests |
| `lib/assets/workspaceCategoryConfig.ts` | A | Category route/config mapping. | Category integrity remediation | route pages | Yes | No | Retain | Medium | category config tests |
| `lib/contacts/canonicalContacts.ts` | A | Canonical contact read/write behavior. | Contact remediation | contacts UI | Yes | No | Retain | Medium | contact tests |
| `lib/contacts/contactStatus.ts` | A | Contact status labels. | Contact remediation | invitation UI | Yes | No | Retain | Low | contact tests |
| `lib/contacts/invitationStatus.ts` | A | Invitation status labels/state. | Invitation remediation | sendContactInvite | Yes | No | Retain | Medium | invitation tests |
| `lib/contacts/invitations.ts` | A | Invitation helpers. | Invitation remediation | Supabase tables | Yes | No | Retain | Medium | invitation tests |
| `lib/contacts/sendContactInvite.ts` | A | Contact invite send/create helper. | Trust invite remediation | contact_invitations | Yes | No | Retain | High | invite/email proof |
| `lib/legalCategories.ts` | A | Legal category definitions. | Legal form remediation | legal pages | Yes | No | Retain | Medium | legal tests |
| `next.config.ts` | H | CSP/local image/runtime config changes; review-sensitive before deploy. | CSP/avatar remediation | proxy/env | Yes | No | Review before commit | High | build/security review |
| `package.json` | A | Adds maintainable test hierarchy. | Phase 2 | test scripts | Yes | No | Retain | Low | `npm test` |
| `proxy.ts` | A | Security headers/CSP and admin route guards. | CSP/admin remediation | Next middleware | Yes | No | Retain; security review | High | CSP/admin tests |
| `supabase/config.toml` | E | Local-only UAT ports/auth URLs/email confirmation. | Local UAT setup | Supabase CLI | Yes | No, but local-only | Exclude from hosted deploy unless reviewed | High | local auth/schema |
| `tests/auth-and-schema-guards.test.mjs` | C | Phase 2 corrected local Supabase config assertion. | Phase 2 | supabase/config | Yes | No | Retain | Low | `npm run test:core` |
| `tests/dashboard-ui-consistency.test.mjs` | C | UI consistency assertions aligned with intended behavior. | Phase 2/prior UI | app layout/onboarding | Yes | No | Retain | Low | `npm run test:stabilisation` |
| `tests/executors-unification.test.mjs` | C | Executor/contact unification proof. | Contact remediation | executor/contact libs | Yes | No | Retain | Low | node tests |
| `tests/invitation-linked-access.test.mjs` | C | Linked invitation/access proof. | Linked access remediation | invitation libs | Yes | No | Retain | Low | node tests |
| `tests/people-role-unification.test.mjs` | C | People/role canonicalization proof. | Contact remediation | contacts/roles | Yes | No | Retain | Low | node tests |
| `tests/platform-architecture-stabilisation.test.mjs` | C | Architecture guard tests. | Stabilisation | docs/lib | Yes | No | Retain | Low | stabilisation |
| `tsconfig.json` | H | TypeScript include/exclude/build behavior changed; review-sensitive. | UNCONFIRMED | tsc/build | Yes | No | Review before commit | High | `tsc --noEmit`, build |

## Untracked non-ignored files

| File | Class | Reason | Introduced by | Dependencies | Tracked | Secret-sensitive | Recommended action | Removal risk | Verification required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `.env.example` | E | Safe env template. | Env handover | docs/release | No | No if placeholders only | Track after review | Low | inspect no secrets |
| `.env.staging.example` | E | Safe staging env template. | Phase 5A | docs/staging | No | No if placeholders only | Track after review | Low | inspect no secrets |
| `AGENTS.md` | D | Local agent safety/run instructions. | Codex operating docs | repo workflow | No | No | Track | Low | doc review |
| `app/(app)/vault/digital/records/page.tsx` | A | Digital records route alias/foundation. | Digital remediation | vault/digital | No | No | Track if route approved | Medium | route parity |
| `app/(app)/vault/personal/records/page.tsx` | A | Personal/possessions records route alias/foundation. | Personal remediation | vault/personal | No | No | Track if route approved | Medium | route parity |
| `app/admin/access-denied/page.tsx` | A | Admin denial route. | Admin Phase 1 | admin guard | No | No | Track | Medium | admin e2e |
| `app/admin/page.tsx` | A | Canonical admin landing. | Admin Phase 1 | AdminDashboardWorkspace | No | No | Track | Medium | admin e2e |
| `app/api/internal/admin/audit-history/route.ts` | A | Read-only audit API. | Admin Phase 1 | audit/capabilities | No | No | Track | High | admin tests |
| `app/api/internal/admin/dashboard-summary/route.ts` | A | Aggregate admin dashboard API. | Admin Phase 1 | dashboardSummary | No | No | Track | High | admin tests |
| `app/api/internal/admin/local-role-override/route.ts` | C | Local-only role harness. | Admin role matrix | local env guard | No | No | Track only if guarded | High | role matrix |
| `app/api/internal/admin/probate-cases/[caseId]/actions/route.ts` | A | Probate case action API. | Phase 2B | probateCases/audit | No | No | Track after review | High | probate tests |
| `app/api/internal/admin/probate-cases/[caseId]/evidence/[evidenceId]/signed-url/route.ts` | A | Case evidence signed URL API. | Phase 2B | storage/RLS | No | No | Track after security review | High | evidence tests |
| `app/api/internal/admin/probate-cases/[caseId]/evidence/route.ts` | A | Case evidence upload/list API. | Phase 2B | probateCases/storage | No | No | Track after review | High | probate tests |
| `app/api/internal/admin/probate-cases/[caseId]/route.ts` | A | Case detail API. | Phase 2B | probateCases | No | No | Track after review | High | probate tests |
| `app/api/internal/admin/probate-cases/route.ts` | A | Case queue API. | Phase 2B | probateCases | No | No | Track after review | High | probate tests |
| `components/admin/AdminDashboardWorkspace.tsx` | A | Admin dashboard UI. | Admin Phase 1 | admin APIs | No | No | Track | Medium | admin e2e |
| `docs/ADMIN_BACKOFFICE_DELIVERY_PLAN.md` | D | Authoritative admin delivery plan. | Admin planning | admin docs | No | No | Track | Low | doc review |
| `docs/ADMIN_DASHBOARD_METRICS.md` | D | Admin metric definitions. | Admin Phase 1 | dashboardSummary | No | No | Track | Low | doc review |
| `docs/ADMIN_FOUNDATION.md` | D | Admin foundation doc. | Admin Phase 1 | admin code | No | No | Track | Low | doc review |
| `docs/ADMIN_ROLE_MATRIX.md` | D | Admin role/capability matrix. | Admin Phase 1 | capabilities | No | No | Track | Low | doc review |
| `docs/ADMIN_UAT.md` | D | Admin UAT evidence. | Admin Phase 1 | tests/e2e | No | No | Track | Low | doc review |
| `docs/AI_PROJECT_STATE.md` | D | Broad project state. | UNCONFIRMED | handover docs | No | No | Review before track | Low | doc review |
| `docs/CODEX_HANDOVER.md` | D | Current handover. | Codex sessions | all phases | No | No | Track | Low | doc review |
| `docs/HOSTED_STAGING_READINESS_PLAN.md` | D | Hosted staging plan. | Phase 5 | release docs | No | No | Track | Low | doc review |
| `docs/LOCAL_SAFETY_CHECKLIST.md` | D | Local safety checklist. | UAT safety | AGENTS | No | No | Track | Low | doc review |
| `docs/LOCAL_UAT_REVIEW_ACCESS.md` | D | Local review access instructions. | Phase 1 review access | scripts/tests | No | No | Track | Low | doc test |
| `docs/STAGING_ENVIRONMENT_SETUP.md` | D | Staging env setup without secrets. | Phase 5A | env template | No | No | Track | Low | doc review |
| `lib/admin/audit.ts` | A | Admin audit helper. | Admin Phase 1 | audit_events | No | No | Track | High | admin tests |
| `lib/admin/capabilities.ts` | A | Capability model. | Admin Phase 1 | admin access | No | No | Track | High | admin tests |
| `lib/admin/dashboardSummary.ts` | A | Admin aggregate metrics. | Admin Phase 1 | local DB tables | No | No | Track | Medium | admin e2e |
| `lib/admin/probateCases.ts` | A | Probate case service helpers. | Phase 2B | migrations/APIs | No | No | Track after review | High | probate tests |
| `lib/assets/categoryTypeIntegrity.mjs` | A | Finance category/type registry. | Category integrity | forms/migration | No | No | Track | Medium | category tests |
| `lib/auth/browserAuthClient.ts` | A | Browser auth client consolidation. | Auth remediation | auth pages | No | No | Track | Medium | auth tests |
| `lib/dashboard/financeRows.ts` | A | Dashboard finance row aggregation/order. | Finance dashboard remediation | records/assets | No | No | Track | Medium | finance tests |
| `scripts/audit-category-type-integrity.mjs` | C | Local audit/proof script. | Category integrity | local env | No | No | Track if useful | Low | script dry run |
| `scripts/prepare-local-uat-review-users.mjs` | C | Local synthetic review user setup helper. | Phase 1 review access | local env | No | No | Track only with guard | Medium | doc test |
| `supabase/migrations/20260630170000_admin_phase1_foundation.sql` | B | Admin roles/audit foundation. | Admin Phase 1 | Supabase | No | No | Track after migration review | High | admin DB tests |
| `supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql` | B | Probate case schema. | Phase 2B | Supabase | No | No | Track after review | High | migration/probate tests |
| `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql` | B | Linked access RLS/scope enforcement. | Phase 4 | Supabase | No | No | Track after security review | High | RLS/browser proof |
| `supabase/migrations/20260710120000_trust_contact_auto_invitation.sql` | B | Trust contact auto-invitation schema/function support. | Trust invite remediation | Supabase | No | No | Track after review | High | invite tests |
| `supabase/migrations/20260711120000_category_type_integrity.sql` | B | Finance category/type trigger enforcement. | Category integrity | Supabase | No | No | Track after review | High | category tests |
| `tests/admin-phase1-foundation.test.mjs` | C | Admin foundation tests. | Admin Phase 1 | admin files/migration | No | No | Track | Low | node test |
| `tests/admin-phase2b-probate-cases.test.mjs` | C | Probate case tests. | Phase 2B | probate files/migration | No | No | Track after review | Low | node test |
| `tests/auth-browser-client.test.mjs` | C | Auth client consolidation tests. | Auth remediation | browserAuthClient | No | No | Track | Low | node test |
| `tests/category-dashboard-consistency.test.mjs` | C | Dashboard/category consistency tests. | Category UI remediation | dashboard cards | No | No | Track | Low | node test |
| `tests/category-type-integrity.test.mjs` | C | Category/type integrity tests. | Category integrity | registry/migration | No | No | Track | Low | node test |
| `tests/csp-local-supabase.test.mjs` | C | Local CSP allowance tests. | CSP remediation | proxy | No | No | Track | Low | node test |
| `tests/e2e/admin-role-matrix-local.spec.ts` | C | Local admin role browser proof. | Admin Phase 1 | local Supabase/app | No | No | Track | Medium | Playwright local |
| `tests/e2e/auth-email-local.spec.ts` | C | Local email auth browser proof. | Auth email remediation | local Mailpit | No | No | Track | Medium | Playwright local |
| `tests/e2e/auth-hydration-console.spec.ts` | C | Auth hydration warning proof. | Auth remediation | browser app | No | No | Track | Low | Playwright |
| `tests/e2e/auth-session-phase1.spec.ts` | C | Auth/session persistence proof. | Phase 1 auth | browser app | No | No | Track | Medium | Playwright |
| `tests/e2e/final-uat-contained-fixes.spec.ts` | C | Final UAT contained fixes proof. | UAT remediation | local app | No | No | Track after review | Medium | Playwright |
| `tests/e2e/final-uat-workflows.spec.ts` | C | Full workflow proof. | UAT remediation | local app | No | No | Track after review | Medium | Playwright |
| `tests/e2e/local-uat-review-access.spec.ts` | C | Owner/admin review access browser proof. | Phase 1 review access | local app | No | No | Track | Medium | Playwright local |
| `tests/e2e/phase4-linked-access-revocation.spec.ts` | C | Linked access/revocation browser proof. | Phase 4 | local app/Supabase | No | No | Track | High | Playwright local |
| `tests/e2e/preview-readiness-release-gate.spec.ts` | C | Preview readiness proof. | Preview gate | app/browser | No | No | Review before track | Medium | Playwright |
| `tests/e2e/trust-contact-auto-invitation.spec.ts` | C | Trust auto-invite browser proof. | Trust invite remediation | local email/Supabase | No | No | Track after proof | Medium | Playwright local |
| `tests/e2e/trusts-collapsible-form.spec.ts` | C | Trust form browser proof. | Trust UI remediation | local app | No | No | Track | Low | Playwright |
| `tests/finance-dashboard-rows.test.mjs` | C | Finance dashboard row tests. | Finance remediation | financeRows | No | No | Track | Low | node test |
| `tests/finance-type-selection.test.mjs` | C | Finance type dropdown tests. | Category integrity | fieldDictionary | No | No | Track | Low | node test |
| `tests/legal-linked-contacts.test.mjs` | C | Legal linked-contact UI tests. | Legal contact remediation | UniversalRecordWorkspace | No | No | Track | Low | node test |
| `tests/local-uat-review-access-doc.test.mjs` | C | Review-access doc/script safety test. | Phase 1 review access | docs/scripts | No | No | Track | Low | node test |
| `tests/shared-asset-form-consistency.test.mjs` | C | Shared asset form consistency tests. | Form remediation | UniversalRecordWorkspace | No | No | Track | Low | node test |
| `tests/trust-contact-auto-invitation.test.mjs` | C | Trust invite unit tests. | Trust invite remediation | sendContactInvite | No | No | Track | Low | node test |
| `tests/trust-linked-contact-role-card.test.mjs` | C | Trust linked-contact table/card tests. | Trust contact remediation | UniversalRecordWorkspace | No | No | Track | Low | node test |
| `tests/trusts-collapsible-form.test.mjs` | C | Trust add-form collapse tests. | Trust UI remediation | UniversalRecordWorkspace | No | No | Track | Low | node test |
| `tests/trusts-document-form.test.mjs` | C | Trust/will document form layout tests. | Document form remediation | UniversalRecordWorkspace | No | No | Track | Low | node test |
| `tests/workspace-category-config.test.mjs` | C | Workspace category config tests. | Category remediation | workspaceCategoryConfig | No | No | Track | Low | node test |

## Ignored files that must remain excluded

| File/pattern | Class | Reason | Recommended action |
| --- | --- | --- | --- |
| `.env.local` | E | May contain hosted secrets/categories. | Never commit; use only with explicit target proof. |
| `.env.phase1.local` | E | Local UAT secrets/categories. | Never commit; use for local UAT only. |
| `.env.phase1.local.raw` | E | Local UAT secret copy. | Never commit. |
| `.env.staging.local` | E | Staging secret file. | Never commit. |
| `.env.production*` | E | Production secret files. | Never commit. |
| `.next/` | F | Generated Next build/dev output. | Never commit. |
| `.vercel/` | F | Local Vercel project metadata. | Never commit. |
| `node_modules/` | F | Installed dependencies. | Never commit. |
| `test-results/`, `playwright-report/`, `blob-report/` | F | Test artifacts. | Never commit. |
| `supabase/.temp/`, `supabase/.branches/` | F | Supabase CLI local state. | Never commit. |
| `next-env.d.ts`, `*.tsbuildinfo` | F | Generated TypeScript artifacts. | Never commit. |
