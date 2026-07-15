# Build And Release

This file records the current build, test, and deployment workflow as defined in the repo today.

Hosted staging readiness: before any hosted staging deployment or migration, follow [HOSTED_STAGING_READINESS_PLAN.md](./HOSTED_STAGING_READINESS_PLAN.md). It records the current hosted blockers, packaging exclusions, migration checklist, browser/API/RLS UAT matrix and canonical contact architecture. As of 2026-07-04 the app remains suitable for controlled local internal UAT only; hosted staging, external pilot and production require separate approval and proof.

Phase 4C UAT safety gate: before any Coolify UAT push or deployment, review `docs/release/PHASE4C_MIGRATION_REPLAY_EVIDENCE.md`, `docs/release/PHASE4C_UAT_PRESENTATION_CONTROLS.md`, `docs/release/PHASE4C_UAT_ISOLATION_VALIDATION.md`, `docs/release/PHASE4C_LIVE_DEPLOYMENT_IDENTIFICATION.md`, and `docs/product/OWNER_ADMIN_AND_ENTERPRISE_REVIEW_GUIDE.md`. UAT must use a separate application, separate Supabase/auth/storage/email/billing categories, visible UAT labelling and noindex/nofollow metadata. Do not push or deploy until the current live Coolify branch and commit have been owner-verified.

Phase 4D pre-push gate: before controlled commits, review `docs/release/PHASE4D_FINAL_COMMIT_MANIFEST.md`, `docs/release/PHASE4D_DEPENDENCY_AUDIT_RESOLUTION.md`, `docs/release/PHASE4D_CREDENTIAL_REMEDIATION_DECISION.md`, `docs/release/PHASE4D_SUPABASE_CONFIG_DISPOSITION.md`, `docs/release/PHASE4D_HOSTED_UAT_ISOLATION_GATE.md`, and `docs/release/PHASE4D_UPGRADE_PATH_MIGRATION_EVIDENCE.md`. Do not push until live Coolify source is owner-verified, the credential-history decision is resolved, UAT isolation is configured, and `supabase/config.toml` is excluded or separately approved.

## Local setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Required env values from [.env.example](/Users/ivan-imac/legacy-fortress-web/.env.example):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Optional / environment-dependent values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ENABLE_EDGE_AUTH_REDIRECT`
- `STRIPE_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_ID`
- `APPLE_CLIENT_ID`

## Local run commands

Defined in [package.json](/Users/ivan-imac/legacy-fortress-web/package.json):

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run validate:env
npm run audit:routes
npm run crawl:links
npm run matrix:routes
npm run test:navigation
npm run test:core
npm run test:stabilisation
npm run release:check
npm run uat:validate
npm run test:e2e
npm run smoke:mobile:core
npm run smoke:mobile:polish
npm run smoke:authenticated:ux
npm run smoke:production:core
npm run smoke:production:strict
npm run smoke:local:dashboard-bank
```

Common direct commands used in this repo:

```bash
./node_modules/.bin/tsc --noEmit --pretty false
node --loader ./tests/helpers/ts-extension-loader.mjs --test tests/<file>.test.mjs
```

## Build behavior

- Next.js build command:

```bash
npm run build
```

- Actual configured build:
  - `next build --webpack`
- Next config:
  - [next.config.ts](/Users/ivan-imac/legacy-fortress-web/next.config.ts)
  - `reactCompiler: true`

## Playwright

Configured in [playwright.config.ts](/Users/ivan-imac/legacy-fortress-web/playwright.config.ts):

- default base URL: `http://127.0.0.1:3000`
- auto-starts local dev server if `PLAYWRIGHT_BASE_URL` is not set
- projects:
  - Desktop Chrome
  - iPhone 13
  - Pixel 7

## CI

GitHub Actions workflow:

- [ci.yml](/Users/ivan-imac/legacy-fortress-web/.github/workflows/ci.yml)

Current CI runs:

```bash
npm ci
npm run release:check -- --ci
```

