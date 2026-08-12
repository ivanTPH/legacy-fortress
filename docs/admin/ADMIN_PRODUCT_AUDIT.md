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
| ADMIN-UX-004 | P1 | `/internal/admin/prototype/*` | Prototype/mock routes remain implemented but must not be operationally reachable outside local development. | `app/internal/admin/prototype/layout.tsx` denies non-local/non-explicit access; normal link crawl now excludes quarantined prototype source. | Remediated for staging/production quarantine; prototype source retained for local development only. |
| ADMIN-UX-005 | P1 | `/admin/admin-users`, `/internal/admin` | Some legacy admin lifecycle dependencies remained in the broader architecture. | Earlier audit documents identified duplicate `/api/admin/*` and `/api/internal/admin/*` route families. | Remediated for Platform Administration: `/internal/admin` and `/internal/admin/probate` redirect to canonical routes, and runtime `/api/admin/*` route handlers have been removed. |
| ADMIN-UX-006 | P2 | `/application/enterprise` | Some controls are partial rather than full end-to-end workflows. | Bulk CSV validation, enrolment-link concurrency and report/export filter semantics are known partials. | Deferred and recorded for follow-up. |
| ADMIN-UX-007 | P2 | Enterprise detail pages | Detail workspaces used separate local wrappers. | `EnterpriseOrganisationDetailWorkspace.tsx` and `EnterpriseLicenceDetailWorkspace.tsx` previously retained page-local headers. | Remediated with `AdminWorkspaceShell` while preserving existing enterprise APIs. |
| ADMIN-UX-008 | P3 | `/admin`, `/application/enterprise` | Material icons were not consistently used in admin navigation labels. | Previous nav was text-only in `/admin`; enterprise had no shared sidebar. | Remediated in shared navigation. |

## Functional Actions

| Route | Action | Backend/API | Current result |
| --- | --- | --- | --- |
| `/admin` | Dashboard cards | `/api/internal/admin/dashboard-summary` | Functional aggregate/read-only navigation. |
| `/admin/admin-users` | Invite administrator | `/api/internal/admin/admin-users` | Functional, audited and now displayed through shared responsive data primitives. |
| `/admin/admin-users` | Lifecycle action | `/api/internal/admin/admin-users` | Functional and protected from self/last-super/stale state by Phase 3 controls; no legacy UI handoff remains on the canonical surface. |
| `/admin/users` | User lookup and filter | `/api/internal/admin/users` | Functional privacy-bounded lookup; results now use shared responsive table/card fallback. |
| `/application/enterprise` | Add organisation | `/api/internal/admin/enterprise` `create_organisation` | Functional; contextual toggle exists. |
| `/application/enterprise` | Add licence | `/api/internal/admin/enterprise` `create_licence` | Functional; contextual toggle exists. |
| `/application/enterprise` | Invite/revoke/resend enterprise users | `/api/internal/admin/enterprise` invitation actions | Functional, with validation follow-ups. |
| `/application/enterprise` | Governed export | `/api/internal/admin/enterprise` `export_report` | Functional governed request; filter/report parity remains follow-up. |
| `/admin/probate` | Queue inspection | `/api/internal/admin/probate-cases` | Functional entry view. |
| `/admin/probate/[caseId]` | Probate decisions/evidence | Probate case APIs | Functional by existing tests, not redesigned here. |

## UX and Responsive Findings

- The shared shell now provides one responsive sidebar, mobile drawer, header, workspace switcher, identity area and sign-out action.
- The shell uses minimum touch target sizing for mobile controls and prevents whole-page horizontal overflow by constraining content and wrapping action groups.
- Priority Platform Administration tables now use a shared responsive table/card primitive; remaining enterprise/probate list conversions are deferred.
- Enterprise organisation/licence detail workspaces now use the shared shell; remaining enterprise/probate list conversions are deferred.

## Security and Permission Findings

- Navigation filtering uses existing canonical capability strings only; no new role model was introduced.
- Server-side access and action enforcement remain unchanged.
- Hidden or unavailable controls are not treated as the authority.
- Private vault content remains excluded from admin/enterprise operational payloads.

## Prioritised Backlog

