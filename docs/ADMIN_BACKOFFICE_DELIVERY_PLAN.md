# Legacy Fortress Admin Back-Office Delivery Plan

Status: Not Started
Created: 2026-06-30
Owner: Product / Engineering
Scope: admin, probate, executor verification, support, document governance, audit, enterprise and licensing back-office work.

This document is the source of truth for future Legacy Fortress admin, probate, support, document-governance, enterprise and back-office delivery. It should be read alongside:

- [UAT_REMEDIATION_TODO.md](./UAT_REMEDIATION_TODO.md)
- [KNOWN_TECH_DEBT.md](./KNOWN_TECH_DEBT.md)
- [BUILD_AND_RELEASE.md](./BUILD_AND_RELEASE.md)
- [HOSTED_STAGING_READINESS_PLAN.md](./HOSTED_STAGING_READINESS_PLAN.md)
- [admin-enterprise-rollout-plan.md](./admin-enterprise-rollout-plan.md)
- [ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md](./ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md)
- [route-matrix.md](./route-matrix.md)

## Executive Purpose

Legacy Fortress has two separate release tracks:

1. Customer-vault functionality: owner, demo reviewer and linked-access user workflows for records, documents, contacts, executors, reminders and account settings.
2. Operational admin functionality: internal support, probate review, executor verification, document governance, audit, organisation/licence management and controlled back-office actions.

The customer-vault release track may progress independently when its browser UAT, build, lint, rollback and deployment gates pass. Admin/probate must not be treated as part of the same readiness decision unless the specific admin gate has also passed.

Current admin/probate status: partial foundation plus prototype. The repository contains a small real operational admin workspace and several static/mock prototype screens. Admin/probate is not production-ready.

The main current risk is that prototype screens can look like operational tooling. Any prototype route must be hidden, gated, or clearly labelled before stakeholder review or production release.

Hosted staging status: follow [HOSTED_STAGING_READINESS_PLAN.md](./HOSTED_STAGING_READINESS_PLAN.md) before any hosted admin/probate UAT. Phase 1 and Phase 2B have local proof, but hosted staging still needs isolated environment verification, migration history review, backup/rollback confirmation, synthetic admin users and independent role/API/RLS proof.

## Current-State Inventory

### Real Operational Admin Capabilities

These capabilities have real code paths and use Supabase-backed admin/service access:

| Capability | Current route/API | Current status | Notes |
|---|---|---:|---|
| Admin session check | `/api/internal/admin/session` | Partial | Requires signed-in user and `admin_users` row or master admin email. |
| Admin user list/add | `/api/internal/admin/admin-users` | Partial | Can add active admin email rows. Needs granular role model and audit before production use. |
| User lookup | `/api/internal/admin/users` | Partial | Uses Supabase Auth admin list plus profile, billing and record counts. Needs privacy review and role scoping. |
| Support snapshot | `/api/internal/admin/support` | Partial | Summarises invitation, linked-access and verification states. Not a full support case queue. |
| Executor verification queue | `/api/internal/admin/verifications` | Partial | Loads pending/submitted verification requests. |
| Verification action | `/api/internal/admin/verifications` POST | Partial | `review`, `approve`, and `reject` update verification, role assignment and access grant rows. Needs audit, evidence rules, reasons and browser proof. |

Key files:

- [components/admin/AdminOpsWorkspace.tsx](../components/admin/AdminOpsWorkspace.tsx)
- [lib/admin/access.ts](../lib/admin/access.ts)
- [lib/admin/operations.ts](../lib/admin/operations.ts)
- [app/api/internal/admin/session/route.ts](../app/api/internal/admin/session/route.ts)
- [app/api/internal/admin/admin-users/route.ts](../app/api/internal/admin/admin-users/route.ts)
- [app/api/internal/admin/users/route.ts](../app/api/internal/admin/users/route.ts)
- [app/api/internal/admin/support/route.ts](../app/api/internal/admin/support/route.ts)
- [app/api/internal/admin/verifications/route.ts](../app/api/internal/admin/verifications/route.ts)

### Partial Capabilities

| Capability | Current status | Gap before production |
|---|---:|---|
| Route guard model | Partial | `proxy.ts` can apply role middleware but real production trusted-claim enforcement is not complete across all admin routes. |
| Role/capability vocabulary | Partial | `lib/auth/platformRoles.ts` and governance permission templates exist, but production persistence and assignment are not complete. |
| Access grants | Partial | Existing `account_access_grants` supports linked access; admin revocation/approval needs governed workflow and audit. |
| Verification data model | Partial | `verification_requests` exists; full case lifecycle, evidence requirements and decision reasons are missing. |
| Audit event model | Partial | Event shape and validation exist; persistence is preview-only, not append-only compliance logging. |
| Document governance | Partial | Customer attachment architecture exists; admin evidence access and governed document review are missing. |
| Admin browser tests | Partial | Prototype and architecture tests exist; production-like admin role browser proof is missing. |

### Static / Mock / Prototype Pages

The following routes are prototype surfaces and must not be presented as operational tooling:

- `/internal/admin/prototype`
- `/internal/admin/prototype/cases`
- `/internal/admin/prototype/cases/[caseId]`
- `/internal/admin/prototype/verifications`
- `/internal/admin/prototype/access`
- `/internal/admin/prototype/audit`
- `/internal/admin/prototype/users`
- `/internal/admin/prototype/users/[userId]`
- `/internal/admin/prototype/enterprise`
- `/internal/admin/prototype/organisations`
- `/internal/admin/prototype/organisations/[orgId]`
- `/internal/admin/prototype/licences`
- `/internal/admin/prototype/campaigns`
- `/internal/admin/prototype/reports`
- `/internal/admin/prototype/reports/client-insights`

These pages use static/mock data from `components/admin/prototype/*`. Some controls are disabled by design. The probate case detail prototype explicitly says actions are disabled and does not call an API.

### Missing Capabilities

- Persistent append-only audit events.
- Production admin role assignment and trusted role claims.
- Server-side capability checks per admin action.
- Real probate case lifecycle.
- Evidence document review with secure signed access.
- Required decision notes and policy decisions for approve/reject/revoke.
- Access-grant revocation/reinstatement workflows.
- Support case queue with statuses, assignments and escalation.
- Safe account restriction/reinstatement.
- Admin document access audit trail.
- Organisation/licence management backed by real data.
- Export governance and approval.
- Enterprise reporting with consent enforcement.
- End-to-end browser UAT for every admin role and denial case.

## Target Operating Model

Admin users authenticate through the same production authentication system, then receive trusted server-side role/capability claims. Client UI may hide unavailable controls, but all authorisation decisions must be enforced server-side.

### Admin Roles

- `super_admin`: full operational and platform governance access, including role administration, emergency restrictions and audit review.
- `support_agent`: support queue, safe user lookup, invitation/access issue triage and escalation. No probate approval unless separately granted.
- `verification_reviewer`: executor/contact verification review and evidence triage. No unrestricted vault access.
- `probate_reviewer`: probate case review, evidence decisions and limited access unlock/revocation within governed case workflows.
- `auditor`: read-only access to audit events, support/probate decisions and operational reports. No mutation permissions.
- `organisation_admin`: enterprise organisation/licence management only where enterprise features are explicitly approved.

### Role / Capability Matrix

Legend: `Y` permitted, `R` read-only, `E` escalate/request only, `N` not permitted.

| Capability | super_admin | support_agent | verification_reviewer | probate_reviewer | auditor | organisation_admin |
|---|---:|---:|---:|---:|---:|---:|
| User lookup | Y | Y | R | R | R | N |
| Support cases | Y | Y | E | E | R | N |
| Account restriction/reinstatement | Y | E | N | E | R | N |
| Executor verification | Y | E | Y | Y | R | N |
| Probate cases | Y | E | R | Y | R | N |
| Evidence document access | Y | E | Y | Y | R | N |
| Access-grant approval/revocation | Y | E | E | Y | R | N |
| Audit review | Y | R | R | R | R | R for organisation scope |
| Reporting | Y | R limited | R limited | R limited | R | Y for organisation scope |
| Organisation/licence management | Y | E | N | N | R | Y |
| Exports | Y with approval/audit | N | N | N | R only | E/Y only if approved |

## Phase 1 — Admin Foundation: roles, capabilities, route guards and append-only audit events

Phase status: In UAT

### Objective

Establish the secure foundation for all admin work: trusted roles, server-side capability checks, hidden/gated prototype routes and persistent append-only audit events.

### Prerequisites

- Confirm production authentication provider and trusted role claim source.
- Confirm whether admin roles live in Supabase metadata, dedicated tables, or both.
- Confirm staging/Preview environment for admin UAT.
- Review [BUILD_AND_RELEASE.md](./BUILD_AND_RELEASE.md) service-role requirements.

### In Scope

- Hide, gate or relabel `/internal/admin/prototype/*`.
- Define production role and capability model.
- Add append-only audit event storage.
- Add server-side capability enforcement helpers.
- Add browser test harness for role-based admin flows and denial cases.
- Update existing admin docs to point to this plan.

### Explicitly Out Of Scope

- Probate approval workflow.
- Support case workflow.
- Enterprise/licensing implementation.
- Export functionality.
- Any deployment without release-gate approval.

### Functional Requirements

- Admin users must be distinguishable by trusted role/capability.
- Non-admin users must not access admin routes or APIs.
- Prototype routes must not be confused with live operations.
- All admin mutations must be capable of emitting append-only audit events.
- Admin APIs must return clear denial reasons without leaking private data.

### Security / Privacy Requirements

- No client-side-only authorisation.
- No service-role credentials in browser code.
- No query-string prototype role grants in production.
- No access to unrelated private vault data.
- Denied access must return 403/404 consistently.
- Audit events must omit secrets, passwords, tokens and unnecessary personal data.

### Database / Data-Model Work

- Create `audit_events` append-only table or equivalent immutable event store.
- Define indexes for actor, resource, category, timestamp and request id.
- Define admin role/capability persistence if trusted claims need database backing.
- Add RLS/service access policies appropriate for server-only writes and controlled reads.

### UI / Workspace Requirements

- Replace or clearly separate prototype navigation from operational admin.
- Add admin workspace shell with role, environment and read/write status labels.
- Add safe restricted-access and no-permission states.
- Do not expose unfinished prototype CTAs as live actions.

### API / Service Requirements

