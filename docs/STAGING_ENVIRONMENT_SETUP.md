# Staging Environment Setup

This document prepares Legacy Fortress for approved hosted staging verification. It does not grant permission to apply migrations, create users or run browser tests until the staging identity and credentials are proven.

## Current Hosting Source Of Truth

As of 20 August 2026, the current hosted staging evidence points to a Coolify/custom-domain staging setup, not the older Vercel-preview assumption:

- Staging application: `https://test.mylegacyfortress.com`
- Staging application name recorded in prior audit: `Legacy Fortress Staging`
- Staging Supabase/API origin: `https://supabase-test.mylegacyfortress.com`
- Current live staging `/api/version` evidence: commit `42f67238dae3721c1b2d181f01caddbcfb0abe02`
- Supabase API gateway evidence: `supabase-test.mylegacyfortress.com` responds as a Kong-backed Supabase-style API endpoint and rejects unauthenticated REST requests.

The older `uat.legacyfortress.co.uk` and Vercel Preview notes are retained as historical/planned alternatives only. Do not use Vercel production or Vercel Preview assumptions for the current hosted staging gate unless the owner explicitly re-verifies that hosting path.

The staging Supabase hostname is proven as an API origin, but the underlying project/service identifier, database connection, backup owner and rollback process still must be recovered from the approved operator system before migration or synthetic UAT.

## Purpose

Use staging only to prove that the linked-access RLS remediation can be applied and independently re-tested outside local UAT. Staging must be separate from production and must use synthetic `staging-phase5-*` accounts and fictional records only.

## Non-Secret Template

The repository-safe placeholder template is `.env.staging.example`. It contains variable names and obvious placeholders only. It is explicitly allowed by `.gitignore` so it can be tracked as handover documentation.

Create a private local copy only after staging is approved:

```bash
cp .env.staging.example .env.staging.local
```

Fill `.env.staging.local` through a secure process. `.env.staging.local` remains ignored and is the local secret-bearing file. Do not paste values into chat, commit them, screenshot them, or print them in terminal output. Never add real secrets, URLs, keys, ids, tokens or connection strings to `.env.staging.example`.

## Required Variables

Supabase browser client:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Supabase server/admin client:

- `SUPABASE_SERVICE_ROLE_KEY`

Migration-history and migration-apply access:

- `SUPABASE_DB_URL`

Application and browser test targets:

- `NEXT_PUBLIC_APP_URL`
- `BASE_URL`
- `PLAYWRIGHT_BASE_URL`

Environment markers:

- `LEGACY_FORTRESS_ENV=staging`
- `VERCEL_ENV=preview` only if Vercel Preview is explicitly used; otherwise omit or use the hosting platform's non-production marker
- `NODE_ENV=production`

Current Coolify/operator access variables:

- `COOLIFY_BASE_URL`
- `COOLIFY_API_TOKEN`

Controlled synthetic testing:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`
- `SMOKE_OWNER_EMAIL`
- `SMOKE_OWNER_PASSWORD`
- `NEXT_PUBLIC_ENABLE_TEST_PERSONAS`
- `ENABLE_INTERNAL_TEST_LOGIN`

Optional provider placeholders that must not point at live services for Phase 5:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CUSTOMER_PORTAL_URL`
- `GOOGLE_CLIENT_ID`
- `APPLE_CLIENT_ID`

## Accidental Production Prevention

Before loading staging env, confirm all of the following:

- The approved application URL is `https://test.mylegacyfortress.com` unless the owner has recorded a newer staging hostname.
- The approved Supabase API origin is `https://supabase-test.mylegacyfortress.com` unless the owner has recorded a newer staging API origin.
- The approved Supabase project/service is labelled staging and is not shared with production.
- The database contains no real users or live customer data.
- The service-role key belongs to staging only.
- Browser tests will use synthetic `staging-phase5-*` accounts only.
- Live Stripe, Vercel production, production email and production Supabase are not used.
- `.env.local` is not overwritten.
- `supabase/config.toml` and `tsconfig.json` are not modified for staging.

Use shell commands that list variable names or redacted checks only. Do not print values.

## Confirming The App Points To Staging

Before sign-in or account creation:

1. Load the private staging env in the shell.
2. Run a redacted diagnostic that confirms the hostnames or labels are staging without printing secrets.
3. Open the staging app URL in a browser.
4. Confirm browser network requests go only to the approved staging Supabase API origin.
5. Confirm `/api/health/schema` returns a structured staging-safe result.

Stop immediately if any request goes to production.

## Migration Prerequisites

Do not apply any hosted migration, including `supabase/migrations/20260820120000_phase1_verified_access_policy_foundation.sql`, until all checklist items pass:

- Approved staging application URL.
- Approved staging Supabase API origin and underlying project/service identifier.
- Confirmation staging is separate from production.
- Secure local environment variables loaded without printing secrets.
- Staging migration history access.
- Backup/checkpoint completed.
- Restore procedure documented.
- Named rollback owner.
- Permission for synthetic `staging-phase5-*` accounts.
- Approval to apply only the specifically reviewed pending migration(s).
- Confirmation no real user data is present.
- Confirmation browser tests will use synthetic staging data only.
- Confirmation no production Vercel, Stripe, Supabase or email services will be touched.

Required migration-history checks:

- `20260324103000_contact_invitation_view_only_access.sql` is present.
- `20260630170000_admin_phase1_foundation.sql` is present.
- `20260701193000_admin_phase2b_probate_cases.sql` is present.
- `20260703153000_linked_access_scope_enforcement.sql` is absent before apply.
- For Phase 1 identity/access foundation, `20260820120000_phase1_verified_access_policy_foundation.sql` is absent before apply and present after apply.

Capture existing linked-access policies/functions before apply so rollback can restore the previous state if needed.

## Secure Recovery Steps

1. In Coolify, open the `Legacy Fortress Staging` application for `test.mylegacyfortress.com` and verify repository, branch, deployed commit, environment group and linked Supabase/service metadata.
2. Export or copy only staging values into ignored `.env.staging.local`; never overwrite `.env.local`.
3. Store `NEXT_PUBLIC_SUPABASE_URL=https://supabase-test.mylegacyfortress.com` only if Coolify/operator metadata confirms that hostname belongs to the staging Supabase service.
4. Add the staging-only anon key, service-role key and DB URL from the staging service or approved secret store.
5. Add `NEXT_PUBLIC_APP_URL`, `BASE_URL` and `PLAYWRIGHT_BASE_URL` for `https://test.mylegacyfortress.com`.
6. Load the file locally and run `npm run uat:validate`; it must pass without printing values.
7. Query migration history read-only before any apply, then apply only the reviewed pending Phase 1 migration after backup and rollback owner confirmation.

## Required Phase 5 Proof

After explicit migration approval and apply, prove:

- Pre-grant linked executor denial.
- Approved scoped access only.
- Denial of unrelated owner records.
- Denial of unrelated document metadata and storage objects.
- Denial through dashboard, search, direct routes and direct REST/API paths.
- Revocation denial after refresh.
- Revocation denial after direct navigation.
- Revocation denial after fresh browser session.
- Role regression for owner, standard user, support agent, verification reviewer, probate reviewer, auditor, super admin and linked executor.
- Audit-history evidence for approval and revocation.

## Repository-Safe Commands

These commands do not contact hosted systems:

```bash
git status --short --branch
git check-ignore .env.staging.local .env.local .env.production .env.production.local
git check-ignore .env.staging.example
npm run lint
npm run build
```

Only run browser or Supabase commands after staging is securely configured and explicitly approved.

## Handover Checklist

- [ ] Approved staging application URL is known.
- [ ] Approved staging Supabase API origin and underlying project/service identifier are known.
- [ ] Staging is confirmed separate from production.
- [ ] Secure env values are loaded locally without printing secrets.
- [ ] Staging migration history is accessible.
- [ ] Backup/checkpoint is complete.
- [ ] Restore procedure is documented.
- [ ] Rollback owner is named.
- [ ] Synthetic `staging-phase5-*` accounts/data are approved.
- [ ] Only the explicitly reviewed pending migration(s) are approved for apply.
- [ ] No real user data is present.
- [ ] Browser tests will use synthetic staging data only.
- [ ] Production Vercel, Stripe, Supabase and email services will not be touched.
