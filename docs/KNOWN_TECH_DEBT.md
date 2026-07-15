# Known Tech Debt

Only confirmed repo issues or duplication are listed here.

## High severity

- Linked-access RLS scope required Phase 4 remediation
  - Files:
    - [lib/access-control/viewerAccess.ts](/Users/ivan-imac/legacy-fortress-web/lib/access-control/viewerAccess.ts)
    - [lib/admin/probateCases.ts](/Users/ivan-imac/legacy-fortress-web/lib/admin/probateCases.ts)
    - `supabase/migrations/20260324103000_contact_invitation_view_only_access.sql`
    - `supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql`
  - Issue:
    - Phase 4 local browser proof originally showed that after a probate reviewer approves a scoped linked grant, the customer UI only displayed the approved property and hid unrelated finance records, but a direct local REST query to `assets` for the owner returned both the approved property and an unrelated private bank asset.
  - Impact:
    - Before remediation, fine-grained probate-case scope was enforced by client filtering through `permissions_override` and contact links, while RLS still granted broad owner-row read access for active linked users.
  - Current status:
    - Remediated locally on 2026-07-03 in `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql`. The migration adds scoped linked-grant helper functions and replaces broad linked-select policies for canonical records/documents/attachments/storage with exact asset/record/document scope checks.
  - Remaining follow-up:
    - Apply and prove the migration in staging before pilot. Keep `tests/e2e/phase4-linked-access-revocation.spec.ts` in the release gate so any regression in direct REST denial blocks release.

- Phase 5 staging pre-flight is not yet available
  - Files:
    - [supabase/migrations/20260703153000_linked_access_scope_enforcement.sql](/Users/ivan-imac/legacy-fortress-web/supabase/migrations/20260703153000_linked_access_scope_enforcement.sql)
    - [docs/BUILD_AND_RELEASE.md](/Users/ivan-imac/legacy-fortress-web/docs/BUILD_AND_RELEASE.md)
  - Issue:
    - The linked-access RLS remediation is proven locally, but no approved staging target, migration history, backup/restore proof, rollback owner or synthetic-data permission has been provided.
  - Impact:
    - Limited pilot readiness cannot be claimed until the same migration is applied and independently re-proven in staging.
  - Current mitigation:
    - Treat staging as blocked pending pre-flight approval. Do not apply hosted migrations or run hosted browser UAT until staging isolation and rollback are confirmed.
  - 2026-07-04 continuation:
    - Staging approval was granted, but no secure staging environment configuration was available in the shell. No hosted migration or hosted browser UAT was performed.
  - 2026-07-04 Phase 5A:
    - Added repository-only staging setup guidance and a non-secret ignored `.env.staging.example` placeholder. Staging remains unconfigured until secure values are supplied outside the repository.
  - 2026-07-04 Phase 5B:
    - Cloud staging remains unavailable. The package is suitable for controlled local internal UAT only after excluding local-only/review-sensitive files. Limited pilot still requires a hosted staging or equivalent non-production re-proof.
  - 2026-07-04 Phase 3 hosted staging readiness:
    - Added [HOSTED_STAGING_READINESS_PLAN.md](./HOSTED_STAGING_READINESS_PLAN.md) as the staging prerequisites, migration safety, hosted browser/RLS proof and canonical contact architecture source. This is a documentation/readiness step only; no hosted staging target was contacted or proven.

- Canonical contact consolidation remains an approved design, not fully retired legacy compatibility
  - Files:
    - [docs/HOSTED_STAGING_READINESS_PLAN.md](/Users/ivan-imac/legacy-fortress-web/docs/HOSTED_STAGING_READINESS_PLAN.md)
    - [components/contacts/ContactsNetworkWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/contacts/ContactsNetworkWorkspace.tsx)
    - [lib/contacts/canonicalContacts.ts](/Users/ivan-imac/legacy-fortress-web/lib/contacts/canonicalContacts.ts)
    - `supabase/migrations/20260323183000_canonical_contacts_phase1.sql`
    - `supabase/migrations/20260323191500_backfill_canonical_contacts_phase2.sql`
  - Issue:
    - The repository has a canonical `contacts` direction, but invitations, next-of-kin, executor, probate and section compatibility contexts still need a controlled migration/retirement path.
  - Impact:
    - Without a staged reconciliation and browser proof, contact names or permissions can diverge across trusted-contact, executor, invitation and probate views.
  - Current mitigation:
    - Do not create page-specific contact models. Use the canonical contact plan in `HOSTED_STAGING_READINESS_PLAN.md`; retire compatibility paths only after owner-scoped backfill, duplicate review, role/access proof and rollback are complete.