- Add capability guard middleware/helper for admin API routes.
- Add audit writer service.
- Add request id/idempotency support for admin mutations.
- Add structured error envelope for denied admin actions.
- Convert mock-only role APIs or keep them explicitly prototype-only.

### Test Requirements

- Unit tests for capability evaluation.
- Unit tests for audit event validation and persistence.
- API tests for denied non-admin requests.
- API tests for each role's permitted/denied capability.
- Browser tests for admin route denial and allowed shell access.

### Browser UAT Scenarios

- Non-admin opens `/internal/admin`: denied.
- Non-admin opens `/internal/admin/prototype`: hidden, denied or clearly labelled based on environment.
- Admin opens `/internal/admin`: sees role and environment.
- Admin action emits audit event.
- Denied action shows clear UI and audit/denial evidence where appropriate.

### Documentation Updates

- Update [UAT_REMEDIATION_TODO.md](./UAT_REMEDIATION_TODO.md).
- Update [BUILD_AND_RELEASE.md](./BUILD_AND_RELEASE.md) if new commands/env are introduced.
- Update [.env.example](../.env.example) only if a new environment variable is required.

### Acceptance Criteria

- Prototype route handling is explicit and tested.
- Admin role/capability source is defined and tested.
- Append-only audit persistence exists and is proven.
- Non-admin denial is proven in browser and API tests.
- No admin feature can be called with only client-side state.

### Rollout / Rollback Requirements

- Roll out behind admin feature flag or Preview/staging-only route guard.
- Rollback by disabling admin feature flag and retaining audit table.
- Do not delete audit data during rollback.

### Known Risks

- Existing prototype tests may depend on route availability.
- Trusted role claim source may differ between local, Preview and production.
- Audit schema can become too broad if not kept event-focused.

### Immediate Phase 1 Actions

| Item | Owner | Status | Priority | Dependencies | Acceptance criteria | Evidence link or test reference | Changed files/migrations | Date completed | Notes |
|---|---|---:|---:|---|---|---|---|---|---|
| Hide/gate prototype routes | Engineering | Not Started | P0 | Route guard decision | Prototype routes cannot be mistaken for live admin in production | Browser route-denial test | TBD |  | Keep staging preview possible only if labelled. |
| Establish trusted admin role/capability model | Engineering/Product | Not Started | P0 | Auth role source decision | Roles resolve server-side and map to capability matrix | Unit + API guard tests | TBD |  | Must replace prototype query grants for production. |
| Persistent append-only audit events | Engineering | Not Started | P0 | Audit schema approval | Admin mutation writes immutable event | Audit persistence test | TBD |  | No updates/deletes except retention policy if approved. |
| Server-side capability enforcement | Engineering | Not Started | P0 | Role model | Every admin API mutation checks capability server-side | API denial/allow tests | TBD |  | UI hiding is secondary only. |
| Role-based browser test harness | QA/Engineering | Not Started | P1 | Seeded admin personas | Browser proves allowed and denied role journeys | Playwright admin role suite | TBD |  | Use synthetic test accounts only. |
| Hide/gate prototype routes | Codex | In UAT | P0 | Route guard decision | Prototype routes pass through role middleware before rendering | `node --test tests/admin-phase1-foundation.test.mjs`; 2026-07-01 browser UAT route denial | `proxy.ts`; `tests/admin-phase1-foundation.test.mjs` | 2026-07-01 | Prototype pages are gated in local runtime; explicit query flag no longer opens the mock page and the restricted-route message is visible. |
| Establish trusted admin role/capability model | Codex | In UAT | P0 | Auth role source decision | Server resolves `super_admin`, `support_agent`, `verification_reviewer`, `probate_reviewer`, `auditor`, `organisation_admin` to capabilities | `node --test tests/admin-phase1-foundation.test.mjs`; 2026-07-01 role API/browser UAT; `npm run build` | `lib/admin/capabilities.ts`; `lib/admin/access.ts`; `supabase/migrations/20260630170000_admin_phase1_foundation.sql` | 2026-07-01 | Existing master admins resolve to `super_admin`; synthetic local role users were created with `phase1-` emails. |
| Persistent append-only audit events | Codex | In UAT | P0 | Audit schema approval | Additive `audit_events` table has update/delete prevention trigger and admin audit writer | 2026-07-01 local DB verification; super-admin admin-user grant wrote one audit event; update/delete attempts rejected | `lib/admin/audit.ts`; `supabase/migrations/20260630170000_admin_phase1_foundation.sql` | 2026-07-01 | Runtime write and append-only protection proven locally. Do not delete audit data during rollback. |
| Server-side capability enforcement | Codex | In UAT | P0 | Role model | Existing internal admin APIs check capability server-side before sensitive actions | 2026-07-01 browser/API UAT: standard 403, support read 200/manage 403, verification read 200/decide 403, probate read 200, auditor mutation/support 403, super admin action 200 | `app/api/internal/admin/*.ts`; `components/admin/AdminOpsWorkspace.tsx` | 2026-07-01 | Safe user-facing 403 messages returned without DB details. |
| Role-based browser test harness | Codex | In UAT | P1 | Seeded admin personas | Browser proves allowed and denied role journeys | 2026-07-01 Playwright runtime script; 66 local Supabase browser requests, 0 hosted Supabase requests | Local-only ignored `.env.phase1.local`; no committed harness file | 2026-07-01 | Browser proof is manual/scripted, not yet committed as a reusable selector-specific test. |
| Phase 1 runtime gate | Codex | Complete | P0 | Isolated local Legacy Fortress Supabase runtime and local app env | Required migration is applied, schema/RLS is verified, role-based browser UAT passes, and auditor can inspect audit history read-only | 2026-07-01 DB/runtime/browser evidence; auditor and super admin read `/api/internal/admin/audit-history`; unauthorized roles denied; audit panel has no mutation controls | `supabase/migrations/20260630170000_admin_phase1_foundation.sql`; `lib/admin/*`; `app/api/internal/admin/*`; `components/admin/AdminOpsWorkspace.tsx`; `tests/admin-phase1-foundation.test.mjs` | 2026-07-01 | Phase 1 runtime gate complete locally. Phase 2B may begin only after explicit approval. |

## Phase 2 — Probate and Executor Verification: cases, evidence, decisions, access grants and revocation

Phase status: Blocked

### Objective

Deliver real probate and executor verification workflows with governed evidence review, decision recording, limited access grants and revocation.

### Prerequisites

- Phase 1 complete.
- Legal/product decision on probate case states and required evidence.
- Secure document access pattern confirmed.
- Synthetic probate test data available.

### In Scope

- Probate case model.
- Executor verification case queue.
- Evidence document linkage.
- Approve/reject/review/needs-info decisions.
- Access-grant activation and revocation.
- Decision notes and audit events.

### Explicitly Out Of Scope

- Enterprise licensing.
- Payment/billing.
- Unrestricted vault editing by probate users.
- Automated legal decisioning.
- External identity provider integration unless separately approved.

### Functional Requirements

- Cases have owner, requester, evidence, status, assigned reviewer and timeline.
- Reviewers can mark evidence reviewed, request more information, approve or reject.
- Approval can only grant scoped read-only access.
- Rejection preserves reason and does not grant access.
- Revocation immediately disables the linked access path.

### Security / Privacy Requirements

- Evidence documents use signed, time-limited access.
- Reviewer access is scoped to case-relevant data only.
- No private owner settings, billing or unrelated vault data are exposed.
- All decisions require actor, reason, timestamp, resource and policy decision.

### Database / Data-Model Work

- Add or formalise probate case table.
- Link `verification_requests`, `role_assignments`, `account_access_grants`, contacts and documents.
- Add decision records or event-backed timeline.
- Add revocation metadata and indexes.

### UI / Workspace Requirements

- Replace prototype probate case detail with live case detail.
- Show status, evidence, requester, owner, reviewer, decision panel and audit timeline.
- Make disabled/unavailable actions explain why.
- Clearly label read-only linked-access scope.

### API / Service Requirements

- Case list/detail APIs.
- Evidence signed-url API.
- Decision mutation API.
- Access grant activate/revoke service.
- Audit event emission for every decision and document view.

### Test Requirements

- Unit tests for case state transitions.
- API tests for approve/reject/revoke capability checks.
- Storage tests for evidence signed access.
- Browser tests for reviewer workflow.
- Denial tests for support/auditor/non-admin roles.

### Browser UAT Scenarios

- Reviewer opens submitted case and views evidence.
- Reviewer rejects with reason; access remains blocked.
- Reviewer approves with reason; limited read-only access works.
- Reviewer revokes access; linked user loses access after refresh.
- Auditor can view timeline but cannot mutate.

### Documentation Updates

- Update this plan with evidence.
- Update UAT remediation tracker.
- Document case states and access-grant rules.

### Acceptance Criteria

- Full approve/reject/revoke lifecycle passes in browser with synthetic data.
- Audit events prove each evidence view and decision.
- Permission denial proof exists for every non-permitted role.
- No unrelated vault data is visible.

### Rollout / Rollback Requirements

- Roll out behind admin/probate feature flag.
- Rollback disables case mutation endpoints while preserving audit/case data.
- Provide SQL rollback only for additive schema if approved.

### Known Risks

- Access-grant status transitions already exist and must not break linked-access customer flows.
- Evidence document linkage may need storage migration.
- Legal wording must avoid implying automated probate/legal validation.

### Phase 2B Runtime Gate Status - 2026-07-01

Phase 2B implementation was approved after Phase 1 runtime verification completed, and has now passed local runtime/browser proof in the isolated Legacy Fortress environment.

Implemented:

- Additive migration `supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql`.
- Canonical `probate_cases` and `probate_case_evidence` tables with bounded case/evidence statuses, indexes, RLS enabled and backfill from existing `verification_requests`.
- Internal admin routes:
  - `GET/POST /api/internal/admin/probate-cases`
  - `GET /api/internal/admin/probate-cases/[caseId]`
  - `POST /api/internal/admin/probate-cases/[caseId]/actions`
  - `GET/POST /api/internal/admin/probate-cases/[caseId]/evidence`
  - `GET /api/internal/admin/probate-cases/[caseId]/evidence/[evidenceId]/signed-url`
- Service layer `lib/admin/probateCases.ts` for case loading, case creation from existing verification requests, mandatory-note actions, case-linked evidence upload, signed evidence URL creation, limited read-only access-grant activation and revocation.
- Live admin workspace section in `components/admin/AdminOpsWorkspace.tsx` labelled `Probate and executor cases`.
- Focused automated coverage in `tests/admin-phase2b-probate-cases.test.mjs`.