| ID | Severity | Title | Affected routes | Recommended remediation |
| --- | --- | --- | --- | --- |
| ADMIN-NEXT-001 | P2 | Review retained local-only prototypes | `/internal/admin/prototype/*` | Decide whether retained local-only prototype source should be deleted or archived after owner sign-off. |
| ADMIN-NEXT-002 | P3 | Archive historical admin mock fixtures | `lib/backend/adminRoleApiHandlers.ts`, `components/admin/prototype/*` | The runtime `/api/admin/*` API family is removed; decide whether the remaining unit-level mock contract helpers should be archived after tests no longer need them. |
| ADMIN-NEXT-003 | P1 | Harden enterprise bulk invitation validation | `/application/enterprise` invitations | Validate duplicates, existing members, missing licence, unsupported roles and seat shortfall server-side. |
| ADMIN-NEXT-004 | P1 | Transactional enrolment-link claims | `/api/internal/admin/enterprise`, invitation acceptance | Add transaction/locking proof for claim count and seat reservation. |
| ADMIN-NEXT-005 | P2 | Extend shared responsive table/card primitive | Enterprise and probate lists | Apply the new reusable table/card component to remaining operational lists with empty/error/loading states. |
| ADMIN-NEXT-006 | P2 | Report/export parity | `/application/enterprise` reports | Ensure every filter and cohort/consent decision is applied consistently to UI and export. |

## Platform Administration Functional Completion Update

| ID | Severity | Area | Result | Evidence |
| --- | --- | --- | --- | --- |
| ADMIN-PFC-001 | P1 | Prototype route quarantine | Prototype routes are quarantined outside local development and excluded from normal source link crawl. | `app/internal/admin/prototype/layout.tsx`, `scripts/link-crawler.mjs`, `tests/admin-platform-functional-completion.test.mjs`. |
| ADMIN-PFC-002 | P2 | Platform responsive data | Administrator invitations, admin users and safe user lookup now render through the shared responsive data table/card primitive. | `components/admin/AdminPrimitives.tsx`, `components/admin/AdminControlPlaneWorkspace.tsx`. |
| ADMIN-PFC-003 | P1 | Legacy entry isolation | `/internal/admin` and `/internal/admin/probate` redirect to canonical `/admin` and `/admin/probate`. | `app/internal/admin/page.tsx`, `app/internal/admin/probate/page.tsx`. |

## Platform Administration API Consolidation

| Route family | Decision | Evidence |
| --- | --- | --- |
| `/api/internal/admin/admin-users` | Canonical lifecycle API for administrator invitation, resend, revoke, activation, suspension/reactivation and role change. | Server route uses `requireAdminAccess`, `requireAdminCapability`, `planAdminUserLifecycleUpdate`, `applyAdminUserLifecycleUpdate`, `recordAdminLifecycleDenied` and `noStoreJson`. |
| `/api/internal/admin/users` | Canonical privacy-bounded user lookup API. | Platform Administration workspace calls this route directly; it remains capability-gated server-side. |
| `/api/internal/admin/audit-history` | Canonical audit-history read API. | Platform Administration workspace calls this route directly for read-only audit inspection. |
| `/api/admin/*` | Runtime route handlers removed. Legacy mutation stubs and read-only mock contract endpoints are no longer deployed application APIs. Requests now fall through to the application not-found behaviour rather than an independent admin API surface. | Deleted `app/api/admin/**/route.ts` and `lib/backend/legacyAdminApi.ts`; `tests/admin-api-consolidation.test.mjs` asserts no runtime route handlers remain. |
| Unit-level admin mock contract helpers | Retained outside the `app/api` runtime tree for deterministic historical contract tests only. They are not imported by canonical Platform Administration pages or runtime APIs. | `lib/backend/adminRoleApiHandlers.ts`, `tests/admin-role-api-routes.test.mjs`; `components/admin/AdminControlPlaneWorkspace.tsx` contains no `/api/admin/` calls. |

Open owner decision: archive or delete the remaining unit-level historical mock helpers once all contract tests have canonical `/api/internal/admin/*` fixtures.

## Admin Dashboard Completion Update

Date: 2026-08-11

Scope: Platform Administration, Enterprise Operations, Probate Review, and the parallel email-UAT blocker.