`release:check` runs the dependency audit, lint, TypeScript, core tests, stabilisation tests, route audit, link crawl, and production build. Local runs also validate `.env.local` when it is present; CI skips local env validation because Vercel/Supabase secrets are environment-specific.

For mobile regression checks, run `npm run smoke:mobile:core` or `npm run smoke:mobile:polish` against a local server, or set `BASE_URL=https://legacy-fortress.vercel.app` to verify the live demo dashboard, bank, contacts, and auth recovery routes on an iPhone 13 viewport.

For a production-safe authenticated journey, run:

```bash
BASE_URL=https://legacy-fortress.vercel.app npm run smoke:authenticated:ux
```

That smoke uses the seeded demo session, checks protected dashboard navigation, verifies the topbar/sidebar avatar surface remains stable after hydration and route changes, checks authenticated mobile overflow, and fails if Material Symbols ligature text leaks into the UI.

For strict performance gating, run:

```bash
BASE_URL=https://legacy-fortress.vercel.app npm run smoke:production:strict
```

Use the strict command when promoting a release candidate. The softer `smoke:production:core` command remains useful for live monitoring because it reports route timing warnings without blocking investigation.

## Observability

The app has a lightweight client event endpoint at `/api/observability/client-events`. It accepts only allowlisted, non-sensitive events such as auth callback outcomes, strips email/token/password/secret/phone-like fields, and uses `Cache-Control: no-store`.

Current client events are deliberately narrow:

- `auth.callback.*` for verification, exchange, missing-session, redirect, and recovery outcomes.
- `profile.avatar.*` and `shell.navigation.*` are reserved for targeted UI stability checks.

This is not a replacement for a full monitoring provider, but it gives production logs enough shape to diagnose auth-link and hydration failures without exposing private user data.

## Supabase local config

Defined in [supabase/config.toml](/Users/ivan-imac/legacy-fortress-web/supabase/config.toml):

- local API port: `54321`
- local DB port: `54322`
- Studio port: `54323`
- Inbucket port: `54324`
- storage enabled
- auth enabled
- `extra_search_path = ["public", "extensions"]`
- seeds enabled via `./seed.sql`

### Isolated local UAT override

Some local UAT sessions run Legacy Fortress alongside another Supabase project. In that case, do not overwrite `.env.local` or commit local keys. Use an ignored, command-scoped env wrapper such as `.env.phase1.local` and confirm in browser/network diagnostics that the app talks only to the isolated local Supabase API origin before creating users or signing in.

The 2026-07-02 Phase 3 UAT used:

- app URL: `http://localhost:3012`
- local Supabase API origin: `http://127.0.0.1:55421`
- database port: `55422`
- Studio port: `55423`
- Mailpit port: `55424`

Those port values are local UAT facts, not production deployment configuration.

### Phase 4 linked-access release gate

The customer-side linked executor/probate gate verifies browser behaviour and direct REST/RLS denial for unrelated owner assets and document metadata. The durable browser gate is:

```bash
set -a; source .env.phase1.local; set +a; PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/phase4-linked-access-revocation.spec.ts --project=desktop-chromium
```

As of 2026-07-03 this test passes locally after `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql`. Do not pilot probate/linked access in staging or production until that migration is applied in the target environment and this gate passes against non-production data.

### Phase 5 staging release gate

As of 2026-07-04, staging migration/re-proof has not been run because no approved staging environment, migration history, backup/restore procedure or rollback owner was provided. Do not apply `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql` to any hosted project until the staging pre-flight is complete.

Continuation note: later on 2026-07-04, staging approval was granted but the secure staging environment variables were not available to the shell. No hosted staging check or migration was performed. Re-run this gate only after the secure local staging configuration is loaded.

Secure configuration preparation: use [STAGING_ENVIRONMENT_SETUP.md](./STAGING_ENVIRONMENT_SETUP.md) and the ignored `.env.staging.example` placeholder to prepare non-secret staging handover. Do not put real URLs, keys, ids, tokens or connection strings in repository files.