Runtime/browser evidence:

- Local-only proof used `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421`; browser network capture saw only `http://127.0.0.1:55421` as the Supabase origin.
- Synthetic local case: `verificationRequestId=2699e341-0821-4275-a1fc-fa8decaa0108`, `caseId=50f0413a-f0fe-4851-b2e8-7ee8a0471e67`, `evidenceId=a65b0e83-f2b2-40cc-839f-5caec40feb2f`.
- Role proof: unauthenticated case API returned 401; standard user, support agent and auditor returned 403; verification reviewer could list/create/request-info/mark-review but approve returned 403; probate reviewer approved and revoked; super admin read the audit trail.
- Lifecycle proof: case moved `submitted -> needs_information -> under_review -> approved -> revoked`; approval activated an `account_access_grants` row with `permissions_override.scope='probate_case'` and `read_only=true`; revocation set the linked grant to `revoked`.
- Evidence proof: PDF evidence uploaded to local `vault-docs`, appeared in the admin workspace, and was opened through a time-limited signed URL.
- Audit proof: audit history contained case submitted, evidence uploaded, evidence viewed, case approve and case revoke events; direct audit update/delete attempts remained rejected by append-only triggers.

Verification commands:

- `node --test tests/admin-phase2b-probate-cases.test.mjs` passed 4/4.
- `node --test tests/admin-phase1-foundation.test.mjs` passed 5/5.
- `npm run test:stabilisation` passed 34/34.
- `npm run lint` passed.
- `npm run build` passed.

Remaining Phase 2B risks before any production deployment:

- The first implementation proves controlled admin-side access-grant lifecycle, but linked-user/customer-facing probate access consumption still needs product/legal review before live use.
- Legal copy must continue to avoid implying automated legal/probate validation.
- Evidence retention/destruction policy remains a later governance decision; rollback should preserve case/evidence/audit rows.

Decision:

- Phase 2B is implemented and locally proven.
- Phase 3 must not begin without explicit approval.

### MVP Operational Readiness Phase 3 - 2026-07-02

Status: Complete for local controlled UAT; no Phase 4 started.

This section records the approved end-to-end operational readiness UAT phase. It is separate from the back-office delivery plan's feature Phase 3 (`Support and User Administration`) below, which remains future delivery work.

Scope completed:

- Local-only owner, executor, standard user, support agent, verification reviewer, probate reviewer, auditor and super admin journeys.
- Customer-vault route retrieval across legal wills, finances/bank, property, business, identity documents, cars/transport, employment, personal wishes and executor contacts.
- Shared attachment proof for PDF, image and office-style document records using existing storage/document metadata and `AttachmentGallery`.
- Probate/evidence/access lifecycle using the Phase 2B admin case APIs and local synthetic accounts.
- Role-denial and audit-history checks from unauthenticated, standard, support, verification, probate, auditor and super-admin perspectives.
- Mobile viewport smoke checks for dashboard, finance, contacts and admin workspace.

Evidence:

- Local app URL: `http://localhost:3012`.
- Local Supabase origin observed in browser: `http://127.0.0.1:55421`.
- Synthetic marker: `phase3-1782988899569`.
- Browser route proof:
  - `/legal/wills` showed `Phase3 Evergreen Will`.
  - `/finances/bank` showed `Phase3 Riverbank Current Account`, `phase3-estate-plan.pdf` and `phase3-office-fallback.docx`.
  - `/vault/property` showed `Phase3 Willow House` and `phase3-property-photo.png`.
  - `/business` showed `Phase3 Cedar Studio Ltd`.
  - `/identity-documents` showed `Phase3 Fictional Passport`.
  - `/cars-transport` showed `Phase3 Copper Roadster`.
  - `/employment` showed `Phase3 Archivist Role`.
  - `/personal/wishes` showed `Phase3 Letter of Wishes`.
  - `/contacts?group=executors` showed `Phase3 Executor Contact`.
- Dashboard discovery proof: `/dashboard?search=Riverbank`, `/dashboard?search=Phase3%20Riverbank%20Current%20Account` and `/dashboard?search=phase3-estate-plan.pdf` returned the bank record and attachment. The left navigation search field is not the dashboard discovery result surface.
- Attachment proof: the saved finance record document panel exposed shared preview, download, print and remove controls for PDF; DOCX showed the expected download/open fallback and no print control.
- Probate lifecycle proof: `submitted -> needs_information -> under_review -> approved -> revoked`; approval created a read-only `probate_case` access grant; revocation set the linked grant to `revoked`; audit history contained case/evidence/access events.
- Role proof: unauthenticated 401; standard/support/auditor probate mutation denied; support scope read allowed; verification reviewer list/review allowed but approve denied; probate reviewer approve/revoke allowed; auditor audit-history read only; super admin audit-history read.
- Command proof: `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/dashboard-search-routing.test.mjs tests/attachment-merge.test.mjs tests/viewer-access-permissions.test.mjs` passed 19/19; `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed; `curl -sS http://127.0.0.1:3012/api/health/schema` returned `ok: true`.

Known Phase 3 limitations:

- Customer-facing consumption of revoked probate access remains a future browser proof item before any production probate release.
- `Multiple GoTrueClient instances` appears as a local browser warning and should be reduced during auth/client consolidation.
- The requested `.docx` UX/inclusion standards were not present in the repository, so this UAT used the existing markdown documentation as source of truth.

Release assessment:

- Suitable for controlled internal UAT only.
- Not a production-ready admin/probate release declaration.
- Do not begin the back-office `Support and User Administration` feature phase below without separate approval.

### Customer-Side Linked-Access Revocation Phase 4 - 2026-07-03

Status: Remediated locally.

This section records the approved customer-side linked executor/probate access and revocation proof. It is a release gate for the Phase 2B probate/access implementation, not a new admin feature phase and not permission to begin Phase 5.

Scope completed:

- Synthetic local owner, linked executor, probate reviewer and super-admin account setup.
- Browser proof before grant, after approval and after revocation.
- Browser proof that revocation removes customer-side UI access in the same session and a fresh session.
- Direct local REST proof for server-side enforcement.
- Audit proof for approval and revocation events.
- Durable expected-failing Playwright coverage in `tests/e2e/phase4-linked-access-revocation.spec.ts`.

Evidence:

- Local app URL: `http://127.0.0.1:3012`.
- Local Supabase origin observed in browser: `http://127.0.0.1:55421`.
- Synthetic marker: `phase4-1783092424505`.
- Before grant: linked executor saw no owner records in browser, and direct REST returned zero owner asset/document rows.
- After approval: probate reviewer approved in `/internal/admin`; linked executor saw only the approved property in `/vault/property`; `/finances/bank` redirected back to dashboard and did not show the unrelated bank record.
- Server-side blocker: after approval, direct REST against `assets` for the owner returned both the approved property and the unrelated private bank asset. The fine-grained asset scope is therefore enforced by client filtering, not by RLS/API policy.
- After revocation: same-session browser access no longer showed the approved property, direct REST returned zero owner assets, and a fresh linked-executor browser session also could not see the approved property.
- Audit: `audit_events` contained `Probate case approve` and `Probate case revoke` for the Phase 4 case.
- Command proof: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 npx playwright test tests/e2e/phase4-linked-access-revocation.spec.ts --project=desktop-chromium` completed with one expected failure; `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs` passed 9/9; `npm run test:stabilisation` passed 34/34; `npm run lint` passed; `npm run build` passed.

Required remediation before pilot:

- Tighten linked-access RLS/API scope so active probate-case grants only expose approved `permissions_override.asset_ids`, `record_ids`, section keys and case-linked documents.
- Add server-side denial tests for unrelated owner assets/documents under an active linked grant.
- Keep revoked grants excluded from both `has_linked_account_access` and any new scoped helper.
- Re-run the Phase 4 Playwright gate and remove the expected-failure marker only after the direct REST leak is fixed.

Release assessment:

- Customer-side linked-access revocation proof: originally blocked by broad linked-access RLS; remediated locally on 2026-07-03.
- New migration: `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql`.
- Local proof after remediation: `tests/e2e/phase4-linked-access-revocation.spec.ts` passed 1/1 as a normal test; direct REST no longer returned unrelated owner assets or unrelated document metadata after approval or revocation.
- Regression proof: Phase 1/2B/link tests passed 15/15; stabilisation passed 34/34; lint and build passed.
- Suitable for limited pilot with explicit safeguards once staging applies the same migration and repeats the Phase 4 browser/RLS gate against non-production data.

### Phase 5 - Staging Release Readiness And Independent Security Re-Proof - 2026-07-04

Status: Awaiting Approval / Blocked on staging pre-flight.

Purpose:

- Prepare, but not execute, the staging migration and independent security re-proof for the Phase 4 linked-access RLS remediation.
- Keep customer-vault release readiness separate from production readiness. A successful staging pass can support only a limited pilot with explicit safeguards.

Change inventory:

- Approved Phase 1-4 application/security changes include admin capability enforcement, append-only audit support, probate case/evidence APIs, admin workspace updates, attachment/record stabilisation, local CSP support and linked-access RLS remediation.
- Documentation-only changes include this plan, UAT remediation notes, known technical debt and build/release guidance.
- Local-UAT-only/review-sensitive changes include `supabase/config.toml` and local-only env/test data. `supabase/config.toml` currently contains isolated local ports, local site URL/email settings, local project id, disabled edge runtime and disabled analytics. Do not include it in a staging release without separate explicit review.
- `tsconfig.json` contains formatting churn and a generated `.next/dev/dev/types/**/*.ts` include. Treat it as review-sensitive packaging drift until intentionally approved.

Migration review:

- Candidate migration: `supabase/migrations/20260703153000_linked_access_scope_enforcement.sql`.
- Expected prerequisites: broad linked-access foundation from `20260324103000_contact_invitation_view_only_access.sql`, Phase 1 admin/audit migration `20260630170000_admin_phase1_foundation.sql`, and Phase 2B probate/evidence migration `20260701193000_admin_phase2b_probate_cases.sql`.
- Expected effect: replace broad linked-select policies with scoped helper functions and policies for organisations, wallets, assets, documents, records, attachments, record contacts, contacts, contact links, section entries and storage objects.
- Security properties: functions are `SECURITY DEFINER`, stable, use `search_path = public`, require `auth.uid()`, require accepted/verified/active grants, and scope reads to explicit permission ids or canonical contact/record links. Revoked/rejected/pending grants do not match.
- Owner, admin, reviewer, auditor and standard-user paths are not intentionally broadened by this migration.

Staging pre-flight blocker:

- No approved staging URL/API origin, staging database identity, migration history, production-isolation confirmation, synthetic-account permission, backup/restore evidence, rollback owner or rollback approval process was provided.
- Because those facts are unknown, do not apply the migration or run hosted browser tests.

Apply plan after staging approval:

1. Confirm staging is not production and is not shared with production data.
2. Capture a backup/checkpoint and identify rollback owner.
3. Query staging migration history for `20260324103000`, `20260630170000`, `20260701193000` and absence of `20260703153000`.
4. Capture current linked-select policies and helper function definitions.
5. Apply only `20260703153000_linked_access_scope_enforcement.sql`.
6. Verify scoped policies/functions are installed.
7. Run Phase 1 admin, Phase 2B probate, linked-access permission, Phase 4 Playwright, stabilisation, lint and build checks against staging-safe configuration.
8. Run browser proof before grant, after scoped grant and after revocation with synthetic `staging-phase5-*` accounts.
9. Roll back or recommend rollback if owner/admin access breaks, linked executor sees unrelated data, revoked access persists, document/storage access bypasses scope, audit integrity is affected, migration partially applies, or staging availability degrades.

Rollback plan:

- Preferred rollback is restore to the pre-apply staging checkpoint.
- If restore is unavailable, use a reviewed compensating migration that restores the previous linked-select policies/functions captured before apply.
- Preserve audit evidence; do not delete audit rows as part of rollback.

Phase 5 decision:

- Staging preparation complete - awaiting explicit migration approval.
- Release recommendation remains suitable for controlled internal UAT only until staging is approved, migrated and independently re-proven.

Phase 5 continuation note - 2026-07-04:

- Approval was received to proceed with an isolated staging environment, but the secure staging environment configuration was not available in the shell.
- Only environment variable names were checked; no secret values, URLs containing secrets, tokens or database connection strings were printed.
- No staging target was verified, no migration history was queried, no backup/checkpoint was confirmed, and no hosted migration was applied.
- Phase 5 remains blocked until the secure staging configuration is available locally.

Phase 5B local release package review - 2026-07-04:

- Staging remains unavailable because no separate cloud staging project is currently available.
- Controlled local internal UAT is the current release-readiness basis.
- Phase 1 admin foundation, Phase 2B probate/access workflows, Phase 3 operational UAT and Phase 4 linked-access RLS remediation are packaged as a coherent local-UAT candidate if review-sensitive files are excluded.
- Recommended internal-UAT package scope:
  - admin/probate application and service files under `app/api/internal/admin/`, `components/admin/`, `lib/admin/`, `proxy.ts`;
  - attachment/record stabilisation files `components/documents/AttachmentGallery.tsx` and `components/records/UniversalRecordWorkspace.tsx`;
  - migrations `20260630170000_admin_phase1_foundation.sql`, `20260701193000_admin_phase2b_probate_cases.sql`, `20260703153000_linked_access_scope_enforcement.sql`;
  - focused tests under `tests/admin-phase*.mjs`, linked/viewer access tests and e2e release-gate specs;
  - documentation and safe env templates.
- Exclude pending separate review:
  - `supabase/config.toml` local-only ports/site/email/analytics changes;
  - `tsconfig.json` generated include/formatting drift;
  - all secret-bearing `.env*` files and local UAT data.
- Verification evidence: stabilisation 34/34 passed; Phase 1/2B/link tests 15/15 passed; Phase 4 Playwright gate 1/1 passed; lint passed; build passed; local schema health returned `ok: true`.
- Decision: ready for controlled local internal UAT only. Do not claim limited pilot, staging or production readiness.

Evidence:

- Required Phase 1 migration identified: `supabase/migrations/20260630170000_admin_phase1_foundation.sql`.
- The isolated local Supabase stack was reachable after local Docker socket access was allowed for inspection.
- Migration history did not contain `20260630170000`; `admin_users.role` and `audit_events` were absent before the migration.
- Applied only `20260630170000_admin_phase1_foundation.sql` to the isolated local database and recorded only that migration version in `supabase_migrations.schema_migrations`.
- Verified `admin_users.role` exists as `text` with default `'support_agent'::text` and `admin_users_role_check`.
- Verified `audit_events` exists with expected primary, actor, category, resource and route indexes.
- Verified RLS is enabled on `admin_users` and `audit_events`.
- Verified `audit_events_prevent_update` and `audit_events_prevent_delete` triggers are enabled.
- Verified an allowed synthetic audit insert succeeds.
- Verified synthetic audit UPDATE and DELETE attempts fail with `ERROR: audit_events are append-only`.
- Browser UAT used an ignored local-only env wrapper, `.env.phase1.local`, generated from the isolated local Supabase status output and loaded command-scoped before starting `npm run dev`; `.env.local` was not overwritten.
- Runtime proof before account sign-in: `/api/health/schema` passed locally and browser network capture during UAT recorded 66 requests to the local Supabase API origin and 0 hosted Supabase requests.
- Local synthetic users were created with `phase1-*@legacyfortress.test` emails. Local Auth rows required empty-string token fields, matching the existing working local owner account shape.
- Browser/API role UAT results: unauthenticated `/internal/admin` redirected to sign-in; standard user saw admin access denied and protected admin API returned 403; support agent could read support snapshot and was denied admin-user management; verification reviewer could read queue and was denied approve/reject; probate reviewer could read queue; auditor was denied support/admin mutations; super admin could open `/internal/admin` and grant an admin user.
- The super-admin grant wrote one `audit_events` row for `/api/internal/admin/admin-users`.
- Direct audit UPDATE and DELETE attempts were rejected with `ERROR: audit_events are append-only`.
- Prototype admin routes are gated in local runtime; explicit old query-flag access does not open the mock page.
- Previous Phase 1 blocker resolved: auditor read-only audit-history UI/API is now implemented and proven locally.
- Stabilisation failures were corrected with minimal product fixes: shared attachment replace action now carries an explicit label prop, and trusted-contact/narrative-document records persist `value_minor` and `currency_code` as `null` instead of forced `0`/`GBP`.
- A synthetic-user preparation command read `.env.local` before this mismatch was discovered. No further hosted access was performed after the mismatch was identified.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run test:stabilisation` passed 34/34 after the two minimal corrections.

Additional Phase 1 auditor-read evidence:

- Added read-only `GET /api/internal/admin/audit-history`.
- Access requires existing `audit:read` capability. Allowed roles proven locally: `auditor`, `super_admin`. Denied roles proven locally: unauthenticated, standard user, `support_agent`, `verification_reviewer`, `probate_reviewer`.
- Returned fields are bounded and safe for internal audit review: category, action, result, actor email, actor role, resource type, resource label, route, policy decision and timestamp. Raw `metadata`, tokens, passwords, storage credentials, `actor_user_id` and `resource_id` are not returned.
- Browser UAT proved auditor can open the admin workspace, inspect the `Admin user granted` event, and sees zero audit-history action buttons. Super admin can inspect the same event. Standard user remains denied.
- Direct `POST /api/internal/admin/audit-history` returned 405 because no mutation handler exists.
- Direct database audit UPDATE and DELETE attempts still fail with `ERROR: audit_events are append-only`.
- `node --test tests/admin-phase1-foundation.test.mjs` passed 5/5.
- `npm run test:stabilisation` passed 34/34.
- `npm run lint` passed.
- `npm run build` passed and includes dynamic route `/api/internal/admin/audit-history`.

Decision:

- Phase 1 runtime gate is complete in the isolated local environment.
- Do not implement Phase 2B until the user explicitly approves Phase 2B.
- Preserve append-only audit evidence; do not remove local audit rows during rollback/testing.

### Phase 2A Discovery And Design - 2026-06-30

Status: Discovery complete; implementation not started.

#### Current Workflow Inventory

Existing operational pieces:

- `contact_invitations`: owner-created invitation records with contact name/email, assigned role, invite token hash, invited/sent/accepted/rejected/revoked timestamps and owner-scoped RLS.
- `role_assignments`: one role assignment per invitation, with `activation_status` values including `invited`, `accepted`, `pending_verification`, `verification_submitted`, `verified`, `active`, `rejected`, and `revoked`.
- `verification_requests`: current executor/probate verification request table linked to `role_assignments`, with owner, request type/status, one `evidence_document_path`, review timestamp/user/notes and owner-scoped RLS.
- `account_access_grants`: linked-user estate access model with owner, linked user, contact, invitation, assigned role, status, permission overrides and linked-user select policy.
- `contacts` and `contact_links`: canonical contact direction; probate/executor implementation must not create another contact model.
- `documents`: canonical document metadata with owner, asset, bucket/path, filename, MIME type, size, kind, soft-delete timestamp and owner RLS. Linked-access select policies already allow active/verified linked users to read documents through `has_linked_account_access`.
- `AttachmentGallery`: shared preview/download/print/replace/remove UI pattern; probate evidence should reuse this behaviour through case-linked evidence APIs.
- `/api/internal/admin/verifications`: current partial admin queue and actions; Phase 1 now adds capability checks and audit writes for existing actions, but it is not a full probate case workflow.
- `/internal/admin/prototype/cases/*`: static prototype pages only. These must remain separated from live operations until replaced by real case pages.
- `audit_events`: Phase 1 additive migration defines append-only event storage and an admin audit writer; local migration application/browser audit proof remain required before production readiness.

Existing constraints/RLS of note:

- `verification_requests.request_status` currently permits `pending`, `submitted`, `approved`, `rejected`; Phase 2 case statuses require a separate case status model rather than stretching this field unsafely.
- `account_access_grants.activation_status` already supports `verified`, `active`, `rejected`, and `revoked`; approval/revocation should update this existing model.
- Linked access currently reads broad owner vault rows when the grant is active/verified. Phase 2 must add case/permission scoping before any probate unlock is considered production-ready.

#### Target Probate / Verification Case Model

Proposed canonical table: `probate_cases`.

Required columns:

| Field | Purpose |
|---|---|
| `id` | Canonical case id. |
| `owner_user_id` | Estate/account owner. |
| `applicant_user_id` | Executor/contact applicant when known. |
| `contact_id` | Canonical contact link. |
| `contact_invitation_id` | Existing invitation link. |
| `role_assignment_id` | Existing role assignment link. |
| `verification_request_id` | Existing verification request link. |
| `access_grant_id` | Existing access grant created/updated on approval. |
| `case_type` | `executor_verification`, `probate_access`, or later approved case type. |
| `status` | `submitted`, `needs_information`, `under_review`, `approved`, `rejected`, `revoked`, `closed`. |
| `assigned_reviewer_user_id` | Authorised reviewer. |
| `submitted_at`, `reviewed_at`, `decided_at` | Case timeline. |
| `required_evidence` | JSON list of required evidence labels/types. |
| `decision_reason` | Mandatory for approve/reject/revoke/request-information. |
| `internal_reviewer_notes` | Internal-only notes; not shown to applicant. |
| `applicant_status_message` | Plain-English applicant-facing status. |
| `access_expires_at`, `revoked_at`, `revoked_by`, `revocation_reason` | Expiry and revocation controls. |
| `audit_event_ids` | Optional JSON array/cache of audit references; audit table remains canonical evidence. |
| `created_at`, `updated_at` | Timestamps. |

Proposed companion table: `probate_case_evidence`.

- Links one case to one document or storage object.
- Stores evidence type, source, uploader user id, MIME/file metadata, review status, retained/deleted flags and audit references.
- Does not expose unrelated vault documents.

#### Evidence Handling Model

Allowed evidence types for first implementation:

- Death certificate copy.
- Probate/grant representation document.
- Will/executor appointment evidence.
- Identity document copy.
- Relationship/supporting statement.
- Other supporting evidence.

Rules:

- Executors/applicants may upload evidence only to their own submitted case or approved request flow.
- Probate/verification reviewers may view/preview/download only case-linked evidence.
- Support agents do not get evidence access by default.
- Auditors may inspect metadata and audit history; document contents require a separate approved document-governance phase.
- Evidence preview/download must use signed, time-limited access through a server API.
- PDF/image preview can reuse `AttachmentGallery`/preview behaviour.
- Office-style documents fall back to download-only with clear wording.
- Evidence may be replaced only before final decision unless a reviewer explicitly reopens/requests information.
- Evidence is retained according to case retention policy; deletion should be soft-delete/retention-marked unless legal/product approves destruction.
- Every evidence view/download/replace/remove must emit an audit event where technically feasible.

#### Decision And Access-Grant Rules

- `verification_reviewer`: can view queue, mark reviewed and request information; cannot approve, reject or revoke estate access.
- `probate_reviewer`: can move cases under review, request information, approve, reject and revoke within probate/executor scope.
- `support_agent`: can view support metadata but cannot inspect evidence or decide access.
- `auditor`: can read audit/case timeline but cannot mutate.
- `super_admin`: can perform approved operational actions and override assignment only with audit.
- Sensitive decisions should support second-reviewer policy later; first implementation should store enough metadata to require it.
- Approve/reject/revoke/request-information require a non-empty decision reason.
- Approval must never automatically validate legal authenticity. UI copy should say the platform has reviewed the submission for operational access only.
- Approval can create or update an existing `account_access_grants` row to `verified` or `active` with expiry/permission overrides.
- Revocation sets linked `account_access_grants.activation_status = 'revoked'` and updates related role/request/case status.
- Estate access grants must remain scoped to the intended owner/account and must never grant billing, owner settings, unrestricted editing, admin access, or unrelated estate access.

#### Permission And Audit Model

Required capabilities:

| Action | Capability |
|---|---|
| List assigned cases | `verification:read` or future `probate_cases:read` |
| View evidence metadata | `verification:read` |
| Preview/download evidence | `verification:review` or `verification:decide` |
| Assign/reassign reviewer | `verification:decide` or `admin_users:manage` for super admin |
| Request information | `verification:review` |
| Approve/reject | `verification:decide` |
| Revoke access | `verification:decide` |
| Audit timeline read | `audit:read` |

Audit events required:

- Case submitted.
- Evidence uploaded/replaced/removed.
- Evidence viewed/downloaded.
- Reviewer assigned/reassigned.
- Status changed to needs information/under review.
- Decision approved/rejected.
- Access grant created/activated.
- Access grant revoked/expired.
- Unauthorised access attempt blocked.

Audit metadata should include actor id/role, case id, owner id, applicant id where safe, linked verification/request/grant ids, route, policy decision, decision reason presence and result. It must not include passwords, tokens, document contents, full sensitive notes or unrestricted private vault data.

#### Migration And Rollback Plan

Required additive migrations:

- Add `probate_cases`.
- Add `probate_case_evidence`.
- Add indexes for owner, applicant, reviewer, status, linked verification request, linked access grant and updated/submitted dates.
- Add RLS denying public/client broad access; writes/read decisions should flow through server APIs using the Phase 1 capability model.
- Add optional FK links from case to existing `verification_requests`, `role_assignments`, `contact_invitations`, `contacts`, `account_access_grants`, and `documents`.

Backfill:

- Existing `verification_requests` can be backfilled into `probate_cases` with status mapping:
  - `pending`/`submitted` -> `submitted`
  - `approved` -> `approved`
  - `rejected` -> `rejected`
- Existing `evidence_document_path` should be converted to a case evidence row where safe; if no matching `documents` row exists, store path metadata and mark `source = 'legacy_path'`.

Rollback:

- Disable Phase 2 case mutation endpoints and hide live probate routes.
- Preserve `probate_cases`, `probate_case_evidence`, `audit_events`, and access-grant history.
- Do not drop audit/case tables in normal rollback.
- SQL rollback should only remove newly added route exposure or feature flags unless explicit data-retention approval is given.

Release risks:

- Existing broad linked-access RLS may be too permissive for probate unlocks unless permission overrides are enforced at application and policy level.
- Evidence currently has a single legacy `evidence_document_path` on verification requests; multiple evidence documents require the companion case evidence table.
- Applying access grants without durable audit and decision notes would be unsafe; Phase 1 migration must be applied before Phase 2 runtime UAT.


### Delivery Tracker

| Item | Owner | Status | Priority | Dependencies | Acceptance criteria | Evidence link or test reference | Changed files/migrations | Date completed | Notes |
|---|---|---:|---:|---|---|---|---|---|---|
| Define probate case lifecycle | Product/Legal | In UAT | P0 | Phase 1 | Approved case statuses and decision rules | 2026-07-01 local Phase 2B proof used `submitted`, `needs_information`, `under_review`, `approved`, `revoked` | `supabase/migrations/20260701193000_admin_phase2b_probate_cases.sql`; `lib/admin/probateCases.ts` | 2026-07-01 | No automated legal decisioning; production/legal wording still requires review. |
| Build case APIs | Engineering | In UAT | P0 | Case schema | Case list/detail/mutation works with role guards | `node --test tests/admin-phase2b-probate-cases.test.mjs`; 2026-07-01 local API UAT | `app/api/internal/admin/probate-cases/*`; `lib/admin/probateCases.ts` | 2026-07-01 | Required notes and capability checks are enforced. |
| Build live case workspace | Engineering | In UAT | P1 | APIs | Browser can review case end to end | 2026-07-01 browser proof: probate reviewer saw case, evidence and revoked state in `/internal/admin` | `components/admin/AdminOpsWorkspace.tsx` | 2026-07-01 | Live workspace remains separate from prototype pages. |
| Prove revocation | QA/Engineering | In UAT | P0 | Access grant service | Linked access disappears after revoke/refresh | 2026-07-01 local proof: approved grant became `active`, scoped `probate_case`, read-only; revoke set grant to `revoked` | `lib/admin/probateCases.ts`; `app/api/internal/admin/probate-cases/[caseId]/actions/route.ts` | 2026-07-01 | Customer-facing linked-access consumption still needs later review before production. |

## Phase 3 — Support and User Administration: support queue, safe account controls and escalation

Phase status: Not Started

### Objective

Deliver a governed support workspace for safe user lookup, issue triage, escalation, and controlled account state actions.

### Prerequisites

- Phase 1 complete.
- Support issue taxonomy approved.
- Account restriction/reinstatement policy approved.

### In Scope

- Support case queue.
- Safe user/account summary.
- Invitation and linked-access issue triage.
- Escalation to probate/super admin.
- Account restriction and reinstatement workflow where approved.

### Explicitly Out Of Scope

- Direct editing of customer vault records.
- Viewing unrelated private documents.
- Billing operations unless Phase 5 is approved.
- Deleting real users.

### Functional Requirements

- Support agents can search users and view safe summaries.
- Support agents can create/update support case status.
- Sensitive account controls require confirmation and reason.
- Restricted accounts show clear customer-safe state.
- Escalations preserve context and audit trail.

### Security / Privacy Requirements

- Minimise personal data shown to support.
- No support access to document contents unless separately authorised.
- Account restrictions require super admin or approved escalation.
- Every support mutation emits audit.

### Database / Data-Model Work

- Support cases table.
- Case comments/notes table or audit-backed timeline.
- Account restriction state if not already represented.
- Escalation target and assignment fields.

### UI / Workspace Requirements

- Support dashboard with queue filters.
- User lookup detail with safe counts and statuses.
- Issue timeline and action panel.
- Clear escalation controls.

### API / Service Requirements

- Support case list/detail/create/update APIs.
- Account restriction/reinstatement APIs.
- Escalation service.
- Audit integration.

### Test Requirements

- Role-denial API tests.
- Browser support queue lifecycle.
- Account restriction/reinstatement browser proof.
- Data minimisation tests for support role.

### Browser UAT Scenarios

- Support agent finds synthetic user.
- Support agent opens invitation issue.
- Support agent escalates probate-related issue.
- Super admin restricts and reinstates synthetic account.
- Auditor reviews support timeline read-only.

### Documentation Updates

- Add support operating procedures.
- Update UAT remediation tracker.
- Update release checks if support routes are enabled.

### Acceptance Criteria

- Support queue works end to end.
- Account controls are audited and permission-gated.
- Support role cannot access private vault contents.
- Escalation is visible and traceable.

### Rollout / Rollback Requirements

- Feature flag support mutations.
- Rollback leaves case history read-only.
- Disable account state mutation endpoints if issues occur.

### Known Risks

- User lookup may expose too much data unless carefully scoped.
- Account restriction can create customer-impacting incidents if not reversible.

