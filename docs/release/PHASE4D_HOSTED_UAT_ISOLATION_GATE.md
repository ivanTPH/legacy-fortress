# Phase 4D Hosted UAT Isolation Gate

Date: 2026-07-14

## Status

Configuration-level gate prepared. Hosted UAT is not proven because no hosted services were contacted in this phase.

Preferred UAT domain: `uat.legacyfortress.co.uk`, subject to DNS/operator setup.

## Required Separate UAT Resources

| Category | Requirement |
| --- | --- |
| Coolify application | Separate UAT application, not the live app |
| Branch | Explicit UAT/review branch, not live branch unless separately approved |
| Subdomain | Dedicated UAT subdomain |
| Supabase project/database | Separate non-production project or database |
| Authentication users | Synthetic UAT users only |
| Storage buckets | Separate UAT buckets |
| Service-role key | UAT-only key |
| Anonymous key | UAT-only key |
| Database connection | UAT-only connection |
| Encryption keys | UAT-only secrets |
| Email credentials | Sandbox/test sender credentials only |
| Sender identity | UAT-labelled sender |
| Recipient restrictions | Synthetic or allowlisted recipients only |
| Stripe keys | Test mode only |
| Stripe products/prices | Test-mode UAT products/prices only |
| Stripe webhook | UAT-only webhook secret and endpoint |
| Application URL | UAT URL only |
| Auth redirects | UAT callback/reset/invitation URLs |
| Cookies | UAT-safe domain; must not share production cookie domain unsafely |
| Analytics/logging | UAT-labelled and non-production |
| Backups | UAT backup/checkpoint before migrations |
| Cron jobs/webhooks | UAT-only endpoints |

## Validator

Use:

```bash
npm run uat:validate
```

The validator checks required categories without printing secret values and fails for:

- UAT app URL equal to production URL.
- UAT Supabase URL equal to production Supabase URL.
- UAT database identity equal to production database identity.
- UAT storage bucket equal to production storage bucket where separation is required.
- UAT email credential fingerprint equal to production email credential fingerprint.
- Live Stripe secret or live-mode webhook usage.
- UAT webhook secret equal to production webhook secret.
- Unsafe cookie-domain sharing.
- Local role harness enabled in production mode.
- Missing explicit UAT/staging/local-UAT environment mode.
- Required noindex or UAT banner disabled.

## Tests

`tests/uat-environment-validation.test.mjs` covers valid isolation, shared database rejection, shared storage rejection, live Stripe/shared webhook rejection, production URL rejection, missing UAT mode, production role harness rejection, noindex rejection and UAT banner rejection.

## Release Impact

Hosted UAT remains blocked until the operator supplies and validates real non-production values through the secure local environment mechanism.
