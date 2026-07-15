# Phase 4C UAT Isolation Validation

Date: 2026-07-13

## Implementation

Added:

- `scripts/validate-uat-environment.mjs`
- `tests/uat-environment-validation.test.mjs`

## Checks

The validator fails when:

- UAT Supabase URL matches the configured production Supabase URL.
- UAT database URL matches the configured production database URL.
- UAT app URL matches the configured production app URL.
- UAT storage bucket matches the configured production bucket.
- Stripe appears to use live mode.
- UAT email mode is production.
- UAT app URL appears to be production.
- UAT cookie domain matches production cookie domain.
- Local role harness is enabled in production mode.
- UAT noindex is required but not enabled.
- Required UAT categories are missing.

The validator prints variable names and failure categories only. It does not print secret values.

## Tests

`node --test tests/uat-environment-validation.test.mjs` passed.

## Hosted UAT Use

Run this before any Coolify UAT deployment or migration validation with UAT-only env variables loaded. Do not run it with production secrets in a way that prints shell history.