### Phase 5B local internal-UAT package gate

As of 2026-07-04, no separate cloud staging environment is available. The current release package can support controlled local internal UAT only.

Include in a future reviewed internal-UAT package:

- Phase 1-4 admin/probate/security application changes.
- Migrations `20260630170000_admin_phase1_foundation.sql`, `20260701193000_admin_phase2b_probate_cases.sql`, and `20260703153000_linked_access_scope_enforcement.sql`.
- Focused admin/probate/linked-access tests and Phase 4 Playwright gate.
- Documentation and safe non-secret templates.

Exclude unless separately reviewed:

- `supabase/config.toml`, because it contains isolated local UAT ports, local site URL/email redirect settings, disabled edge runtime and disabled analytics.
- `tsconfig.json`, because it contains formatting churn and a generated `.next/dev/dev/types/**/*.ts` include.
- `.env.local`, `.env.phase1.local`, `.env.phase1.local.raw`, `.env.staging.local`, database dumps, storage objects, screenshots, `.next` and `test-results`.

Required local gate before internal UAT:

```bash
npm run test:stabilisation
node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/invitation-linked-access.test.mjs tests/viewer-access-permissions.test.mjs
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/phase4-linked-access-revocation.spec.ts --project=desktop-chromium
npm run lint
npm run build
curl -sS http://127.0.0.1:3012/api/health/schema
```

The 2026-07-04 Phase 5B run passed all of the above against the local UAT environment.

Minimum staging pre-flight:

- Confirm the target is staging and not production.
- Confirm the database is not shared with production.
- Confirm synthetic `staging-phase5-*` accounts/data are permitted.
- Confirm backup/checkpoint and rollback owner.
- Confirm prerequisite migrations are present and `20260703153000` is absent.
- Capture existing linked-access policies/functions before apply.

Minimum staging re-proof after apply:

- Phase 1 admin tests.
- Phase 2B probate/access tests.
- linked-access permission tests.
- Phase 4 Playwright linked-access revocation test against staging-safe synthetic data.
- `npm run test:stabilisation`.
- `npm run lint`.
- `npm run build`.
- staging schema health check.
- Browser proof that unrelated records, document metadata, storage objects, dashboard totals and search results are denied before grant, after scoped grant and after revocation.

Do not include local-only `supabase/config.toml` changes or local env/test data in staging release packaging without separate explicit review.

## Deployment notes

- Repo is configured for Vercel deployment.
- Supabase auth redirect URLs in `supabase/config.toml` include:
  - localhost callback/reset
  - Vercel production callback/reset
  - Vercel `/sign-in`

From the repo, deployment-related truth currently lives in:

- [README.md](/Users/ivan-imac/legacy-fortress-web/README.md)
- [supabase/config.toml](/Users/ivan-imac/legacy-fortress-web/supabase/config.toml)
- [.github/workflows/ci.yml](/Users/ivan-imac/legacy-fortress-web/.github/workflows/ci.yml)

## Live migration and review-account verification

Current live data hardening flow used in this repo:

```bash
supabase migration list --linked
supabase db push --linked --include-all --yes
set -a && source .env.local && export E2E_USER_EMAIL='<synthetic-review-email>' E2E_USER_PASSWORD='<synthetic-review-password>' && set +a && node scripts/seed-bill-smith-review-account.mjs
./node_modules/.bin/tsc --noEmit --pretty false
node --loader ./tests/helpers/ts-extension-loader.mjs --test tests/canonical-contacts.test.mjs tests/bank-create-canonical-metadata.test.mjs tests/dashboard-canonical-finance-summary.test.mjs
```

Key migrations applied in the live fix:

- `20260323183000_canonical_contacts_phase1.sql`
- `20260323191500_backfill_canonical_contacts_phase2.sql`
- `20260323201500_contacts_user_id_compat.sql`

Expected seeded review-account pages to inspect after the seed runs:

- `/app/dashboard`
- `/finances/bank`
- `/vault/property`
- `/trust`
- `/vault/personal`
- `/personal/contacts`

What to verify on those pages:

- seeded Bill Smith profile and dashboard summaries
- canonical attachment summaries on saved bank/property/executor cards
- legacy attachment summaries on saved personal cards
- in-app preview for supported file types
- download fallback for non-previewable office-style files
- canonical contacts network and invitation states

## Onboarding and commercial-positioning conventions

- New owners should be routed through:
  - `/app/onboarding` when setup is incomplete
  - `/account/terms` when terms acceptance is still required
  - `/app/dashboard` only after those checks pass
- Onboarding copy should keep five priorities visible:
  - profile
  - finances
  - legal
  - people / contacts
  - tasks / follow-up
- Linked invitees should see:
  - a clear role label
  - clear view-only messaging
  - a low-pressure CTA to start their own secure account
- Demo reviewers should see:
  - synthetic-data disclosure
  - a fast path into dashboard, finances, legal, and contacts
  - no admin controls

## Pre-billing commercial gaps

- Plan/value positioning is now present in core UX copy, but there is still no live billing or payment collection flow.
- Upgrade prompts for linked users are informational only and should stay low-pressure until billing is implemented.
- Do not add hard paywall logic without updating onboarding, linked-access messaging, and admin/support handling together.

## Plan framework conventions

- Commercial plan state is separate from access role state.
- Current account model:
  - owner
  - linked view-only
  - demo reviewer
  - admin internal
- Current stored owner plan model lives on `billing_profiles`:
  - `account_plan`
  - `plan_status`
  - `plan_source`
  - `trial_ends_at`
  - `record_limit`
  - `invitation_limit`
- Current first-pass gates:
  - owner record creation volume
  - owner invitation sending volume
- Do not apply commercial gating to:
  - linked invitee read-only access
  - demo reviewer access
  - isolated admin operations

## Known build and release sensitivities

- The repo contains both `/sign-in` and legacy `/signin` route usage in code. Alias route exists, but references are not fully normalized.
- The repo contains both canonical asset workspaces and older `section_entries`-based pages. Feature work can accidentally land in the wrong stack.
- Some tests use direct Node test commands with the TypeScript extension loader instead of npm scripts.
- Sensitive asset hydration depends on database RPC support and migrations being present.
- Local and deployed behavior can diverge if Vercel is not rebuilt after app-shell/auth/avatar changes.
- `SUPABASE_SERVICE_ROLE_KEY` must be a full three-part JWT. In this workspace, the `.env.local` value was present but truncated, which caused 401 failures for admin flows even though the app could still work via anon auth.

## 2026-07-04 Phases 6-8 Local Release Gate

Use the existing local-only environment mechanism and isolated local Supabase services before running these checks. Do not run them against hosted production or real users.

Commands run and passed:

```bash
node --test tests/auth-browser-client.test.mjs tests/dashboard-ui-consistency.test.mjs tests/platform-architecture-stabilisation.test.mjs tests/contact-editing.test.mjs tests/canonical-contact-reuse.test.mjs tests/executors-unification.test.mjs tests/people-role-unification.test.mjs tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/invitation-linked-access.test.mjs tests/viewer-access-permissions.test.mjs tests/linked-document-preview.test.mjs tests/contact-permissions.test.mjs
npm run test:stabilisation
npm run lint
npm run build
curl -sS http://127.0.0.1:3012/api/health/schema
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/auth-hydration-console.spec.ts tests/e2e/auth-session-phase1.spec.ts tests/e2e/phase4-linked-access-revocation.spec.ts --project=desktop-chromium
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/final-uat-contained-fixes.spec.ts tests/e2e/final-uat-workflows.spec.ts --project=desktop-chromium --grep "executors route|Legal wills|Attachments:|Dashboard counts|Mobile release smoke"
```

Observed local performance, not benchmark-grade:

- Auth-page console checks: acceptable, each page loaded in roughly 1-8 seconds locally.
- Auth/session deep-link flow: slow but acceptable at roughly 33 seconds for a full sign-in/refresh/navigation/sign-out scenario.
- Phase 4 linked-access revocation: slow but acceptable at roughly 39 seconds for the full grant/revoke/API/audit browser journey.
- Attachment lifecycle: acceptable at roughly 24 seconds for canonical plus legacy upload/preview/download/print/replace/remove.
- Dashboard count proof: slow at roughly 70 seconds for finance/property/business create/edit/delete/refresh/re-login count checks.
- Mobile smoke: acceptable at roughly 18 seconds.

Current release stance: controlled local internal UAT only. Do not treat this as pilot or production readiness without cloud staging re-proof.

## Service-role remediation

If admin flows fail with 401 or the schema health endpoint reports `malformed_service_role_key`:

1. Open `.env.local`
2. Replace `SUPABASE_SERVICE_ROLE_KEY` with the full current service-role secret from the linked Supabase project
3. Ensure the value has three JWT segments separated by `.` and is not truncated
4. Restart the local app/server process
5. Re-run:

```bash
npm run validate:env
curl http://127.0.0.1:3000/api/health/schema
```

## Rules for future prompts

- Do not invent new local run commands when [package.json](/Users/ivan-imac/legacy-fortress-web/package.json) already defines one.
- Prefer `npm run build`, `npm run test:core`, and the existing direct `tsc --noEmit` check before adding new build/test flows.
- Do not add a second deploy path if Vercel + Supabase are already the active release targets.
- Do not add new env requirements without updating [.env.example](/Users/ivan-imac/legacy-fortress-web/.env.example), [README.md](/Users/ivan-imac/legacy-fortress-web/README.md), and this file together.

## Phase 2 reproducible local-UAT baseline

Date: 2026-07-13.

Phase 2 baseline inventory and dirty-file classification are recorded in:

- [PHASE2_BASELINE_INVENTORY.md](/Users/ivan-imac/legacy-fortress-web/docs/stabilisation/PHASE2_BASELINE_INVENTORY.md)
- [DIRTY_FILE_REGISTER.md](/Users/ivan-imac/legacy-fortress-web/docs/stabilisation/DIRTY_FILE_REGISTER.md)

Current test hierarchy:

```bash
npm test
npm run test:core
npm run test:stabilisation
npm run test:uat:local
npm run test:uat:admin
npm run lint
npm run build
```

`npm test` is deterministic and does not require local Supabase browser state. The UAT scripts are explicitly named because they require `http://127.0.0.1:3012` and the isolated local Supabase stack.

Local configuration rules:

- `.env.phase1.local` is the current ignored local-UAT env mechanism.
- `.env.local` is ignored and may point to hosted services; do not use it for local-UAT unless target isolation is reconfirmed.
- `.env.example` and `.env.staging.example` are safe templates only and must contain placeholders rather than real URLs, keys, tokens, project IDs, passwords, or database strings.
- `supabase/config.toml` currently contains local UAT ports and `site_url = "http://localhost:3012"` with production callback/reset/sign-in origins only allow-listed as redirects. Do not blindly change local `site_url` to production.
- Fresh local reproducibility has not been proven with `supabase db reset` in Phase 2 because preserving the current synthetic review environment was required. Treat migration-chain reproducibility as partially proven until a reset is approved.

Phase 2 correction summary:

- `tests/auth-and-schema-guards.test.mjs` now verifies local Supabase `site_url` plus production redirect allow-list instead of expecting the local CLI config to use the production origin.
- `tests/dashboard-ui-consistency.test.mjs` now matches the current profile-chip and onboarding behavior.
- `package.json` now has `npm test`, `test:unit`, `test:uat:local`, and `test:uat:admin`.

Phase 2 gate results:

- `npx tsc --noEmit --pretty false`: pass.
- `npm test`: pass.
- `npm run test:core`: pass.
- `npm run test:stabilisation`: pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `node --test tests/admin-phase1-foundation.test.mjs`: pass.
- Local schema health endpoint: pass.
- Admin role matrix Playwright: pass 13/13 when run serially.
- Local review-access Playwright: pass 3/3.

Do not run `tests/e2e/admin-role-matrix-local.spec.ts` and `tests/e2e/local-uat-review-access.spec.ts` in parallel while they share the same synthetic emails; each suite intentionally resets those users' temporary passwords during fixture setup.

## Phase 3 controlled refinement foundation

Date: 2026-07-13.

Phase 3 product and architecture guardrails:

- [OWNER_REVIEW_BACKLOG.md](/Users/ivan-imac/legacy-fortress-web/docs/product/OWNER_REVIEW_BACKLOG.md)
- [DASHBOARD_BOUNDARIES_AND_PRIVACY.md](/Users/ivan-imac/legacy-fortress-web/docs/product/DASHBOARD_BOUNDARIES_AND_PRIVACY.md)
- [DASHBOARD_COMPONENT_STANDARD.md](/Users/ivan-imac/legacy-fortress-web/docs/architecture/DASHBOARD_COMPONENT_STANDARD.md)
- [PHASE3_SELECTED_SLICE.md](/Users/ivan-imac/legacy-fortress-web/docs/product/PHASE3_SELECTED_SLICE.md)

The selected Phase 3 implementation slice is deliberately narrow: keep customer category dashboard cards on the shared `DashboardAssetSummaryCard` contract, with direct Add record empty states and populated-card Open actions. It is UI-only and does not alter Supabase schema, access control, attachments, contact invitations, or hosted configuration.

`npm run test:core` now includes `tests/phase3-product-governance.test.mjs` so the Phase 3 backlog, dashboard-boundary, component-standard and fixture-pack documents remain present and local-only.

The fixture pack is a deterministic local-only definition in `tests/fixtures/phase3SyntheticFixturePack.mjs`. It is not a database seed and does not mutate the current local review environment.

## Phase 4A local customer-dashboard gate

Date: 2026-07-13.

Phase 4A adds customer dashboard consistency proof for selected canonical overview routes. The new docs are:

- [CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md](/Users/ivan-imac/legacy-fortress-web/docs/architecture/CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md)
- [PHASE4A_SELECTED_SCOPE.md](/Users/ivan-imac/legacy-fortress-web/docs/product/PHASE4A_SELECTED_SCOPE.md)

Additional local checks:

```bash
node --test tests/category-dashboard-consistency.test.mjs
node --test tests/phase3-product-governance.test.mjs
node --test tests/phase4a-customer-dashboard-data-proof.test.mjs
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/phase4a-customer-dashboard-consistency.spec.ts --project=desktop-chromium --reporter=line
```

`npm run test:core` now includes `tests/phase4a-customer-dashboard-data-proof.test.mjs`. The Playwright proof remains a local-Supabase browser check and must only run after the app is confirmed on `http://127.0.0.1:3012` with the local Supabase endpoint.

Phase 4A completed local-UAT evidence on 2026-07-13:

- `npx tsc --noEmit --pretty false`: pass.
- `npm test`: pass.
- `npm run test:core`: pass.
- `npm run test:stabilisation`: pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `node --test tests/admin-phase1-foundation.test.mjs`: pass.
- `node --test tests/category-dashboard-consistency.test.mjs`: pass.
- `node --test tests/phase3-product-governance.test.mjs`: pass.
- `node --test tests/phase4a-customer-dashboard-data-proof.test.mjs`: pass.
- `curl -sS http://127.0.0.1:3012/api/health/schema`: pass.
- Phase 3 dashboard Playwright: pass 2/2.
- Phase 4A customer dashboard Playwright: pass 7/7.
- Admin role-matrix Playwright: pass 13/13 when run serially.

Do not run the admin role-matrix Playwright suite in parallel with other account-mutating browser suites during release gates; shared local synthetic fixture setup can otherwise create transient sign-in contention.
