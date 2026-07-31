# Admin Product Audit

Audit date: 2026-07-31

Scope: Platform Administration, Enterprise Operations, and Probate Review on branch `hosted-uat-preparation-20260715`.

## Summary

The administration estate now has a shared workspace foundation for the three principal entry surfaces:

- Platform Administration: `/admin`
- Enterprise Operations: `/application/enterprise`
- Probate Review: `/admin/probate`

The backend controls from Admin Phases 1-3 remain the authority. This audit focused on product UX, navigation, visible actions and shared shell consistency, not full workflow remediation.

## Severity Scale

- P0: security or data-loss risk
- P1: core workflow broken
- P2: serious usability or responsive defect
- P3: visual polish or consistency issue

## Workspace Inventory

| Workspace | Principal route | Purpose | Access model | Shell before this phase | Primary APIs | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Platform Administration | `/admin` | Platform overview, user lookup, admin lifecycle, support, verification, audit and health | `admin_users.role`/`is_master` through `lib/admin/access.ts` and `lib/admin/capabilities.ts` | Page-local sidebar/header | `/api/internal/admin/session`, dashboard/support/probate/audit/admin-users APIs | Functional, shell now shared |
| Enterprise Operations | `/application/enterprise` | Organisations, licences, seats, invitations, reporting, consent and renewals | Platform enterprise capability or active `enterprise_memberships` organisation scope | Page-local header/tabs | `/api/internal/admin/enterprise` | Functional, shell now shared |
| Probate Review | `/admin/probate` | Probate queue inspection and review entry | `verification:read`/`verification:review`/`verification:decide` capabilities | Platform page-local shell via admin control plane | `/api/internal/admin/probate-cases` | Functional entry route, shell now shared through Platform Administration |

## Top Findings

| ID | Severity | Route | Finding | Evidence | Disposition |
| --- | --- | --- | --- | --- | --- |
| ADMIN-UX-001 | P2 | `/admin`, `/application/enterprise`, `/admin/probate` | Three admin workspaces used separate wrapper styles, causing inconsistent navigation, account controls and responsive behaviour. | Duplicate shell/header/sidebar constants in platform and enterprise components. | Remediated with `AdminWorkspaceShell` and shared navigation model. |
| ADMIN-UX-002 | P2 | `/application/enterprise` | Enterprise sidebar/workspace navigation did not share the Platform Administration information architecture. | Enterprise component rendered only a header and tab bar, separate from `/admin`. | Remediated for the principal entry route. |
| ADMIN-UX-003 | P2 | `/application/enterprise` | Sidebar links to tab views required safe URL state handling. | Enterprise tab state was local-only. | Remediated by reading safe `tab` query values. |
| ADMIN-UX-004 | P1 | `/internal/admin/prototype/*` | Prototype/mock routes remain implemented and visible in the build route list. | Prototype files and static routes remain under `app/internal/admin/prototype/*`. | Deferred: quarantine was not part of this phase's implementation scope. |
| ADMIN-UX-005 | P1 | `/admin/admin-users`, `/internal/admin` | Some legacy admin lifecycle dependencies remain in the broader architecture. | Existing audit documents identify duplicate `/api/admin/*` and `/api/internal/admin/*` route families. | Deferred to admin lifecycle consolidation phase. |
| ADMIN-UX-006 | P2 | `/application/enterprise` | Some controls are partial rather than full end-to-end workflows. | Bulk CSV validation, enrolment-link concurrency and report/export filter semantics are known partials. | Deferred and recorded for follow-up. |
| ADMIN-UX-007 | P2 | Enterprise detail pages | Detail workspaces still have separate local wrappers. | `EnterpriseOrganisationDetailWorkspace.tsx` and `EnterpriseLicenceDetailWorkspace.tsx` retain page-local headers. | Deferred to detail-workspace remediation. |
| ADMIN-UX-008 | P3 | `/admin`, `/application/enterprise` | Material icons were not consistently used in admin navigation labels. | Previous nav was text-only in `/admin`; enterprise had no shared sidebar. | Remediated in shared navigation. |