- Review-sensitive local packaging drift
  - Files:
    - [supabase/config.toml](/Users/ivan-imac/legacy-fortress-web/supabase/config.toml)
    - [tsconfig.json](/Users/ivan-imac/legacy-fortress-web/tsconfig.json)
  - Issue:
    - `supabase/config.toml` contains isolated local UAT project id, ports, site URL/email redirect, edge-runtime and analytics settings.
    - `tsconfig.json` contains formatting churn and a generated `.next/dev/dev/types/**/*.ts` include.
  - Impact:
    - These files can confuse release packaging or deploy behaviour if committed without review.
  - Current mitigation:
    - Exclude both from any future internal-UAT commit/deployment package unless explicitly reviewed and approved.
  - 2026-07-14 Phase 4D:
    - `docs/release/PHASE4D_SUPABASE_CONFIG_DISPOSITION.md` classifies the current `supabase/config.toml` diff as local-UAT only and excluded from release.

- Historical credential-like value remains a pre-push owner decision
  - Files:
    - [docs/BUILD_AND_RELEASE.md](/Users/ivan-imac/legacy-fortress-web/docs/BUILD_AND_RELEASE.md)
    - [docs/release/PHASE4D_CREDENTIAL_REMEDIATION_DECISION.md](/Users/ivan-imac/legacy-fortress-web/docs/release/PHASE4D_CREDENTIAL_REMEDIATION_DECISION.md)
  - Issue:
    - A password-like value is no longer present in the working tree but remains in branch history from an older commit.
  - Impact:
    - The branch must not be pushed until the owner confirms whether it was real, rotates any affected account/category if uncertain, and decides whether history remediation is required.
  - Current mitigation:
    - Treat as a potential exposed credential. Do not reproduce the value in docs, logs or reports.

- Hosted UAT isolation remains configuration-only until real values are validated
  - Files:
    - [scripts/validate-uat-environment.mjs](/Users/ivan-imac/legacy-fortress-web/scripts/validate-uat-environment.mjs)
    - [tests/uat-environment-validation.test.mjs](/Users/ivan-imac/legacy-fortress-web/tests/uat-environment-validation.test.mjs)
    - [docs/release/PHASE4D_HOSTED_UAT_ISOLATION_GATE.md](/Users/ivan-imac/legacy-fortress-web/docs/release/PHASE4D_HOSTED_UAT_ISOLATION_GATE.md)
  - Issue:
    - The validator and checklist exist, but no hosted UAT environment was contacted or proven in Phase 4D.
  - Impact:
    - A future UAT deployment must supply separate app, database, storage, auth, email, Stripe and URL categories before browser proof.
  - Current mitigation:
    - `npm run uat:validate` fails closed unless explicit UAT/staging/local-UAT categories are supplied.

- Mixed canonical and legacy workspace stacks
  - Files:
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
    - [components/sections/SectionWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/sections/SectionWorkspace.tsx)
    - `app/(app)/employment/page.tsx`
    - `app/(app)/cars-transport/page.tsx`
    - `app/(app)/support/page.tsx`
    - `app/(app)/personal/wishes/page.tsx`
  - Issue:
    - The app still uses both canonical `assets/documents` and legacy `section_entries/file_path` patterns.

- Auth route usage is not fully normalized
  - Files:
    - [app/sign-in/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/sign-in/page.tsx)
    - [app/signin/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/signin/page.tsx)
    - multiple `router.replace("/signin")` references across `app/` and `components/`
  - Issue:
    - Both `/sign-in` and `/signin` are still referenced in the codebase.

## Medium severity

- Duplicate document storage models
  - Files:
    - [lib/assets/documentLinks.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/documentLinks.ts)
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
    - `supabase/migrations/20260309113000_add_universal_record_pattern_tables.sql`
  - Issue:
    - `public.documents` and `public.attachments` both exist and are both read by current workspaces.

