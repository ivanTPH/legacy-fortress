# Phase 4B Hosted UAT Test Plan

Date: 2026-07-13

Run only against isolated UAT with synthetic users and data.

## Deployment And Infrastructure

- HTTPS works on UAT domain.
- UAT banner is visible on public and authenticated routes.
- UAT pages emit noindex/nofollow metadata.
- `scripts/validate-uat-environment.mjs` passes without printing secrets.
- `npm run uat:validate` passes with UAT-only categories loaded and fails closed if pointed at production categories.
- `/api/health` passes.
- `/api/version` identifies build/version where available.
- `/api/health/schema` passes after UAT admin env is configured.
- Logs are available and do not contain secrets.
- Restart proof passes.
- No production connection is detected.

## Authentication

- Sign-up, confirmation, sign-in, sign-out.
- Password reset.
- Session persistence.
- Session isolation from production.
- Restricted admin access.
- Restricted account creation if enabled.

## Customer Application

- Dashboard.
- Legal, finances, property, business, digital, personal/possessions.
- Contacts and access requests.
- Attachments: upload, preview, download, print where supported, replace and remove.
- Create, edit, delete/archive.
- Refresh/re-login persistence.
- Mobile layout.

## Admin And Access

- Admin role matrix.
- Access denied for standard users.
- Owner can open `/admin` with a synthetic super-admin account.
- Probate reviewer.
- Auditor read-only audit history.
- Support role permitted areas.
- Enterprise/licence surfaces remain hidden, restricted or clearly non-operational.

## Privacy And Data Isolation

- Cross-user denial.
- Signed URL isolation.
- No private summary data in unauthorized views.
- No production users, records, storage objects or auth sessions.
- `supabase/config.toml` local-UAT changes are excluded from the hosted package unless separately approved.

## Email

- Emails captured or allowlisted.
- Links return to UAT.
- No external unintended recipients.

## Billing

- Test mode only or disabled.
- No live payment request.
- No production webhook.

## Required Evidence

For every check: role/account category, route, expected result, actual result, logs if relevant, and pass/fail status without credentials.

Phase 4D evidence to attach before hosted UAT: live Coolify owner verification, dependency audit resolution, credential remediation decision, hosted UAT isolation gate, upgrade-path migration evidence and final controlled commit manifest.