### Delivery Tracker

| Item | Owner | Status | Priority | Dependencies | Acceptance criteria | Evidence link or test reference | Changed files/migrations | Date completed | Notes |
|---|---|---:|---:|---|---|---|---|---|---|
| Support case schema | Engineering | Not Started | P0 | Phase 1 audit | Cases persist with status/assignment | DB/API tests TBD | TBD |  | Keep notes non-sensitive. |
| Safe user summary | Engineering/Product | Not Started | P0 | Privacy review | Support sees only approved fields | Browser privacy test TBD | TBD |  | Builds on current lookup. |
| Account restriction flow | Engineering | Not Started | P1 | Policy approval | Restrict/reinstate audited and reversible | Browser test TBD | TBD |  | Super admin only unless escalated. |

## Phase 4 — Document Governance and Audit Reporting: controlled document access, audit review and safe operational reporting

Phase status: Not Started

### Objective

Deliver controlled admin evidence/document access, audit review and safe operational reporting without exposing private vault data unnecessarily.

### Prerequisites

- Phase 1 complete.
- Phase 2 evidence workflow at least in UAT.
- Document governance policy approved.
- Reporting scope and consent model approved.

### In Scope

- Admin evidence document access.
- Document view/download audit events.
- Audit log review UI.
- Safe operational reports.
- Export gating and blocked-action recording.

### Explicitly Out Of Scope

- Public document URLs.
- Bulk export until explicitly approved.
- Campaign sending.
- Full enterprise reporting unless Phase 5 is approved.

### Functional Requirements

- Admin document access is case-scoped and time-limited.
- Every document view/download/print is audited.
- Auditors can search/filter audit events.
- Reports use banded/safe data unless explicit permission allows detail.
- Exports are disabled or approval-gated.

### Security / Privacy Requirements

- Signed URLs only.
- No raw storage paths in public UI.
- No cross-account document access.
- Reports must avoid sensitive free-text leakage.
- Export attempts must be audited even when blocked.

### Database / Data-Model Work

- Audit event indexes for document/report access.
- Optional report snapshot metadata.
- Export request table only if exports become approved.

### UI / Workspace Requirements

- Audit review workspace.
- Document evidence viewer with clear case context.
- Report pages labelled with data scope and consent status.
- Export controls disabled unless approved and audited.

### API / Service Requirements

- Case-scoped signed document URL API.
- Audit search/list API.
- Report aggregation service.
- Export request/blocked-action API if needed.

### Test Requirements

- Document access permission tests.
- Browser proof for evidence preview/download.
- Audit event proof for document actions.
- Report privacy tests.
- Export blocked-action tests.

### Browser UAT Scenarios

- Probate reviewer previews evidence and audit records appear.
- Auditor filters document access events.
- Support agent cannot open evidence without escalation.
- Export attempt is blocked and audited.
- Report view shows only approved/banded data.

### Documentation Updates

- Document governance rules.
- Audit event taxonomy.
- Reporting privacy rules.

### Acceptance Criteria

- No public document URLs are produced.
- Every sensitive document action is auditable.
- Audit review is read-only for auditor role.
- Reports do not expose unapproved vault detail.

### Rollout / Rollback Requirements

- Disable signed evidence endpoint if issue occurs.
- Keep audit event data immutable.
- Disable report/export flags independently.

### Known Risks

- Browser previews can accidentally leak signed URLs in logs.
- Report aggregation can drift into private data without strict allowlists.

### Delivery Tracker

| Item | Owner | Status | Priority | Dependencies | Acceptance criteria | Evidence link or test reference | Changed files/migrations | Date completed | Notes |
|---|---|---:|---:|---|---|---|---|---|---|
| Case-scoped document access | Engineering | Not Started | P0 | Phase 2 cases | Reviewer can access only linked evidence | Browser/storage tests TBD | TBD |  | Reuse shared attachment architecture. |
| Audit review UI | Engineering | Not Started | P1 | Audit persistence | Auditor can search/filter immutable events | Browser test TBD | TBD |  | Read-only. |
| Reporting privacy allowlist | Product/Engineering | Not Started | P1 | Reporting scope | Reports contain only approved fields | Unit/report tests TBD | TBD |  | Required before exports. |

## Phase 5 — Enterprise, Licensing and Full Release Gate: organisations, entitlements, feature gating and final role-based UAT

Phase status: Not Started

### Objective

Deliver approved enterprise and licensing back-office capabilities, then complete the full release gate for admin/probate/support/document governance.

### Prerequisites

- Phases 1-4 complete or explicitly scoped out.
- Enterprise product scope approved.
- Billing/licensing provider approach approved.
- Organisation data model approved.

### In Scope

- Organisation management.
- Licence/entitlement state.
- Organisation admin role.
- Feature gating by entitlement.
- Enterprise reporting if approved.
- Final role-based UAT.

### Explicitly Out Of Scope

- Live payment collection unless separately approved.
- Client data exports without governance approval.
- Campaign sending unless audit, consent and provider integration are live.

### Functional Requirements

- Organisation admins can manage approved organisation/licence data.
- Entitlements gate enterprise features.
- Billing/provider status is server-side only.
- Reports respect consent and organisation scope.
- Final UAT proves all admin roles and denial cases.

### Security / Privacy Requirements

- Organisation admins see only organisation-scoped data.
- Stripe/payment secrets stay server-side.
- Enterprise reports use approved data scopes.
- Exports require explicit approval and audit.

### Database / Data-Model Work

- Organisation and membership tables if existing `organisations` is insufficient.
- Licence/entitlement tables.
- Feature flag/entitlement mapping.
- Provider sync records if billing is connected.

### UI / Workspace Requirements

- Organisation admin workspace.
- Licence/entitlement dashboard.
- Clear disabled states for unavailable features.
- Final release checklist view or documentation.

### API / Service Requirements

- Organisation CRUD APIs.
- Licence/entitlement APIs.
- Provider adapter service where approved.
- Enterprise report APIs.
- Feature gate service.

### Test Requirements

- Unit tests for entitlement decisions.
- API tests for organisation scoping.
- Browser tests for organisation admin.
- Full role-based admin Playwright suite.
- Build, lint, release check and rollback verification.

### Browser UAT Scenarios

- Organisation admin manages approved organisation record.
- Organisation admin cannot access probate/support functions.
- Licence state gates feature visibility.
- Super admin can inspect organisation state.
- Full admin regression across support, probate, audit, documents and enterprise.

### Documentation Updates

- Update release plan.
- Update billing/licensing docs.
- Update UAT remediation tracker.
- Update route matrix.

### Acceptance Criteria

- All approved admin features pass role-based browser UAT.
- Build/lint/test/release checks pass.
- Rollback plan is documented and tested.
- No prototype route is mistaken for production tooling.

### Rollout / Rollback Requirements

- Preview deployment first.
- Staging browser UAT before production.
- Feature flags for enterprise/licensing.
- Rollback disables enterprise features without affecting customer vault.

### Known Risks

- Enterprise scope can expand quickly.
- Billing/provider integration can introduce compliance and support burden.
- Reports/exports are sensitive and must remain gated until audit is proven.

### Delivery Tracker

| Item | Owner | Status | Priority | Dependencies | Acceptance criteria | Evidence link or test reference | Changed files/migrations | Date completed | Notes |
|---|---|---:|---:|---|---|---|---|---|---|
| Enterprise scope approval | Product | Not Started | P0 | Phase 1 | Scope explicitly approved or deferred | Decision link TBD | TBD |  | Avoid building mock concepts as live features. |
| Organisation entitlement model | Engineering/Product | Not Started | P1 | Scope approval | Feature gates resolve server-side | Unit/API tests TBD | TBD |  | Keep billing separate from roles. |
| Final role-based UAT | QA/Engineering | Not Started | P0 | All approved phases | Full matrix passes in browser | Playwright suite TBD | TBD |  | Required before production. |

## Phase 6 — Codebase Consolidation and Legacy Retirement

Phase status: In Discovery

### Objective

Reduce release risk by identifying duplicate routes, overlapping persistence models, legacy compatibility paths, mock/prototype surfaces and branch/worktree complexity before further admin or customer-vault implementation.

Phase 6 is discovery only until explicitly approved for implementation. It does not authorise application code changes, database/schema changes, branch changes, deployments, hosted-service access, or production data access.

### Prerequisites

- Read this document and [UAT_REMEDIATION_TODO.md](./UAT_REMEDIATION_TODO.md).
- Preserve all current customer-vault, auth, contact, document and preview-readiness fixes.
- Do not overwrite local-only UAT configuration or test files without approval.

### In Scope

- Git and branch topology audit.
- Duplicate/overlapping code audit.
- Legacy persistence and compatibility-path audit.
- Prototype/mock admin isolation audit.
- Documentation updates with evidence and retirement candidates.

### Explicitly Out Of Scope

- Refactoring or deleting code.
- Database migrations or schema changes.
- Branch deletion, merge, rebase, reset, clean, commit or push.
- Deployment changes.
- Hosted Supabase, Vercel, Stripe, production data or Shure.Fund access.

### Functional Requirements

- Identify current branch, local branches, remote branches and uncommitted changes.
- Classify branches as retain, merge later, archive later or investigate.
- Identify canonical versus legacy record, document, contact and admin surfaces.
- Identify files likely to overlap during future merges.
- Identify retirement candidates with required evidence before removal.

### Security / Privacy Requirements

- Discovery must not inspect production data or hosted services.
- Local-only config, local seed data, local storage objects and `.env*` files must remain excluded from deployment decisions.
- Prototype/admin routes must remain clearly separated from customer-vault release readiness.

### Database / Data-Model Work

No schema changes are authorised in Phase 6. Discovery identified these active persistence families:

| Persistence family | Current role | Retirement posture |
|---|---|---|
| `organisations`, `wallets`, `assets`, `documents`, `asset_encrypted_payloads` | Canonical vault/asset/document chain | Retain and prefer for new structured records/documents. |
| `records`, `attachments`, `record_contacts` | Universal-record predecessor/compatibility layer | Retain until all record/document/contact projections are backfilled and browser-proven. |
| `section_entries` | Legacy generic section workspace | Retain only for active legacy surfaces until parity, backfill and rollback proof exist. |
| `personal_possessions`, `property_assets`, `business_interests`, `digital_assets`, `legal_documents`, `financial_accounts` | Earlier domain tables/migrations | Investigate per route before retirement; some still appear in older vault/detail paths. |
| `contacts`, `contact_links`, `contact_invitations` | Canonical people/contact/invite model | Retain and prefer for people workflows. |
| `role_assignments`, `account_access_grants`, `verification_requests`, `invitation_events` | Linked-access and verification model | Retain; future admin/probate work must govern these with audit. |
| `admin_users` | Current partial operational admin access | Retain; needs role/capability expansion before production admin. |
| `billing_profiles`, `payment_method_metadata` | Plan/payment-readiness model | Retain; live billing remains future work. |