- Legacy `file_path` still exists in active paths
  - Files:
    - [components/sections/SectionWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/sections/SectionWorkspace.tsx)
    - `app/(app)/vault/[section]/[id]/page.tsx`
    - `supabase/migrations/20260307190000_route_parity_workspace_tables.sql`
    - `supabase/migrations/20260315162000_canonical_wallet_asset_document_model.sql`
  - Issue:
    - Old single-file attachment shape is still present in schema and some route logic.

- Hardcoded forms still exist where canonical config is not yet adopted
  - Files:
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
  - Issue:
    - Bank/property/beneficiary/executor/task use config-driven fields, but several categories still render hardcoded field groups inside the same workspace.

 - Service-role admin flows depend on local secret quality
  - Files:
    - [.env.local](/Users/ivan-imac/legacy-fortress-web/.env.local)
    - [lib/supabaseAdmin.ts](/Users/ivan-imac/legacy-fortress-web/lib/supabaseAdmin.ts)
    - [app/api/health/schema/route.ts](/Users/ivan-imac/legacy-fortress-web/app/api/health/schema/route.ts)
  - Issue:
    - A truncated `SUPABASE_SERVICE_ROLE_KEY` causes admin verification and seed flows to fail with 401 even when anon-authenticated app flows still work.

## Low severity

- App routes and older vault routes overlap
  - Files:
    - `app/(app)/property/page.tsx`
    - `app/(app)/vault/property/page.tsx`
    - `app/(app)/vault/financial/page.tsx`
    - `app/(app)/vault/legal/page.tsx`
    - `app/(app)/vault/business/page.tsx`
    - `app/(app)/vault/digital/page.tsx`
  - Issue:
    - Multiple navigation surfaces still coexist for related data domains.

- Development/smoke tracing is embedded in production app code paths
  - Files:
    - [app/(app)/layout.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/layout.tsx)
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
    - [lib/devSmoke.ts](/Users/ivan-imac/legacy-fortress-web/lib/devSmoke.ts)
  - Issue:
    - Debug and trace hooks are guarded, but the production code paths still carry substantial dev-smoke instrumentation.
  - Current mitigation:
    - Production observability should stay routed through `/api/observability/client-events` with allowlisted, sanitized event names. Do not add new broad console logging or raw payload capture in user-facing components.

- Auth client consolidation warning remains visible during local browser UAT
  - Files:
    - [lib/supabaseClient.ts](/Users/ivan-imac/legacy-fortress-web/lib/supabaseClient.ts)
    - auth entry/session components under `components/auth/` and `app/(app)/layout.tsx`
  - Issue:
    - The 2026-07-02 Phase 3 browser UAT still observed the Supabase warning about multiple `GoTrueClient` instances in the same browser context.
  - Current mitigation:
    - 2026-07-04 Phases 6-8 narrowed the browser-side duplicate-client source to sign-up/password-reset helper clients and moved those paths to purpose-scoped non-persistent clients in `lib/auth/browserAuthClient.ts`.
    - Browser console proof for `/`, `/sign-in`, `/sign-up`, `/forgot-password` and invalid reset link passed without hydration or Multiple GoTrueClient warnings.
    - Continue monitoring admin/probate/test harness flows; do not add new browser `createClient` calls without an explicit storage/session isolation reason.

- Dashboard discovery and global navigation search are easy to confuse
  - Files:
    - [app/(app)/dashboard/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/dashboard/page.tsx)
    - [app/(app)/layout.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/layout.tsx)
  - Issue:
    - Phase 3 proved dashboard discovery through `/dashboard?search=...`; the visible sidebar search field is not the same result surface and did not prove the dashboard bank-record search.
  - Current mitigation:
    - 2026-07-04 Phases 6-8 clarified the sidebar search as dashboard-record search, added a dashboard result-scope heading, clearer empty state and clear/reset action.
    - Release/UAT scripts should still exercise direct `/dashboard?search=...`, module-level search and sidebar search separately.

- Legacy section attachment storage remains compatibility code
  - Files:
    - [components/sections/SectionWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/sections/SectionWorkspace.tsx)
    - [components/documents/AttachmentGallery.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/AttachmentGallery.tsx)
  - Issue:
    - `SectionWorkspace` still stores attachment metadata in `section_entries.details.attachments`; it now uses the shared gallery and user-scoped storage prefix, but it is not the canonical `documents` path.
  - Current mitigation:
    - Keep it as compatibility-only until an approved backfill moves remaining section entries to canonical assets/documents.