## Functional Actions

| Route | Action | Backend/API | Current result |
| --- | --- | --- | --- |
| `/admin` | Dashboard cards | `/api/internal/admin/dashboard-summary` | Functional aggregate/read-only navigation. |
| `/admin/admin-users` | Invite administrator | `/api/internal/admin/admin-users` | Functional and audited from previous Phase 3 proof. |
| `/admin/admin-users` | Lifecycle action | `/api/internal/admin/admin-users` | Functional and protected from self/last-super/stale state by Phase 3 controls. |
| `/application/enterprise` | Add organisation | `/api/internal/admin/enterprise` `create_organisation` | Functional; contextual toggle exists. |
| `/application/enterprise` | Add licence | `/api/internal/admin/enterprise` `create_licence` | Functional; contextual toggle exists. |
| `/application/enterprise` | Invite/revoke/resend enterprise users | `/api/internal/admin/enterprise` invitation actions | Functional, with validation follow-ups. |
| `/application/enterprise` | Governed export | `/api/internal/admin/enterprise` `export_report` | Functional governed request; filter/report parity remains follow-up. |
| `/admin/probate` | Queue inspection | `/api/internal/admin/probate-cases` | Functional entry view. |
| `/admin/probate/[caseId]` | Probate decisions/evidence | Probate case APIs | Functional by existing tests, not redesigned here. |

## UX and Responsive Findings

- The shared shell now provides one responsive sidebar, mobile drawer, header, workspace switcher, identity area and sign-out action.
- The shell uses minimum touch target sizing for mobile controls and prevents whole-page horizontal overflow by constraining content and wrapping action groups.
- Existing data tables still rely on contained horizontal scrolling; full mobile card conversion is deferred.
- Enterprise organisation/licence detail workspaces still need the shared shell in the next phase.

## Security and Permission Findings

- Navigation filtering uses existing canonical capability strings only; no new role model was introduced.
- Server-side access and action enforcement remain unchanged.
- Hidden or unavailable controls are not treated as the authority.
- Private vault content remains excluded from admin/enterprise operational payloads.

## Prioritised Backlog

| ID | Severity | Title | Affected routes | Recommended remediation |
| --- | --- | --- | --- | --- |
| ADMIN-NEXT-001 | P1 | Consolidate enterprise detail shells | `/application/enterprise/organisations/[organisationId]`, `/application/enterprise/licences/[licenceId]` | Move detail pages to `AdminWorkspaceShell`, preserve APIs and add responsive tests. |
| ADMIN-NEXT-002 | P1 | Quarantine remaining prototypes | `/internal/admin/prototype/*` | Block or local-gate prototype routes outside local development. |
| ADMIN-NEXT-003 | P1 | Complete admin lifecycle consolidation | `/admin/admin-users`, `/internal/admin` | Remove remaining legacy lifecycle routing and keep canonical `/admin` controls only. |
| ADMIN-NEXT-004 | P1 | Harden enterprise bulk invitation validation | `/application/enterprise` invitations | Validate duplicates, existing members, missing licence, unsupported roles and seat shortfall server-side. |
| ADMIN-NEXT-005 | P1 | Transactional enrolment-link claims | `/api/internal/admin/enterprise`, invitation acceptance | Add transaction/locking proof for claim count and seat reservation. |
| ADMIN-NEXT-006 | P2 | Convert admin tables to shared responsive table/card primitive | Platform, enterprise and probate lists | Add one reusable table/card component with empty/error/loading states. |
| ADMIN-NEXT-007 | P2 | Report/export parity | `/application/enterprise` reports | Ensure every filter and cohort/consent decision is applied consistently to UI and export. |

## Evidence Commands

See the implementation report for exact validation and hosted UAT commands.
