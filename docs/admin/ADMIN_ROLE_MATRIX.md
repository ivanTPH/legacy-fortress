# Admin Role Matrix

Status: Phase 2 controlled remediation source of truth for current platform and enterprise administration capabilities.

Canonical platform role source: `admin_users.role`, with master-administrator compatibility through `admin_users.is_master`.

Canonical organisation-scoped enterprise role source: `enterprise_memberships.organisation_role` for active memberships only.

## Platform Roles

| Role | Admin overview | User lookup | Admin users and roles | Probate queue | Probate decisions | Support views | Audit | Enterprise portfolio | Private vault content |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `super_admin` | allowed | allowed | allowed | allowed | allowed | allowed | allowed | allowed | denied |
| `support_agent` | allowed | allowed | denied | denied | denied | allowed | denied | denied | denied |
| `verification_reviewer` | allowed | denied | denied | read-only | review only | denied | limited read | denied | denied |
| `probate_reviewer` | allowed | denied | denied | allowed | allowed | denied | limited read | denied | denied |
| `auditor` | allowed | denied | denied | denied | denied | denied | allowed | read-only | denied |
| `enterprise_admin` | allowed | denied | denied | denied | denied | denied | denied | allowed | denied |

## Organisation-Scoped Enterprise Roles

| Role | Enterprise workspace | Organisation | Licence | Members and invitations | Enrolment links | Reports | Exports | Cross-organisation access | Platform admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `organisation_admin` | allowed | manage own org | read | manage own org | manage own org | read own org | denied unless separately granted | denied | denied |
| `organisation_licence_manager` | allowed | read own org | manage own org licence/seats/renewal/lifecycle | read own org | denied | denied | denied | denied | denied |
| `licence_manager` | allowed | read own org | manage own org licence/seats/renewal/lifecycle | read own org | denied | denied | denied | denied | denied |
| `organisation_user_manager` | allowed | read own org | read own org | manage own org | manage own org | denied | denied | denied | denied |
| `user_manager` | allowed | read own org | read own org | manage own org | manage own org | denied | denied | denied | denied |
| `organisation_reporting_viewer` | allowed | read own org | read own org | read own org | denied | read own org | denied unless separately granted | denied | denied |
| `reporting_viewer` | allowed | read own org | read own org | read own org | denied | read own org | denied unless separately granted | denied | denied |
| `organisation_auditor` | allowed | read own org | read own org/audit | read own org | denied | read own org | denied | denied | denied |
| `read_only_auditor` | allowed | read own org | read own org/audit | read own org | denied | read own org | denied | denied | denied |
| `organisation_member` | denied | denied | denied | denied | denied | denied | denied | denied | denied |
| `enterprise_user` | denied | denied | denied | denied | denied | denied | denied | denied | denied |

## Owner Decisions

- Whether `support_agent` may perform any future limited account-status mutation remains an owner decision. The current matrix denies role assignment, licence management and probate decisions.
- Whether `auditor` receives any export right remains an owner decision. The current matrix is read-only.
- Whether organisation-scoped reporting roles may export aggregated reports remains an owner decision unless an explicit export capability is granted.

## Enforcement Points

- Platform API authentication and role resolution: `lib/admin/access.ts`.
- Platform capability mapping: `lib/admin/capabilities.ts`.
- Canonical platform admin-user lifecycle API: `app/api/internal/admin/admin-users/route.ts`.
- Enterprise access and organisation-scope resolver: `lib/admin/access.ts`.
- Enterprise action capability and scope gate: `app/api/internal/admin/enterprise/route.ts`.
- Audit writer: `lib/admin/audit.ts`.

## Security Defaults

- Missing or invalid sessions return `401`.
- Authenticated users without the required capability return `403`.
- Disabled or invalid admin rows are denied.
- Organisation-scoped roles are limited to their `enterprise_memberships.organisation_id` set.
- Hidden UI controls are never the authority; server APIs remain authoritative.
- Private vault records, documents, legal contents, financial values and private notes are excluded from admin and enterprise operational payloads.
