# Admin Foundation

Status: Implemented, pending full local role-matrix browser proof.

The real admin foundation is separate from the customer vault. The customer vault remains under `/dashboard`; the operational admin landing page is `/admin`.

## Routes

- `/admin`: protected admin command dashboard.
- `/admin/access-denied`: safe denial page for signed-in non-admin accounts.
- `/api/internal/admin/dashboard-summary`: privacy-safe aggregate summary API.
- `/api/internal/admin/local-role-override`: local-only UAT role harness.
- `/internal/admin`: existing operational admin workspace.
- `/internal/admin/prototype/*`: prototype/static back-office surfaces.

## Security Model

Admin access is tied to a signed-in Supabase Auth user and an active server-side `admin_users` row. Admin API routes re-validate the bearer token server-side, resolve the current admin role, and enforce capabilities before sensitive queries run.

The browser never receives service-role credentials. The admin dashboard summary returns aggregate counts only; it does not return document contents, secure notes, account numbers, signed URLs, passwords, policy references or private vault record payloads.

## Local Role Harness

The local role harness is available only when the app is running against localhost or `127.0.0.1` Supabase in non-production mode. It stores a temporary HTTP-only role override cookie and is ignored outside local development.

Supported local test roles:

- `super_admin`
- `support_agent`
- `probate_reviewer`
- `auditor`
- `enterprise_admin`
- `standard_user`
- `revoked_admin`

Role override start/reset attempts are audited where the admin audit table is available.

## Audit Events

The foundation writes append-only audit events for admin dashboard reads and local role-harness changes where possible. Audit writes are server-side only and omit secrets, tokens and private vault contents.

See also:

- [ADMIN_ROLE_MATRIX.md](./ADMIN_ROLE_MATRIX.md)
- [ADMIN_DASHBOARD_METRICS.md](./ADMIN_DASHBOARD_METRICS.md)
- [ADMIN_UAT.md](./ADMIN_UAT.md)
