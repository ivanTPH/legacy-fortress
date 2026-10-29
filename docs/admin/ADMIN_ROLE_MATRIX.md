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

## Contextual Resource Matrix

This matrix describes the authoritative outcome for the principal product contexts. `Denied` means the action must be rejected by the server even when a UI control is hidden. `Conditional` requires the listed grant, assurance, estate, organisation, or quorum gate.

| Context / action | Platform/System Admin | Enterprise Organisation Admin | Enterprise authorised user/professional | Personal Vault owner | Trusted contact/delegate | Executor/probate participant | Invited/unaccepted user |
| --- | --- | --- | --- | --- | --- | --- | --- |
| View platform administration | Allowed by platform capability | Denied | Denied | Denied | Denied | Denied | Denied |
| View organisation resources | Allowed by `organisation:view` and scope | Conditional: own organisation | Conditional: assigned organisation scope | Denied | Denied | Denied unless separately assigned | Denied |
| Create/edit own vault records | Denied through admin APIs | Denied through enterprise APIs | Denied unless a separate delegated grant exists | Allowed | Conditional: explicit write grant | Denied for historic estate originals | Denied |
| Invite a contact/member | Platform capability for platform resources; enterprise scope for enterprise invites | Allowed within own organisation | Denied unless delegated | Allowed for own vault | Denied | Conditional: governed estate workflow | Denied |
| Revoke invitation/access | Platform capability and target scope | Own organisation invitations/memberships | Denied unless delegated | Own invitations/grants | Conditional: server grant and context | Conditional: estate authority and audit | Denied |
| Approve sensitive estate action | Conditional: explicit estate capability, presence and quorum policy | Denied | Denied | Denied | Denied unless estate participant | Conditional: distinct eligible approver, identity and quorum | Denied |
| Access sensitive vault information | Denied by default for platform admin views | Denied by enterprise payload boundary | Conditional: organisation policy and assigned resource | Allowed for own vault | Conditional: active bound grant and assurance | Conditional: active estate grant, authority, estate state and assurance | Denied |
| Administer users/licences | Platform capability | Own organisation scope | Denied | Denied | Denied | Denied unless separately granted | Denied |
| Grant access directly | Never from UI alone; server policy/RPC required | Organisation membership only | Denied | Nominate/request only; activation is server-side | Denied | Conditional governed workflow | Denied |

Authoritative enforcement is layered: session/authentication, server capability or organisation scope, relationship/access grant, identity assurance, estate/death-state policy, quorum where applicable, and database/RLS/RPC controls. No row in this matrix authorises raw document, biometric, token, password, or service-role access.
