# Owner Admin And Enterprise Review Guide

Date: 2026-07-13

Use only the isolated local Legacy Fortress environment for this guide.

## Local URL

- Customer app: `http://127.0.0.1:3012/dashboard`
- Sign-in route: `http://127.0.0.1:3012/sign-in`
- Internal admin dashboard: `http://127.0.0.1:3012/admin`
- Access denied page: `http://127.0.0.1:3012/admin/access-denied`
- Enterprise/licence foundation: review through `http://127.0.0.1:3012/admin` using an enterprise/licence-capable synthetic admin role. There is no separate production-grade licence-management route yet.

## Synthetic Accounts

Use synthetic local accounts only. Do not document passwords. Obtain or reset the local review password through the approved local environment process.

Review account categories:

- Super admin: can open the application command dashboard and local-only role review harness.
- Support agent: can review support-permitted aggregate functions only.
- Probate reviewer: can review probate/verification aggregate functions only.
- Auditor: can review audit-oriented read-only surfaces only.
- Enterprise/licence admin: can see the foundation state; unsupported licence functions are unavailable.
- Standard customer: must be denied from `/admin`.

## What To Review

1. Sign in with each synthetic account.
2. Open `/admin`.
3. Confirm the current role shown in the admin context.
4. Confirm unsupported actions are absent.
5. Confirm aggregate cards do not show private vault content, document contents, filenames, account numbers, passwords or secrets.
6. Confirm enterprise/licence cards say unavailable/foundation where no operational schema exists.
7. Return to the customer app using the visible link.

## What Must Not Be Visible

- Customer document contents.
- Customer notes.
- Private account numbers or policy numbers.
- Service-role keys, storage credentials, auth tokens or passwords.
- Real customer data.
- Working licence administration claims where the feature is not implemented.

## Browser Evidence

Phase 4C added `tests/e2e/owner-admin-enterprise-review-access.spec.ts`.

Current local proof:

- Standard customer denied from `/admin`.
- Super admin can open `/admin`.
- Support, probate reviewer and auditor see role-limited surfaces.
- Enterprise/licence role sees unavailable foundation metrics.
- Narrow viewport renders the dashboard.

## Known Limitations

- Enterprise/licence management is foundation-only.
- Application-control dashboard metrics must be read as aggregate/synthetic/foundation indicators where labelled; unavailable sources must not be treated as zero.
- Full production-grade support workflows, probate decisions, exports and licence administration remain out of scope for Phase 4C.
- Current live Coolify branch/commit must be verified by the owner before any push or deployment decision.
- Phase 4D added a pre-push owner checklist in `docs/release/PHASE4D_LIVE_COOLIFY_OWNER_VERIFICATION.md`; complete it before push/deploy.