### UI / Workspace Requirements

Discovery identified these workspace families:

| Workspace family | Current status | Retirement / consolidation guidance |
|---|---|---|
| `components/records/UniversalRecordWorkspace.tsx` | Canonical structured record workspace | Prefer for all new structured category work. |
| `components/sections/SectionWorkspace.tsx` | Active legacy workspace | Restrict to existing legacy pages; do not add new section-entry routes. |
| `components/documents/DocumentsWorkspace.tsx` + `AttachmentGallery.tsx` | Shared document/attachment UI | Prefer for document display, upload, preview, download, print, replace and remove. |
| `components/contacts/ContactsNetworkWorkspace.tsx` | Canonical contacts UI | Prefer for executors, trusted contacts, next of kin, advisers and invite workflows. |
| `components/admin/prototype/*` + `/internal/admin/prototype/*` | Static/mock prototype | Isolate, hide, gate or label; do not extend as live admin. |
| `/internal/admin` / `/internal/admin/probate` via `AdminOpsWorkspace` | Partial operational admin | Retain as foundation; do not mix with prototype pages without approved Phase 1 work. |

### API / Service Requirements

No service changes are authorised in Phase 6. Discovery identified these consolidation targets:

- Keep Supabase browser access through `lib/supabaseClient.ts`.
- Keep service-role access through `lib/supabaseAdmin.ts` and server/API-only helpers.
- Normalise auth redirects to `/sign-in`; `/signin` is still referenced in older routes.
- Keep local CSP allowance explicit and environment-gated in `next.config.ts`.
- Keep prototype query/persona access out of production admin decisions.

### Test Requirements

No new tests are required by discovery itself, but future retirement work must include:

- Route-parity tests before removing legacy routes.
- Browser lifecycle tests before retiring `section_entries` compatibility.
- Attachment lifecycle tests before removing `attachments` fallback.
- Contact/invite/revocation tests before removing `record_contacts` compatibility.
- Auth redirect tests before removing `/signin`.
- Prototype route denial/labelling tests before hiding or shipping admin surfaces.

### Browser UAT Scenarios

Future implementation phases must prove:

- Canonical route still creates, retrieves, searches, edits and deletes after each retired legacy path.
- Dashboard search and totals remain correct after compatibility removal.
- Existing demo/reviewer and linked-access views still render permitted data only.
- Prototype/admin routes are denied, hidden or labelled as approved for the environment.

### Documentation Updates

- Update this Phase 6 section after every consolidation pass.
- Update [UAT_REMEDIATION_TODO.md](./UAT_REMEDIATION_TODO.md) with discovery and evidence.
- Update [KNOWN_TECH_DEBT.md](./KNOWN_TECH_DEBT.md) when a debt item is retired.
- Update [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) when canonical/legacy ownership changes.

### Acceptance Criteria

Phase 6 discovery is complete when:

- Branch/worktree topology is documented.
- Duplicate/overlapping code families are documented.
- Legacy persistence paths are documented.
- Prototype/mock admin isolation risks are documented.
- No code/schema/branch/deployment changes were made.

Implementation of any retirement item requires a separate approval.

### Rollout / Rollback Requirements

Not applicable for discovery. Future retirement implementation must include file-level rollback, migration rollback if applicable, and browser proof that canonical paths still work.

### Known Risks

- `uat-remediation-preview` is ahead of `origin/main` and includes broad customer-vault, auth, contacts, document, admin-foundation and test changes.
- Local `main` is also ahead of `origin/main`, so deployment planning must decide whether Preview should merge from local `main`, `uat-remediation-preview`, or a curated branch.
- Dirty local-only files include `supabase/config.toml` and `tsconfig.json`, which must not be accidentally committed without review.
- Prototype admin pages are extensive and can be mistaken for live tooling.
- Removing legacy persistence too early could break dashboard, linked-access, document or route retrieval.

### Phase 6 Discovery Evidence - 2026-06-30

#### Git and Branch Topology

| Item | Evidence | Recommendation |
|---|---|---|
| Current branch | `uat-remediation-preview` tracking `origin/uat-remediation-preview` at `edda0fe` | Retain; this contains the latest preview-remediation work. |
| Local branches | `main` at `4071a13`; `uat-remediation-preview` at `edda0fe` | Retain both until preview/customer-vault release decision is made. |
| Remote branches | `origin/main` at `f23c6f0`; `origin/uat-remediation-preview` at `edda0fe` | Retain. |
| Ahead/behind | `uat-remediation-preview` is 9 commits ahead of `origin/main`; local `main` is 5 commits ahead of `origin/main`; `uat-remediation-preview` adds 4 commits beyond local `main` | Investigate/curate before merging to `main`. |
| Dirty tracked files | `docs/UAT_REMEDIATION_TODO.md`, `supabase/config.toml`, `tsconfig.json` | Docs update is intended; config files require review before any commit/deploy. |
| Untracked files | `docs/ADMIN_BACKOFFICE_DELIVERY_PLAN.md`, local UAT/e2e test files | New plan is intended; test files require review for local-only assumptions before commit. |

Branch classification:

| Branch | Classification | Notes |
|---|---|---|
| `origin/main` | Retain baseline | Current remote production/main baseline. |
| local `main` | Retain / investigate | Contains 5 commits not on `origin/main`, including platform/admin/backend source changes and test stabilisation. |
| `uat-remediation-preview` | Retain / merge later only after review | Contains all local `main` commits plus customer-vault remediation/avatar/legal-document preview fixes. |
| `origin/uat-remediation-preview` | Retain | Current pushed Preview branch. |

Potential overlap/conflict areas before any merge:

- `app/(app)/layout.tsx`
- `components/records/UniversalRecordWorkspace.tsx`
- `components/contacts/ContactsNetworkWorkspace.tsx`
- `components/documents/AttachmentGallery.tsx`
- `components/documents/DocumentsWorkspace.tsx`
- `components/sections/SectionWorkspace.tsx`
- `app/(app)/dashboard/page.tsx`
- `lib/contacts/canonicalContacts.ts`
- `lib/assets/createAsset.ts`
- `lib/assets/fetchCanonicalAssets.ts`
- `next.config.ts`
- `proxy.ts`
- `supabase/config.toml`
- `tsconfig.json`

#### Duplicate or Overlapping Code

| Area | Canonical / preferred | Legacy / overlapping | Recommendation |
|---|---|---|---|
| Record workspaces | `UniversalRecordWorkspace` and `lib/assets/*` | `SectionWorkspace`, older `vault/*` detail routes, `records` fallback | Retain legacy only as compatibility until browser parity and backfill proof exist. |
| Active `SectionWorkspace` routes | None preferred for new work | `/cars-transport`, `/employment`, `/personal/wishes` | Migrate one route at a time to canonical assets only after route-specific UAT. |
| Documents/attachments | `documents`, `DocumentsWorkspace`, `AttachmentGallery`, `lib/assets/documentLinks.ts` | `attachments`, legacy `file_path`, section-entry single-file handling | Keep fallback until attachment lifecycle and dashboard evidence pass without legacy rows. |
| Contacts/people | `contacts`, `contact_links`, `contact_invitations`, `ContactsNetworkWorkspace` | `record_contacts`, executor assets, next-of-kin legacy route aliases, contact compatibility projections | Keep compatibility adapters; avoid new people models. |
| Auth routes | `/sign-in`, `PublicAuthEntry`, `lib/auth/session.ts` | `/signin`, `/signup`, scattered `router.replace("/signin")` | Normalize redirects after dedicated auth regression test. |
| Supabase helpers | `lib/supabaseClient.ts` for browser, `lib/supabaseAdmin.ts` for server | Ad hoc `createClient` in auth/recovery and admin request helpers | Accept where scoped; consolidate only after behaviour tests. |
| CSP/route guard | `next.config.ts`, `proxy.ts`, `lib/backend/rbacMiddleware.ts` | Local-only CSP allowance and partially enabled edge admin guard | Keep exact-origin local allowance; do not broaden production CSP. |
| Dashboard/search | `app/(app)/dashboard/page.tsx` aggregates assets/documents/attachments/section_entries/contacts | Multiple persistence families in one page | Split into services only after tests freeze expected search/totals behaviour. |
| Admin/prototype | `/internal/admin` with `AdminOpsWorkspace` partial real APIs | `/internal/admin/prototype/*`, mock role APIs returning `mock_only` | Hide/gate/label prototype before any operational admin rollout. |

#### Legacy Persistence and Retirement Candidates

| Candidate | Current consumers | Retirement risk | Required proof before removal |
|---|---|---:|---|
| `section_entries` | `SectionWorkspace`, dashboard, support, health schema smoke | High | Cars, employment, wishes/support migrated or explicitly retained; dashboard and linked-access proof. |
| `records` | `UniversalRecordWorkspace` fallback, contacts linked record view, legal overview, demo access | High | Canonical assets cover every active record type; record/contact projections replaced. |
| `attachments` | Dashboard, Universal workspace fallback, contacts linked record docs | High | All parent-record attachment lifecycles use `documents`; legacy rows backfilled. |
| `record_contacts` | Canonical contact compatibility, linked-access, Universal workspace contact links | Medium | Contacts/contact_links/invitations cover all people flows and dashboard counts. |
| `legal_documents` | Older `/vault/legal` detail route | Medium | Legal routes fully canonical and old detail route retired or redirected. |
| `personal_possessions` | Historical migration/source and older detail references | Medium | `/vault/personal` canonical possession flow fully replaces legacy table. |
| `property_assets`, `business_interests`, `digital_assets`, `financial_accounts` | Earlier migrations and possible older routes | Medium | Runtime route audit confirms no live writes; data backfilled to assets. |
| `/signin` route and redirects | Several account/vault routes | Low/Medium | Auth redirect regression proves `/sign-in` everywhere. |
| `/internal/admin/prototype/*` | Prototype tests and review URLs | Medium | Replacement live admin route or explicit staged prototype flag/labelling. |

