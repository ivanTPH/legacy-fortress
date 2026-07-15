# Project Structure

This file describes the current repository structure based on the code in this repo today.

## Top-level folders

- `app/`
  Next.js App Router routes, layouts, public auth pages, in-app pages, API routes, and some app-scoped UI.
- `components/`
  Shared UI and workspace components used across routes.
- `lib/`
  Shared data, canonical asset mapping, Supabase access, auth/session helpers, dashboard summaries, profile helpers, validation, and document/storage helpers.
- `supabase/`
  Supabase CLI config and SQL migrations.
- `tests/`
  Node tests, Playwright E2E tests, and helper loaders.
- `scripts/`
  Route audits, env validation, link crawling, smoke scripts, and canonical bank verification scripts.
- `public/`
  Static assets such as logos, icons, and brand assets.
- `.github/workflows/`
  CI workflow.

## App routes

## Public/auth routes

- `app/page.tsx`
- `app/sign-in/page.tsx`
- `app/sign-up/page.tsx`
- `app/signin/page.tsx`
  Alias route that redirects to `/sign-in`.
- `app/signup/page.tsx`
  Legacy sign-up route implementation still present.
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/auth/callback/page.tsx`
- `app/auth/complete/route.ts`
- `app/auth/reset-password/page.tsx`
- `app/onboarding/page.tsx`

## In-app routes under `app/(app)`

- Dashboard and shell:
  - `app/(app)/layout.tsx`
  - `app/(app)/dashboard/page.tsx`
- Core sections:
  - `app/(app)/profile/page.tsx`
  - `app/(app)/finances/*`
  - `app/(app)/property/*`
  - `app/(app)/business/page.tsx`
  - `app/(app)/personal/*`
  - `app/(app)/legal/*`
  - `app/(app)/trust/page.tsx`
  - `app/(app)/employment/page.tsx`
  - `app/(app)/cars-transport/page.tsx`
  - `app/(app)/support/page.tsx`
- Vault/older section routes still present:
  - `app/(app)/vault/*`

## Shared component folders

- `components/forms/asset/`
  Shared form controls and config-driven asset field rendering.
- `components/records/`
  Canonical workspace UI. Main file: [UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
- `components/sections/`
  Legacy section-entry workspace. Main file: [SectionWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/sections/SectionWorkspace.tsx)
- `components/documents/`
  Shared attachment/document UI:
  - [DocumentsWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/DocumentsWorkspace.tsx)
  - [AttachmentGallery.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/AttachmentGallery.tsx)
- `components/contacts/`
  Shared contacts network UI:
  - [ContactsNetworkWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/contacts/ContactsNetworkWorkspace.tsx)
- `components/auth/`, `components/assets/`, `components/onboarding/`, `components/ui/`
  Shared auth, modal, onboarding, and primitive UI.

## Canonical workspace pattern

Canonical asset/workspace behavior currently centers on:

- [UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
- [fieldDictionary.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/fieldDictionary.ts)
- Canonical asset readers/normalizers in `lib/assets/*Asset.ts`
- Shared create/update path in [createAsset.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/createAsset.ts)
- Canonical fetch path in [fetchCanonicalAssets.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/fetchCanonicalAssets.ts)
- Sensitive metadata path in [canonicalPersistence.ts](/Users/ivan-imac/legacy-fortress-web/lib/canonicalPersistence.ts)

This pattern is used for current canonical sections such as:

- Bank
- Investments
- Pensions
- Insurance
- Debts
- Property
- Business interests
- Digital assets
- Beneficiaries
- Executors
- Tasks
- Many legal category pages via `UniversalRecordWorkspace`

## Legacy workspace pattern still in use

Legacy `section_entries` pattern still exists in:

- [SectionWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/sections/SectionWorkspace.tsx)
- Routes currently using it:
  - `app/(app)/employment/page.tsx`
  - `app/(app)/cars-transport/page.tsx`
  - `app/(app)/support/page.tsx`
  - `app/(app)/personal/wishes/page.tsx`

These pages still use `public.section_entries` instead of canonical `assets`.

## Data and access layers in `lib/`

- Auth/session:
  - `lib/auth/*`
  - `lib/supabaseClient.ts`
  - `lib/supabaseAdmin.ts`
- Canonical assets:
  - `lib/assets/*`
- Canonical persistence and secure payload handling:
  - `lib/canonicalPersistence.ts`
  - `lib/assets/sensitiveHydration.ts`
- Profile:
- `lib/profile/workspace.ts`
  - `lib/profile/avatarTrace.ts`
- Contacts:
  - `lib/contacts/canonicalContacts.ts`
- Dashboard:
  - `lib/dashboard/*`
- Discovery/filtering:
  - `lib/records/discovery.ts`
- Validation:
  - `lib/validation/*`

## Document and attachment handling

Current document/attachment handling lives in:

- [lib/assets/documentLinks.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/documentLinks.ts)
- [components/documents/DocumentsWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/DocumentsWorkspace.tsx)
- [components/documents/AttachmentGallery.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/AttachmentGallery.tsx)
- [components/records/UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx)
- [components/sections/SectionWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/sections/SectionWorkspace.tsx)

Current canonical contacts handling lives in:

- [lib/contacts/canonicalContacts.ts](/Users/ivan-imac/legacy-fortress-web/lib/contacts/canonicalContacts.ts)
- [components/contacts/ContactsNetworkWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/contacts/ContactsNetworkWorkspace.tsx)
- [app/(app)/personal/contacts/page.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/personal/contacts/page.tsx)
- [app/(app)/components/dashboard/ContactInvitationManager.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/components/dashboard/ContactInvitationManager.tsx)

## Tests and test files

Node tests:

- `tests/menu-key-actions.test.mjs`
- `tests/menu-state.test.mjs`
- `tests/route-parity.test.mjs`
- `tests/auth-and-schema-guards.test.mjs`
- `tests/recovery-flow.test.mjs`
- `tests/asset-live-sync.test.mjs`
- `tests/bank-create-canonical-metadata.test.mjs`
- `tests/canonical-sensitive-hydration.test.mjs`
- `tests/dashboard-canonical-finance-summary.test.mjs`
- `tests/profile-avatar-source.test.mjs`
- `tests/property-rental-schema.test.mjs`

E2E:

- `tests/e2e/auth-and-nav.spec.ts`
- `tests/e2e/helpers/auth.ts`

Helper:

- `tests/helpers/ts-extension-loader.mjs`

## Build and deploy config files

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `playwright.config.ts`
- `supabase/config.toml`
- `.github/workflows/ci.yml`

## Rules for future prompts

- Prefer [UniversalRecordWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/records/UniversalRecordWorkspace.tsx) over adding new page-local CRUD UIs when a category already has canonical asset support.
- Prefer [ConfigDrivenAssetFields.tsx](/Users/ivan-imac/legacy-fortress-web/components/forms/asset/ConfigDrivenAssetFields.tsx) and [fieldDictionary.ts](/Users/ivan-imac/legacy-fortress-web/lib/assets/fieldDictionary.ts) over hardcoded form fields when a canonical config exists.
- Do not introduce new page-level attachment widgets when [AttachmentGallery.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/AttachmentGallery.tsx) or [DocumentsWorkspace.tsx](/Users/ivan-imac/legacy-fortress-web/components/documents/DocumentsWorkspace.tsx) already covers the need.
- Do not add new `SectionWorkspace` routes for categories that can live in canonical `assets`.
- Do not add another read/write path for Bank, Profile avatar, or canonical documents if a shared helper already exists.

## Phase 2 stabilisation map

Phase 2 dirty-file and reproducibility evidence now lives in:

- [PHASE2_BASELINE_INVENTORY.md](/Users/ivan-imac/legacy-fortress-web/docs/stabilisation/PHASE2_BASELINE_INVENTORY.md)
- [DIRTY_FILE_REGISTER.md](/Users/ivan-imac/legacy-fortress-web/docs/stabilisation/DIRTY_FILE_REGISTER.md)

Additional current structure notes:

- Admin foundation routes now use `/admin` as the canonical application dashboard landing route and `/admin/access-denied` as the denial page.
- Internal admin APIs are under `app/api/internal/admin/*` and must continue to use shared admin capability helpers from `lib/admin/*`.
- Probate case APIs are currently under `app/api/internal/admin/probate-cases/*`; treat them as capability-gated operational APIs, not page-local mock routes.
- Local review/proof E2E specs are under `tests/e2e/*local*.spec.ts` and require the local app at `http://127.0.0.1:3012` plus local Supabase at `127.0.0.1:55421`.
- `npm test` now runs deterministic unit/stabilisation/admin-doc checks. Local-Supabase/browser proofs are explicitly named as `npm run test:uat:local` and `npm run test:uat:admin`.
- `npm run uat:validate` validates UAT/staging/local-UAT environment categories without printing secret values; see `scripts/validate-uat-environment.mjs` and `tests/uat-environment-validation.test.mjs`.
- Phase 4D release evidence and controlled commit planning live under `docs/release/PHASE4D_*.md`.

## Phase 3 product and dashboard refinement structure

Phase 3 refinement planning now lives in:

- [OWNER_REVIEW_BACKLOG.md](/Users/ivan-imac/legacy-fortress-web/docs/product/OWNER_REVIEW_BACKLOG.md)
- [DASHBOARD_BOUNDARIES_AND_PRIVACY.md](/Users/ivan-imac/legacy-fortress-web/docs/product/DASHBOARD_BOUNDARIES_AND_PRIVACY.md)
- [DASHBOARD_COMPONENT_STANDARD.md](/Users/ivan-imac/legacy-fortress-web/docs/architecture/DASHBOARD_COMPONENT_STANDARD.md)
- [PHASE3_SELECTED_SLICE.md](/Users/ivan-imac/legacy-fortress-web/docs/product/PHASE3_SELECTED_SLICE.md)

Local-only deterministic fixture definitions live in:

- [phase3SyntheticFixturePack.mjs](/Users/ivan-imac/legacy-fortress-web/tests/fixtures/phase3SyntheticFixturePack.mjs)

The first Phase 3 implementation slice keeps customer category dashboard cards on the shared `DashboardAssetSummaryCard` pattern. Future dashboard work should extend the documented metric/service boundaries before adding new UI.

## Phase 4A customer dashboard structure

Phase 4A adds:

- [CanonicalAssetOverviewGrid.tsx](/Users/ivan-imac/legacy-fortress-web/app/(app)/components/dashboard/CanonicalAssetOverviewGrid.tsx)
- [CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md](/Users/ivan-imac/legacy-fortress-web/docs/architecture/CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md)
- [PHASE4A_SELECTED_SCOPE.md](/Users/ivan-imac/legacy-fortress-web/docs/product/PHASE4A_SELECTED_SCOPE.md)
- [phase4aSyntheticFixturePack.mjs](/Users/ivan-imac/legacy-fortress-web/tests/fixtures/phase4aSyntheticFixturePack.mjs)
- [phase4a-customer-dashboard-data-proof.test.mjs](/Users/ivan-imac/legacy-fortress-web/tests/phase4a-customer-dashboard-data-proof.test.mjs)
- [phase4a-customer-dashboard-consistency.spec.ts](/Users/ivan-imac/legacy-fortress-web/tests/e2e/phase4a-customer-dashboard-consistency.spec.ts)

Selected canonical overview pages are `/property`, `/business`, `/vault/digital`, and `/vault/personal`. These pages read canonical `assets` through shared helpers and render count-only summaries through `DashboardAssetSummaryCard`.
