# Admin UAT

Status: foundation implemented; local role-matrix browser proof completed with synthetic users. Not production-ready.

## Required Local Accounts

Use synthetic local-only accounts:

- super admin
- support agent
- probate reviewer
- auditor
- enterprise admin
- standard user
- revoked admin

Do not use real customer accounts.

## Browser Scenarios

1. Unauthenticated user visits `/admin` and is sent to sign-in with return path.
2. Standard user signs in, visits `/admin`, and reaches `/admin/access-denied`.
3. Super admin signs in, sees all foundation summary cards and the local UAT role harness.
4. Super admin switches to support, probate, auditor and enterprise roles; visible cards change by role.
5. Super admin switches to standard/revoked role and is denied on refresh.
6. Access denied page does not loop and provides a safe return to `/dashboard`.
7. Admin summary API returns `401` unauthenticated and `403` unauthorised.
8. Dashboard cards show unavailable states instead of misleading zeros.
9. No private vault contents, document contents, signed URLs or sensitive payloads appear in the browser or API response.
10. Mobile width remains readable and usable.

## Latest Evidence

- Static/admin tests: `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/platform-architecture-stabilisation.test.mjs`
- Typecheck: `npx tsc --noEmit --pretty false`
- Lint: `npm run lint`
- Build: `npm run build`
- API unauthenticated smoke: `/api/internal/admin/dashboard-summary` returned `401` without admin data.

## 2026-07-12 Local Role-Matrix Proof

- Environment: isolated local Supabase via `.env.phase1.local`; local app `http://127.0.0.1:3012`.
- Synthetic users: `uat.superadmin@local.test`, `uat.support@local.test`, `uat.probate@local.test`, `uat.auditor@local.test`, `uat.enterprise@local.test`, `uat.standard@local.test`, `uat.revoked@local.test`, `uat.invalidrole@local.test`.
- Browser/API proof: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/admin-role-matrix-local.spec.ts --project=desktop-chromium --reporter=line` passed 13/13.
- Proven: standard user denied, revoked admin denied, invalid role fails closed, role-specific admin API access enforced, dashboard aggregate API matches local fixture truth, private payload fields are redacted, local role harness is super-admin-only and audited, stale admin revocation is denied on next request, mobile viewport denial/access remains usable.
- Typecheck passed: `npx tsc --noEmit --pretty false`.
- Focused admin unit proof passed: `node --test tests/admin-phase1-foundation.test.mjs`.
- Lint passed: `npm run lint`.
- Build passed: `set -a; source .env.phase1.local; set +a; npm run build`.
- Local schema smoke passed: `curl -sS http://127.0.0.1:3012/api/health/schema`.
- Remaining gate issue: repository-wide `npm run test:core` and `npm run test:stabilisation` still fail unrelated legacy assertions; plain `npm test` is not defined in `package.json`.
