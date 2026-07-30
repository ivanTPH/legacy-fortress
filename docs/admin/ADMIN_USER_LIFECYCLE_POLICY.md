# Admin User Lifecycle Policy

Status: Phase 3 controlled remediation policy for the current platform administrator lifecycle.

Canonical platform administrator table: `admin_users`.

Canonical administrator invitation table: `admin_invitations`.

Canonical lifecycle API: `/api/internal/admin/admin-users`.

## Lifecycle Operations

| Operation | Current policy | Safeguards |
| --- | --- | --- |
| Invitation | allowed with safeguards | Requires `admin_users:manage`, valid email, valid role template, no active admin for the email, no duplicate pending invitation, and audit evidence. |
| Invitation resend | allowed with safeguards | Requires `admin_users:manage`; terminal invitations such as revoked, expired or accepted cannot be resent. |
| Invitation revoke | allowed with safeguards | Requires `admin_users:manage`; repeat revoke is a conflict. |
| Activation | allowed with safeguards | Requires `admin_users:manage`; uses canonical lifecycle route and success audit. |
| Role assignment | allowed with safeguards | Requires `admin_users:manage`; role must be one of the canonical platform roles. |
| Role change | allowed with safeguards | Requires `admin_users:manage`, reason, self-demotion protection, final-active-super-admin protection and success audit. |
| Disable | allowed with safeguards | Requires `admin_users:manage`, reason, self-disable protection, final-active-super-admin protection and success audit. |
| Re-enable | allowed with safeguards | Requires `admin_users:manage`; repeat re-enable of an active admin is treated as a lifecycle conflict where server state requires it. |
| Removal | not implemented | Platform admin records are disabled rather than deleted through the canonical UI/API. |
| Auth-user deletion | not implemented | Admin lifecycle changes do not delete the authentication account or personal vault. |
| Self-edit | limited | Administrators cannot use the lifecycle API to remove their own active platform-admin authority. |
| Self-demotion | denied | A super administrator cannot demote themselves through the ordinary lifecycle API. |
| Self-disable | denied | An administrator cannot disable their own active platform-admin record through the ordinary lifecycle API. |
| Last-active-super-admin disable | denied | Application checks and a database trigger preserve at least one active `super_admin` or `is_master` admin row. |
| Last-active-super-admin demotion | denied | Application checks and a database trigger preserve at least one active `super_admin` or `is_master` admin row. |
| Duplicate active admin invitation | denied | Invitation creation checks existing active `admin_users` before insert. |
| Duplicate pending invitation | denied | Invitation creation checks pending/sent/delivered invitations before insert. |
| Expired or revoked invitation lifecycle | denied | Resend/revoke terminal-state conflicts return a safe conflict response. |
| Organisation-scoped platform assignment | denied | Organisation-scoped enterprise roles do not receive `admin_users:manage`. |
| Denied lifecycle audit | allowed with safeguards | Authenticated denied lifecycle attempts record blocked audit events without secrets. Unauthenticated attempts are not audited to avoid noisy anonymous records. |

## Conflict and Status Policy

- Missing or invalid authentication returns `401`.
- Authenticated users without `admin_users:manage` return `403`.
- Invalid email, role or lifecycle action returns `400`.
- Self-disable, self-demotion, stale target state and terminal invitation conflicts return safe rejection responses with no mutation.
- Last-active-super-admin attempts return `409`.
- Missing targets return a safe conflict response unless a route has a more specific safe-not-found convention.

## Data Invariant

At least one active platform super administrator must remain. Active super administrator means:

- `admin_users.status = 'active'`; and
- either `admin_users.is_master = true` or `admin_users.role = 'super_admin'`.

The application checks this before ordinary lifecycle updates. The database also enforces it for direct `UPDATE` and `DELETE` of `admin_users` using `public.prevent_last_active_super_admin_loss()`.

## Owner Decisions

- A formal handover workflow for self-demotion or self-disable is not implemented.
- Permanent removal of platform admin records is not implemented.
- Broader support-agent mutation powers remain denied unless the owner approves a separate policy change.
