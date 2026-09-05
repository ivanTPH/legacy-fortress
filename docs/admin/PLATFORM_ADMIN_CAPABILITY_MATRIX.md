# Platform Admin Capability Matrix

Audit basis: `e6af322`, local source review, 2026-09-05.

This matrix describes the canonical `/admin` control plane. `Operational` means the route has a live/server-backed queue or detail workflow with permission checks. `Partial` means useful capability exists but one or more requested operational functions remain unavailable, unproven, or delegated. `Display only` means the route primarily reports state. `Missing` means no canonical route was found.

| Route | Data/API | Search / filters | Detail / actions | Notes / assignment / history | Mobile / states | Classification | Main gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/admin` | Dashboard summary, support snapshot, verification queue, probate API | Queue links | Action-centre queue cards and metric destinations | Audit links; source/status shown | Shared cards/table, loading/error/empty states | Operational | Some category totals are unavailable where schemas are not configured |
| `/admin/users` | Auth admin lookup and `/api/internal/admin/users` | Name, email, safe reference | User operational detail; no vault entry | Related invitation, verification and access summaries | Shared responsive table/cards | Operational | Suspend/recovery actions remain policy-limited |
| `/admin/admin-users` | `/api/internal/admin/admin-users` | Admin filter/search | Invite, activate, suspend, role change, revoke invitation | Audit-gated lifecycle actions and safe reason dialogs | Shared table/detail | Operational | Broader activity history depends on recorded events |
| `/admin/organisations` | Enterprise portfolio API | Organisation/status/type/licence/plan filters | Organisation detail and member/licence/invitation links | Recent activity where available | Shared table; detail needs broader mobile UAT | Partial | Metadata mutation and organisation lifecycle proof remain incomplete |
| `/admin/licences` | Enterprise portfolio/licence API | Plan/status/search | Licence detail and organisation context | Portfolio data, no generic lifecycle editor | Shared table/detail | Partial | Allocation/revoke/suspend lifecycle needs full persisted UAT proof |
| `/admin/invitations` | Support snapshot and contact invitation lifecycle API | Queue/status via route and support data | Detail, resend, revoke, case actions | Case notes, assignment, timeline where a case exists | Shared table/cards | Operational | Email delivery evidence is not mailbox-proven |
| `/admin/verification` | `/api/internal/admin/verifications` | Status, purpose, reviewer and queue filters | Privacy-minimised case detail; assign, retry, note, review actions | Reviewer, notes and audit events | Shared table/cards | Operational | Commercial provider is not configured |
| `/admin/access` | Canonical `probate_cases` queue/detail API, linked verification/access data | Case/status queue | Shared probate case detail, evidence review, audited decisions | Assignment, notes, history, and case state | Shared table/cards | Partial | Quorum/death-report operations remain incomplete |
| `/admin/probate` | `/api/internal/admin/probate-cases` | Case/status queue | Case detail, evidence metadata, decision/revoke actions | Decision notes, case history, audited signed evidence links | Shared table/cards | Operational | Quorum/death-report operations require broader hosted proof |
| `/admin/support` | Support operations API | Case/status/priority data | Assign, escalate, resolve, reopen, add note | Case detail and audit-backed activity | Shared table/cards | Operational | Customer support intake is not a full independent ticketing system |
| `/admin/audit` | Read-only audit-history API | Actor/action/target filter | Event inspection only | Safe metadata and timestamps | Shared table/cards | Operational | Date-range and pagination depth remain limited |
| `/admin/system-health` | Authenticated system-health API plus deployment/metric data | Subsystem status | Read-only health checks | Release/configuration warnings | Shared table/cards | Operational | Background jobs and automated backup signals are unavailable |
| `/admin/settings` | Safe configuration/readiness state | None | Read-only settings/readiness presentation | No secret values; staging-only labels | Responsive sections | Display only | No governed mutation UI by design |
| `/admin/probate/[caseId]` | Probate case detail API | Case reference | Evidence review and permitted decisions | Case history and decision notes | Responsive detail | Operational | Multi-approver/quorum workflow remains incomplete |
| `/admin/verification/[caseId]` | Verification queue detail API | Case reference | Review-safe actions | Notes, assignment, activity | Responsive detail | Operational | No raw evidence by policy |

## Cross-cutting controls

- Admin mutations must remain server-authorized, capability-checked, transition-validated, rate-limited where applicable, and audit-recorded.
- Platform Admin views operational metadata only. Vault contents, raw IDV evidence, document numbers, biometric material, secrets, and provider payloads remain excluded.
- Invitation business state and delivery evidence remain separate. A database invitation row does not prove mailbox delivery.
- Identity verification, legal authority, and access activation remain separate decisions. No admin action in this matrix is a generic estate-unlock or force-verification control.
- The normal admin shell uses shared responsive tables/cards and in-app dialogs. Native confirmation prompts were removed from the canonical admin workspaces in `e6af322`.

## Remaining completeness gaps

1. Hosted role/action testing with real Platform Admin personas for every mutation.
2. Full organisation and licence lifecycle persistence, failure, and audit proof.
3. Unified access/probate case management with explicit quorum and death-report queues.
4. Pagination/date-range depth for large audit and operational queues.
5. Automated backup/job observability and transactional email evidence.
