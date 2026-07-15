# Staging Environment Setup

This document prepares Legacy Fortress for a future approved Phase 5 staging verification. It does not grant permission to contact hosted systems, apply migrations, create users or run browser tests.

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
- `VERCEL_ENV=preview`
- `NODE_ENV=production`

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

- The approved application URL is a staging/preview URL, not the production URL.
- The approved Supabase project is labelled staging and is not shared with production.
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

Do not apply `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql` until all checklist items pass:

- Approved staging application URL.
- Approved staging Supabase project.
- Confirmation staging is separate from production.
- Secure local environment variables loaded without printing secrets.
- Staging migration history access.
- Backup/checkpoint completed.
- Restore procedure documented.
- Named rollback owner.
- Permission for synthetic `staging-phase5-*` accounts.
- Approval to apply only `20260703153000_linked_access_scope_enforcement.sql`.
- Confirmation no real user data is present.
- Confirmation browser tests will use synthetic staging data only.
- Confirmation no production Vercel, Stripe, Supabase or email services will be touched.

Required migration-history checks:

- `20260324103000_contact_invitation_view_only_access.sql` is present.
- `20260630170000_admin_phase1_foundation.sql` is present.
- `20260701193000_admin_phase2b_probate_cases.sql` is present.
- `20260703153000_linked_access_scope_enforcement.sql` is absent before apply.

Capture existing linked-access policies/functions before apply so rollback can restore the previous state if needed.

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
- [ ] Approved staging Supabase project is known.
- [ ] Staging is confirmed separate from production.
- [ ] Secure env values are loaded locally without printing secrets.
- [ ] Staging migration history is accessible.
- [ ] Backup/checkpoint is complete.
- [ ] Restore procedure is documented.
- [ ] Rollback owner is named.
- [ ] Synthetic `staging-phase5-*` accounts/data are approved.
- [ ] Only migration `20260703153000_linked_access_scope_enforcement.sql` is approved for apply.
- [ ] No real user data is present.
- [ ] Browser tests will use synthetic staging data only.
- [ ] Production Vercel, Stripe, Supabase and email services will not be touched.
