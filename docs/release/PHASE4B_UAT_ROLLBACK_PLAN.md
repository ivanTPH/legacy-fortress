# Phase 4B UAT Rollback Plan

Date: 2026-07-13

## Application Rollback

- Keep the previous successful Coolify deployment and commit SHA.
- If deployment fails, roll back the Coolify application to the previous commit/deployment.
- If the new deployment boots but health fails, stop UAT and roll back before test users continue.

## Database Rollback

- Take a UAT database backup/checkpoint before applying migrations.
- If migration application is incomplete, owner/rollback decision-maker chooses backup restore or forward fix.
- Security/RLS failures that expose unrelated data require immediate rollback or service isolation.

## Stop Conditions

- UAT points to production Supabase, storage, email, billing or auth.
- UAT banner/noindex is missing.
- Owner cannot access the internal application-control dashboard with a synthetic super-admin account.
- Current live Coolify branch/commit is not owner-verified.
- Revoked access persists.
- Unrelated owner data is accessible.
- Email can reach unintended real recipients.
- Live Stripe keys are required.
- Health/schema checks fail after deployment.
- Migration history is ambiguous.
- Phase 4D credential-history decision remains unresolved before push/deploy.
- Phase 4D UAT isolation validator fails or is not run with real UAT categories.
- `supabase/config.toml` would be included without separate approval.

## Evidence To Capture

- Commit SHA.
- Migration list before and after.
- Backup/checkpoint id.
- Health responses.
- Browser proof screenshots or Playwright report.
- Logs for failure without secret values.
- Phase 4D owner verification, UAT isolation validation and commit manifest approval.