- Legacy non-monetary records need compatibility values
  - Files:
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
  - Issue:
    - Legal/wishes document-style records should not show monetary capture, but the existing legacy `records` table still rejects null `value_minor` and `currency_code`.
  - Current mitigation:
    - The UI remains non-monetary while legacy writes use `0` and `GBP` solely to satisfy the current table constraint. A future migration should relax or retire those columns for document-style compatibility rows.

- Commercial positioning stops short of billing implementation
  - Files:
    - [app/onboarding/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/onboarding/page.tsx)
    - [app/sign-in/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/sign-in/page.tsx)
    - [app/signup/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/signup/page.tsx)
    - [app/(app)/layout.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/layout.tsx)
  - Issue:
    - The app now positions itself as a premium secure service, but upgrade and plan surfaces remain copy-only until billing/product packaging is implemented.

- Plan framework is readiness-only, not a live payments stack
  - Files:
    - [lib/accountPlan.ts](/Users/ivan-imac/legacy-fortress-web/lib/accountPlan.ts)
    - [app/(app)/account/billing/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/account/billing/page.tsx)
    - [app/api/billing/portal/route.ts](/Users/ivan-imac/legacy-fortress-web/app/api/billing/portal/route.ts)
  - Issue:
    - Owner plan state and starter/premium gating now exist, but live checkout, invoicing, dunning, and provider webhooks are still future work.

## Rules for future prompts

- Do not add another legacy CRUD pattern when `UniversalRecordWorkspace` or a canonical asset helper already exists.
- Do not add page-level duplicate attachment UIs when [AttachmentGallery.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/AttachmentGallery.tsx) or [DocumentsWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/DocumentsWorkspace.tsx) already covers the need.
- Do not add hardcoded fields to a category that already has a config in [fieldDictionary.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/fieldDictionary.ts).
- Normalize routes to the current public auth path (`/sign-in`) instead of introducing more alias dependence.
- Remove legacy `section_entries`/single-file compatibility only after a backfill, route parity proof, rollback plan, and release smoke coverage exist. Until then, treat it as compatibility code rather than dead code.
 - Seeded canonical contacts may retain compatibility contexts without a real linked record
  - Files:
    - [scripts/seed-bill-smith-review-account.mjs](/Users/ivan-imac/legacy-fortress-web/scripts/seed-bill-smith-review-account.mjs)
    - [lib/contacts/canonicalContacts.ts](/Users/ivan-imac/legacy-fortress-web/lib/contacts/canonicalContacts.ts)
  - Issue:
    - Context cleanup now prefers live `contact_links`, but intentionally retains unmatched compatibility contexts such as the synthetic trustee placeholder when there is no real linked trust record yet.

## Phase 2 architecture drift findings

- Dirty tree is large and cross-cutting
  - Files:
    - [DIRTY_FILE_REGISTER.md](/Users/ivan-imac/legacy-fortress-web/docs/stabilisation/DIRTY_FILE_REGISTER.md)
  - Issue:
    - The current local UAT state contains over 100 dirty/untracked files across app UI, admin APIs, migrations, tests, docs and local config. It is reviewable only because Phase 2 now classifies it; it is not yet a small release branch.
  - Recommendation:
    - Use the register to create a future commit plan by phase: customer vault UI, admin foundation/probate, migrations, local UAT harness, docs/tests.