| Workspace | Route | Control | Intended action | Backend/API | Pre-phase state | Final state | Persistence verified | Role verified | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform Administration | `/admin` | Operational metrics | Open live queues from dashboard metrics | `/api/internal/admin/dashboard-summary`, support/probate APIs | Partly shared; metrics table used older inline markup | Repaired to shared responsive table/card layout with separated label/value/status | Read-only | Capability-filtered navigation | repaired |
| Platform Administration | `/admin/support`, `/admin/invitations`, `/admin/access` | View support issue | Open contact-invitation operational detail | `/api/internal/admin/support/[invitationId]` | Functional but rendered in an older fixed table | Repaired to shared responsive data table/card layout | Detail fetch persists server state | `support:read` | repaired |
| Platform Administration | `/admin/support`, `/admin/invitations`, `/admin/access` | Send/resend/revoke contact invitation | Contact invitation lifecycle action | `/api/internal/admin/support/[invitationId]` | Functional; email receipt still externally blocked by staging mailer/test mailbox | Still functional, with clearer responsive action placement and terminal-state copy | API refreshes support snapshot after success | `support:manage` | working |
| Platform Administration | `/admin/audit` | Filter audit | Read-only audit search/filter | `/api/internal/admin/audit-history` | Functional but long actor/result text could visually run together | Repaired to shared responsive table/card layout with separate result badge | Read-only | `audit:read` | repaired |
| Platform Administration | `/admin/system-health` | Inspect subsystem health | Read-only health/status signals | `/api/internal/admin/system-health` | Functional but used older inline table | Repaired to shared responsive table/card layout | Read-only | `admin.dashboard.read` | repaired |
| Probate Review | `/admin/probate` | Review case | Open focused probate case detail | `/api/internal/admin/probate-cases` | Queue copied “legacy case controls” wording | Repaired with clear “Review case” entry and shared responsive table/card layout | Read-only list state | `verification:read` | repaired |
| Probate Review | `/admin/probate/[caseId]` | Mark under review/request information/approve/reject | Server-authorised probate transition with notes | `/api/internal/admin/probate-cases/[caseId]/actions` | API existed but canonical page did not expose actions | Repaired: decision notes, loading state, confirmation for terminal actions, state update after server success | UI updates only from returned case; API has stale/terminal protections | `verification:decide` | repaired |
| Probate Review | `/admin/probate/[caseId]` | Evidence metadata | Inspect evidence metadata only | `/api/internal/admin/probate-cases` and signed-url route where used | Functional metadata; list used page-local rows | Repaired to shared responsive table/card layout; no new viewer introduced | Read-only | `verification:read` | repaired |
| Enterprise Operations | `/application/enterprise` | Portfolio, organisation, licence, invitations, reports | Existing enterprise operations | `/api/internal/admin/enterprise` | Functional from prior phases | No backend change in this phase; retained to avoid broad rewrite | Existing tests cover create/update/export paths | Capability/organisation scoped | working |
| Enterprise Operations | detail routes | Organisation/licence actions | Contextual detail actions | `/api/internal/admin/enterprise` | Functional from prior phases with remaining bulk/enrolment/report follow-ups | No change in this phase | Existing tests cover detail forms | Capability/tenant scoped | working |
| Email UAT | invitation lifecycle | Email receipt/acceptance | Staging invitation delivery proof | Supabase Auth OTP mailer | Blocked by unavailable reliable staging mailbox/provider and Supabase throttle | Still blocked; no application defect confirmed | Not fully verified | N/A | blocker |

Action matrix totals for this phase: working 3, repaired 7, disabled/deferred 0, blocked 1.

Top remaining P1/P2 items:

| ID | Severity | Area | Blocker |
| --- | --- | --- | --- |
| ADMIN-DASH-001 | P1 | Email-UAT | Staging invitation receipt and acceptance cannot receive an unconditional pass until a reliable staging SMTP/provider or test mailbox is available. |
| ADMIN-DASH-002 | P1 | Enterprise invitations | Bulk invitation duplicate/member/seat validation remains a focused backend follow-up. |
| ADMIN-DASH-003 | P1 | Enterprise enrolment links | Claim count and seat reservation still need transactional proof. |
| ADMIN-DASH-004 | P2 | Hosted populated-state UAT | Representative staging organisation/licence/probate data remains limited; broader hosted visual proof should use approved persistent demo fixtures or controlled synthetic data. |

## Admin Core Workspace Recovery Update

Date: 2026-08-12