### Phase 6 Delivery Tracker

| Item | Owner | Status | Priority | Dependencies | Acceptance criteria | Evidence link or test reference | Changed files/migrations | Date completed | Notes |
|---|---|---:|---:|---|---|---|---|---|---|
| Git/branch topology audit | Codex | Complete | P0 | Local repo only | Branches, remotes and dirty files documented | Phase 6 evidence above | Documentation only | 2026-06-30 | No Git state changed. |
| Duplicate workspace audit | Codex | Complete | P0 | Source inspection | Canonical vs legacy workspaces documented | Phase 6 evidence above | Documentation only | 2026-06-30 | No code changed. |
| Document/contact/auth overlap audit | Codex | Complete | P0 | Source inspection | Overlapping helper families documented | Phase 6 evidence above | Documentation only | 2026-06-30 | Retirement requires separate approval. |
| Legacy persistence audit | Codex | Complete | P0 | Migration/source inspection | Legacy tables and retirement proofs documented | Phase 6 evidence above | Documentation only | 2026-06-30 | No schema changed. |
| Prototype/admin isolation audit | Codex | Complete | P0 | Source inspection | Static/mock admin surfaces documented | Phase 6 evidence above | Documentation only | 2026-06-30 | Phase 1 implementation still not started. |

## Architecture Guardrails

- Use shared canonical components and services.
- No new page-specific admin data models.
- No client-side-only authorisation.
- No service-role credentials in browser code.
- No public document URLs.
- No access to unrelated private vault data.
- Reuse canonical contacts and shared attachment architecture.
- Preserve auditability for every sensitive action.
- Prototype routes must be hidden, gated or clearly labelled.
- Do not extend legacy persistence paths unless documented as a temporary migration adapter.
- Do not add duplicate contact, document, access-grant, role or audit models.
- Prefer additive migrations with rollback plans.
- Keep customer-vault and admin release gates separate.

## Release Gates

### Local UAT Gate

No admin feature passes local UAT until:

- Role-based browser proof exists for permitted roles.
- Permission-denial browser proof exists for non-permitted roles.
- Audit-event proof exists for every sensitive mutation and document access.
- Build, lint and targeted tests pass locally.
- Synthetic local data is used only in isolated local services.
- Rollback steps are documented.

### Preview-Deployment Gate

No admin feature should be included in a Preview deployment until:

- Local UAT gate passes.
- Local-only files, seeds, storage objects, Supabase config and `.env*` files are excluded.
- Prototype route behaviour is explicitly approved.
- Preview env variables are reviewed.
- Browser tests pass against the Preview URL.
- No hosted production data is accessed during testing.

### Production Gate

No admin feature is production-ready until all of the following are complete:

- Role-based browser proof.
- Audit-event proof.
- Permission-denial proof.
- Build/lint/test success.
- Production rollback plan.
- Documented operational procedure.
- Privacy/security review for data exposed to each role.
- Explicit approval to deploy.

## Delivery Tracker

Use the phase trackers above for detailed delivery. This summary table tracks overall phase state.

| Phase | Owner | Status | Priority | Dependencies | Acceptance criteria | Evidence link or test reference | Changed files/migrations | Date completed | Notes |
|---|---|---:|---:|---|---|---|---|---|---|
| Phase 1 - Admin Foundation | Engineering | In UAT | P0 | Auth role source decision | Trusted roles, route guards and audit persistence proven | [ADMIN_FOUNDATION.md](./ADMIN_FOUNDATION.md), [ADMIN_ROLE_MATRIX.md](./ADMIN_ROLE_MATRIX.md), [ADMIN_DASHBOARD_METRICS.md](./ADMIN_DASHBOARD_METRICS.md), [ADMIN_UAT.md](./ADMIN_UAT.md), `tests/admin-phase1-foundation.test.mjs` | `app/admin/*`; `app/api/internal/admin/dashboard-summary/route.ts`; `app/api/internal/admin/local-role-override/route.ts`; `components/admin/AdminDashboardWorkspace.tsx`; `lib/admin/*`; `supabase/migrations/20260630170000_admin_phase1_foundation.sql` |  | Runtime foundation and admin dashboard implemented locally; full role-account browser proof remains required before completion. |
| Phase 2 - Probate and Executor Verification | Engineering/Product | Not Started | P0 | Phase 1 | Approve/reject/revoke lifecycle proven | TBD | TBD |  | No automated legal decisioning. |
| Phase 3 - Support and User Administration | Engineering/Support | Not Started | P1 | Phase 1 | Support queue and safe account controls proven | TBD | TBD |  | Privacy review required. |
| Phase 4 - Document Governance and Audit Reporting | Engineering/Security | Not Started | P1 | Phases 1-2 | Document access and audit reporting proven | TBD | TBD |  | No public URLs. |
| Phase 5 - Enterprise, Licensing and Full Release Gate | Product/Engineering | Not Started | P2 | Phases 1-4 or approved deferrals | Enterprise scope and final UAT approved | TBD | TBD |  | Build only if enterprise is approved. |
| Phase 6 - Codebase Consolidation and Legacy Retirement | Engineering | In Discovery | P0 | Current repo audit | Discovery complete; no implementation without approval | Phase 6 evidence in this document | Documentation only | 2026-06-30 | Created to control simplification work. |

## Codex Operating Instruction

For all future Codex tasks involving admin, probate, support, document governance, enterprise, licensing, audit, roles or permissions:

- Read this document and [UAT_REMEDIATION_TODO.md](./UAT_REMEDIATION_TODO.md) before making changes.
- Update this document after each completed stage.
- Do not mark a phase complete without test evidence.
- Do not deploy automatically.
- Report exact files, migrations, tests, rollback and release impact.
- Do not change hosted Supabase, Vercel, Stripe, production data or live users without explicit approval.
- Do not implement broad architecture changes when a phase asks for diagnosis or planning only.
- Preserve approved customer-vault fixes unless explicitly instructed otherwise.

## Immediate Next Actions

The first practical work should be Phase 1 only:

1. Decide whether prototype routes are hidden, gated, or retained with stronger labels in Preview/staging.
2. Establish the trusted admin role/capability model.
3. Implement persistent append-only audit events.
4. Add server-side capability enforcement.
5. Build role-based browser test harness using synthetic accounts.
6. Re-run build, lint, targeted unit/API tests and browser UAT.
7. Update this document with evidence before requesting approval for Phase 2.

## 2026-07-04 Phases 6-8 Local Hardening Addendum

- Scope: local internal-UAT hardening only. No admin Phase 3, deployment, hosted Supabase, Vercel, Stripe, production data, live users, real accounts or Shure.Fund access.
- Phase 6 outcome: normal auth-page browser flows no longer emit the local Multiple GoTrueClient warning in the tested routes. The fix uses a non-persistent, purpose-scoped ephemeral auth client for sign-up and password reset while preserving the main session singleton.
- Phase 7 outcome: canonical contact discovery confirmed the current source of truth is `contacts` plus `contact_links` and `contact_invitations`. No new schema or duplicate contact model was added. Contact search now opens matching groups so contacts are visible consistently in desktop/mobile UAT.
- Phase 8 outcome: cross-module browser proof passed for auth/session, linked-access revocation, legal wills, attachments, dashboard count accuracy and mobile smoke using local synthetic accounts/data.
- Admin impact: no role/capability, audit, probate, evidence or linked-access policy was weakened. Phase 1/2B/linked-access automated tests still pass.
- Evidence:
  - Node targeted tests passed 44/44.
  - `npm run test:stabilisation` passed 34/34.
  - Phase 4 Playwright linked-access revocation passed as part of the 8-test auth/session/revocation browser run.
  - `npm run lint`, `npm run build` and local schema health passed.
- Current release position: suitable for controlled local internal UAT only. Cloud staging remains required before any external pilot.

## 2026-07-12 Admin / Application Dashboard Foundation Evidence

- Scope: Phase 1 admin/application dashboard foundation only. No deployment, commit, push, hosted Supabase/Vercel/Stripe access, production data, real users or Shure.Fund interaction.
- Added canonical admin entry route `/admin` and safe denial route `/admin/access-denied`.
- Added protected internal API `/api/internal/admin/dashboard-summary` for aggregate-only operational metrics. The unauthenticated local smoke returned `401` with no admin data.
- Added local-only role-testing harness API `/api/internal/admin/local-role-override`, guarded to local runtime and restricted to super-admin capability `admin.roles.test`.
- Updated the capability model with canonical roles: `super_admin`, `support_agent`, `verification_reviewer`, `probate_reviewer`, `auditor` and `enterprise_admin`. `organisation_admin` remains a compatibility alias only.
- Added safe aggregate metric definitions in `lib/admin/dashboardSummary.ts`; unavailable data sources are returned as unavailable rather than misleading zero values.
- Added documentation source set: [ADMIN_FOUNDATION.md](./ADMIN_FOUNDATION.md), [ADMIN_ROLE_MATRIX.md](./ADMIN_ROLE_MATRIX.md), [ADMIN_DASHBOARD_METRICS.md](./ADMIN_DASHBOARD_METRICS.md) and [ADMIN_UAT.md](./ADMIN_UAT.md).
- Evidence:
  - `node --test tests/admin-phase1-foundation.test.mjs tests/admin-phase2b-probate-cases.test.mjs tests/platform-architecture-stabilisation.test.mjs` passed 19/19.
  - `npm run lint` passed.
  - `npm run build` passed and included `/admin`, `/admin/access-denied`, `/api/internal/admin/dashboard-summary` and `/api/internal/admin/local-role-override`.
  - `curl -i http://127.0.0.1:3012/api/internal/admin/dashboard-summary` returned `401 Unauthorized` for a missing bearer token.
  - Playwright local smoke rendered `/admin/access-denied` on desktop and mobile; `/admin` without a usable authenticated admin session remained on the protected checking shell.
- Remaining Phase 1 UAT requirement: create/use synthetic role accounts and complete browser proof that support, verification/probate reviewer, auditor, enterprise admin, super admin, standard user and revoked admin each see only their permitted dashboard/API surface.
- Status: implemented but not fully proven. Do not mark Phase 1 Complete or begin production release until role-account browser proof, audit-event proof from real admin dashboard access and data-accuracy proof are complete.