- `UniversalRecordWorkspace` is carrying too much category-specific behavior
  - Files:
    - [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
    - [lib/assets/fieldDictionary.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/fieldDictionary.ts)
  - Issue:
    - Shared CRUD, attachments, contact linking, will/trust-specific layout, dashboard create state and compatibility writes are still concentrated in one large component.
  - Recommendation:
    - Extract only after the current UAT behavior is locked: shared record list, shared form chrome, shared linked-contact table, shared document dropzone. Do not create page-specific forks.

- Admin/probate APIs need staging reset proof before pilot
  - Files:
    - `app/api/internal/admin/*`
    - `lib/admin/*`
    - `supabase/migrations/20260630170000_admin_phase1_foundation.sql`
    - `supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql`
    - `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql`
  - Issue:
    - Local browser proof exists from prior phases, but Phase 2 did not perform a fresh database reset or hosted staging proof.
  - Recommendation:
    - Before pilot, apply migrations to a disposable staging database, run the role matrix, linked-access revocation proof and audit-history proof, then document rollback.

- Local and deployable config are still easy to confuse
  - Files:
    - [supabase/config.toml](/Users/ivan-imac/legacy-fortress-web/supabase/config.toml)
    - `.env.local`
    - `.env.phase1.local`
    - `.env.example`
    - `.env.staging.example`
  - Issue:
    - Local Supabase CLI `site_url` must stay local for email confirmation, but production redirects must remain allow-listed. `.env.local` may point to hosted services and is not the local-UAT source of truth.
  - Recommendation:
    - Keep env values out of reports. Use key/category checks only. Require target proof before browser/auth/database testing.

- `tsconfig.json` remains review-sensitive
  - Files:
    - [tsconfig.json](/Users/ivan-imac/legacy-fortress-web/tsconfig.json)
  - Issue:
    - The file is dirty and affects build/type behavior. Phase 2 did not attribute all changes to a specific user story.
  - Recommendation:
    - Keep it in the review-sensitive bucket until `npx tsc --noEmit --pretty false` and build pass after final release packaging.

- Local browser test fixtures share synthetic accounts
  - Files:
    - [tests/e2e/admin-role-matrix-local.spec.ts](/Users/ivan-imac/legacy-fortress-web/tests/e2e/admin-role-matrix-local.spec.ts)
    - [tests/e2e/local-uat-review-access.spec.ts](/Users/ivan-imac/legacy-fortress-web/tests/e2e/local-uat-review-access.spec.ts)
  - Issue:
    - Both suites reset passwords for overlapping `uat.*@local.test` accounts. Running them in parallel can create an invalid-login race.
  - Recommendation:
    - Run these suites serially for release gates or give each suite a unique synthetic email namespace.

- Enterprise/licence dashboard remains a requirements track, not an implemented product surface
  - Files:
    - [DASHBOARD_BOUNDARIES_AND_PRIVACY.md](/Users/ivan-imac/legacy-fortress-web/docs/product/DASHBOARD_BOUNDARIES_AND_PRIVACY.md)
    - [OWNER_REVIEW_BACKLOG.md](/Users/ivan-imac/legacy-fortress-web/docs/product/OWNER_REVIEW_BACKLOG.md)
  - Issue:
    - The owner needs an enterprise/licence control experience, but organisation-level isolation, licence entitlements, enterprise permissions, exports and billing visibility are not yet implemented or proven.
  - Recommendation:
    - Keep enterprise work behind explicit future prompts. Do not expose platform-wide or private vault data to enterprise users until at least two synthetic organisations prove cross-organisation denial.

- Dashboard metrics must stay tied to named data services
  - Files:
    - [lib/admin/dashboardSummary.ts](/Users/ivan-imac/legacy-fortress-web/lib/admin/dashboardSummary.ts)
    - [DASHBOARD_BOUNDARIES_AND_PRIVACY.md](/Users/ivan-imac/legacy-fortress-web/docs/product/DASHBOARD_BOUNDARIES_AND_PRIVACY.md)
  - Issue:
    - Metrics such as stale wills, old documents, failed emails and incomplete vaults can be misread if UI labels drift from the actual calculation.
  - Recommendation:
    - Add or update a named server-side metric calculation before adding any new dashboard label. Tests should compare service output with direct local database truth where possible.

- Phase 4A canonical overview coverage is intentionally partial
  - Files:
    - [CanonicalAssetOverviewGrid.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/components/dashboard/CanonicalAssetOverviewGrid.tsx)
    - [CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md](/Users/ivan-imac/legacy-fortress-web/docs/architecture/CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md)
  - Issue:
    - Property, business, digital and possessions now have count-aware canonical overview tiles, but finance and legal still use mixed compatibility paths and several routes remain `section_entries` based.
  - Recommendation:
    - Do not expand dashboard proof claims until each remaining route has a documented canonical source, migration/backfill plan, browser proof and rollback boundary.
