# Phase 4C Controlled Staging Plan

Date: 2026-07-13

Do not commit, push or deploy until this plan is owner-approved.

## Commit 1 — Runtime Config And Health Safety

Purpose: production-start schema health fix and safe diagnostics.

Files:

- `lib/supabaseAdmin.ts`
- `app/api/health/schema/route.ts`
- `tests/auth-and-schema-guards.test.mjs`

Command:

```bash
git add lib/supabaseAdmin.ts app/api/health/schema/route.ts tests/auth-and-schema-guards.test.mjs
```

Required checks:

- `node --test tests/auth-and-schema-guards.test.mjs`
- `npm run build`
- production start smoke on a temporary port
- `/api/health`
- `/api/health/schema`

## Commit 2 — UAT Presentation And Isolation Guardrails

Files:

- `lib/environment/appEnvironment.ts`
- `components/internal/UatEnvironmentBanner.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `scripts/validate-uat-environment.mjs`
- `tests/uat-presentation-controls.test.mjs`
- `tests/uat-environment-validation.test.mjs`

Command:

```bash
git add lib/environment/appEnvironment.ts components/internal/UatEnvironmentBanner.tsx app/layout.tsx app/globals.css scripts/validate-uat-environment.mjs tests/uat-presentation-controls.test.mjs tests/uat-environment-validation.test.mjs
```

Required checks:

- `node --test tests/uat-presentation-controls.test.mjs tests/uat-environment-validation.test.mjs`
- `npm run lint`
- `npm run build`

## Commit 3 — Owner Admin Review Proof

Files:

- `tests/e2e/owner-admin-enterprise-review-access.spec.ts`
- `docs/product/OWNER_ADMIN_AND_ENTERPRISE_REVIEW_GUIDE.md`

Command:

```bash
git add tests/e2e/owner-admin-enterprise-review-access.spec.ts docs/product/OWNER_ADMIN_AND_ENTERPRISE_REVIEW_GUIDE.md
```

Required checks:

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/owner-admin-enterprise-review-access.spec.ts --project=desktop-chromium --reporter=line`

## Commit 4 — Phase 4C Release Evidence

Files:

- `docs/release/PHASE4C_MIGRATION_REPLAY_EVIDENCE.md`
- `docs/release/PHASE4C_SUPABASE_CONFIG_REVIEW.md`
- `docs/release/PHASE4C_SECRET_HISTORY_REVIEW.md`
- `docs/release/PHASE4C_LIVE_DEPLOYMENT_IDENTIFICATION.md`
- `docs/release/PHASE4C_UAT_PRESENTATION_CONTROLS.md`
- `docs/release/PHASE4C_UAT_ISOLATION_VALIDATION.md`
- `docs/release/PHASE4C_CONTROLLED_STAGING_PLAN.md`
- updated release runbooks.

## Explicit Exclusions

Do not stage:

- `.env*` secret-bearing files.
- `supabase/config.toml` unless separately approved.
- `tsconfig.json` unless separately reviewed.
- `.next/`, `test-results/`, screenshots, traces, generated artifacts.
- local seed data, local storage objects, database dumps or backups.

## Manual Split Warning

`app/globals.css`, `app/layout.tsx`, docs and shared app files contain many pre-existing dirty changes. Review diffs by hunk before staging.
