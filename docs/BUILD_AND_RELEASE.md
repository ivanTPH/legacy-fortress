# Build And Release

This file records the current build, test, and deployment workflow as defined in the repo today.

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
npm run test:e2e
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
npm run lint
npx tsc --noEmit
npm run test:core
npm run audit:routes
npm run crawl:links
```

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
set -a && source .env.local && export E2E_USER_EMAIL='ivanyardley@me.com' E2E_USER_PASSWORD='omnistest123?' && set +a && node scripts/seed-bill-smith-review-account.mjs
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