Scope: duplicate contact invitation handling, workspace separation, Platform Administration, Enterprise Operations, and Probate Review.

| Workspace | Route | Control | Intended action | Backend/API | Pre-phase state | Final state | Persistence verified | Role verified | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Personal Vault contacts | `/contacts` | Save contact setup | Create or update contact invitation projection | `contacts`, `contact_invitations`, `role_assignments` canonical contact repository | A second pending invitation for the same owner/email attempted another insert and surfaced the PostgreSQL unique-index error. | Repaired: active pending/accepted owner/email invitations resolve to the existing row, show a safe pending/accepted message, and keep Resend/Revoke/Edit/Cancel available. | Repository path updates existing invitation projection; focused tests prove no duplicate insert path remains. | Owner session required by existing Supabase client flow | repaired |
| Personal Vault contacts | `/contacts` | Send/resend invite | Send existing invitation by Supabase Auth OTP path | `sendContactInvite`, Supabase Auth OTP | Send fallback could also attempt a duplicate insert when no invitation id was passed. | Repaired: send path resolves active owner/email invitation before insert and maps duplicate database errors to safe copy. | Existing invitation id reused; delivery status remains governed by email provider availability. | Owner plan and session checks preserved | repaired |
| Platform Administration | `/admin`, `/admin/users`, `/admin/admin-users`, `/admin/support`, `/admin/access`, `/admin/audit`, `/admin/system-health`, `/admin/settings` | Sidebar navigation | Operate platform control-plane routes | Shared `AdminWorkspaceShell`, `PLATFORM_ADMIN_NAVIGATION` | Platform sidebar also labelled Enterprise/Probate as if they were interchangeable workspaces. | Repaired: platform navigation uses platform-operational groups only; enterprise/probate switching is handled by workspace selector. | Read/navigation state only | Capability-filtered navigation | repaired |
| Enterprise Operations | `/application/enterprise` and detail routes | Sidebar navigation | Operate enterprise portfolio, organisations, licences, seats, invitations and enterprise audit | `/api/internal/admin/enterprise` | Enterprise sidebar included “Related Workspaces” links back into Platform/Probate. | Repaired: enterprise navigation contains only enterprise operations; cross-workspace changes use the workspace selector. | Existing enterprise API refresh patterns preserved | Enterprise capability and org scope | repaired |
| Probate Review | `/admin/probate`, `/admin/probate/[caseId]`, `/admin/verification` | Sidebar navigation | Review probate/verification queue and evidence context | `/api/internal/admin/probate-cases`, verification APIs | Probate routes were detected as Platform Administration and reused the full platform sidebar. | Repaired: probate route is recognised as Probate Review workspace and renders a probate-focused navigation set. | Existing case action state refresh preserved | Probate/verification capabilities | repaired |
| Platform Administration | `/admin/admin-users` | Admin lifecycle actions | Invite, resend, revoke, activate/deactivate, role change | `/api/internal/admin/admin-users` | Functional from previous lifecycle phases. | Working; not changed in this phase. | Existing lifecycle tests cover persistence/safeguards | Admin lifecycle capabilities | working |
| Platform Administration | `/admin/users` | User lookup | Privacy-bounded user search/detail | `/api/internal/admin/users` | Functional, no private vault content exposed. | Working; not changed in this phase. | Existing API re-fetch/detail route | `users:lookup` | working |
| Enterprise Operations | `/application/enterprise` | Create/open organisation | Enterprise organisation workflow | `/api/internal/admin/enterprise` | Functional from previous enterprise phases. | Working; navigation context now stays enterprise-only. | Existing enterprise tests cover create/update flow | Enterprise capability and org scope | working |
| Probate Review | `/admin/probate/[caseId]` | Approve/reject/review case | Probate decision workflow | `/api/internal/admin/probate-cases/[caseId]/actions` | Functional from previous probate phase. | Working; now presented inside Probate Review context. | Existing probate tests cover terminal protections | `verification:decide` | working |

Action matrix totals for recovery: working 4, repaired 5, disabled/removed 0, remaining P1 1.

Remaining P1: staging email receipt/acceptance UAT still requires a reliable staging SMTP/provider or mailbox; no application email defect is proven by the current environment evidence.

## Evidence Commands

See the implementation report for exact validation and hosted UAT commands.
