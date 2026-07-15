# Dashboard Boundaries and Privacy

Status: Phase 3 boundary document. This defines allowed dashboard responsibilities before further dashboard work is implemented.

## A. Customer Dashboard

Purpose: personal vault overview for the signed-in owner or an explicitly scoped reviewer.

Allowed content:

- Category completion and counts.
- Outstanding owner tasks and reminders.
- Recent customer records the viewer is permitted to see.
- Invitation status for the owner’s own contacts.
- Important document status and vault progress.

Not allowed:

- Platform-wide metrics.
- Internal audit history.
- Probate operations queues.
- Other customers, organisations or staff activity.

## B. Internal Application Control Dashboard

Purpose: aggregate operational view for authorised Legacy Fortress staff.

Allowed content:

- Total users.
- Active and incomplete vaults.
- Stale wills and old documents as aggregate indicators.
- Missing executors.
- Pending invitations and failed email counts.
- Probate review queues.
- Support issues and risk flags.

Constraints:

- Must be server-side capability checked.
- Must minimise private vault content.
- Must return aggregate or safe fields unless a separately approved workflow grants detail access.
- Must audit dashboard access where required.

## C. Enterprise / Licence Dashboard

Purpose: organisation-scoped view for authorised enterprise customers, once organisation-level isolation is genuinely implemented.

Allowed future content:

- Licensed organisation details.
- Eligible or invited users.
- Accepted invitations.
- Activation/adoption at aggregate level.
- Licence usage.
- Organisation administrators.
- Permitted support/escalation status.
- Reports permitted by commercial and privacy model.

Not allowed:

- Other organisations.
- Platform-wide metrics.
- Unnecessary private vault details.
- Internal audit data.
- Internal probate records unless a specific authorised service model exists.

Do not claim enterprise multi-tenancy exists until organisation-level isolation is implemented and tested with at least two synthetic organisations.

## Metric Register

| Metric | Dashboard | Purpose | Viewer role | Data source | Formula | Privacy class | Drill-down | Filters | Empty state | Error state | Personal data required | Audit requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Category record count | Customer | Show whether a vault area has records. | owner, scoped reviewer | canonical assets/records visible to viewer | count active records by category after access filter | personal vault summary | category record list only | category, status | "Add record" | safe load error | yes, owner-scoped | no unless reviewer scope |
| Category total value | Customer | Show finance/property value summary. | owner, scoped reviewer | canonical assets value fields visible to viewer | sum active `value_minor`/estimated value by category | sensitive personal financial aggregate | category records only | category, currency, status | "No records yet" or "Add record" | safe load error | yes, owner-scoped | no unless reviewer scope |
| Outstanding tasks | Customer | Show owner actions without cluttering category summaries. | owner | workflow blocking model | count unresolved task items | personal workflow summary | task/action route | severity, status | no open tasks | safe load error | yes | no |
| Pending invitations | Customer | Show owner’s contact invite follow-up. | owner | canonical contacts/invitations | count invitations with pending/sent/opened states | personal contact metadata | contact/invitation row | status, role | no pending invitations | safe load error | yes | mutation events audited |
| Total users | Internal | Understand platform scale. | super_admin, support_agent, auditor | Supabase Auth admin list | count valid customer auth users excluding system/service users | aggregate operational | user lookup only where permitted | status, date when supported | 0 users | unavailable metric | no private vault content | dashboard access event |
| Active vaults | Internal | Track active customer base. | super_admin, support_agent, auditor | `user_profiles.account_status` | count active profiles | aggregate operational | restricted user lookup | status | unavailable if schema missing | unavailable metric | profile status only | dashboard access event |
| Incomplete vaults | Internal | Identify onboarding support needs. | super_admin, support_agent, auditor | `user_profiles.onboarding_complete` | count profiles not complete | aggregate operational | restricted support workflow | status | 0 incomplete | unavailable metric | profile status only | dashboard access event |
| Users with no will | Internal | Identify readiness risk. | super_admin, support_agent, auditor | auth users + legal/wills assets | auth users minus owners with active will | aggregate operational; sensitive if drilled down | no drill-down until owner approves detail workflow | date, status future | 0 | unavailable metric | yes if drilled down | dashboard access event; drill-down audit required |
| Stale wills | Internal | Identify documents older than review threshold. | super_admin, support_agent, auditor | legal/wills updated_at | count active wills older than five years | aggregate operational | no document content; future safe owner list | threshold date | 0 stale | unavailable metric | only owner/document metadata if drilled down | dashboard access event |
| Old documents | Internal | Track document review risk. | super_admin, support_agent, auditor | documents updated_at | count documents older than five years | aggregate operational | no document content | threshold date | 0 old documents | unavailable metric | document metadata only if drilled down | dashboard access event |
| Users with no executor | Internal | Identify estate readiness gaps. | super_admin, support_agent, auditor | canonical contacts/executor role | count users without active executor relationship | aggregate operational | no private contact detail until approved | role/status | 0 | unavailable metric | contact metadata if drilled down | dashboard access event |
| Failed emails | Internal | Support delivery failures. | super_admin, support_agent | invitation_events | count failed/bounced/delivery_failed events | operational contact metadata | support queue only | status/date | 0 failed | unavailable metric | email metadata | mutation/support audit |
| Pending probate reviews | Internal | Manage death-certificate/probate queues. | probate_reviewer, verification_reviewer, super_admin | probate_cases | count submitted/needs_information/under_review | sensitive operational | assigned cases only | status/assignee | no cases | unavailable metric | case metadata | required |
| Organisation licence usage | Enterprise | Show licensed usage. | enterprise_admin | future organisation/licence tables | used seats / licensed seats scoped to org | organisation aggregate | organisation member list only if approved | org/status | no usage | unavailable until schema exists | organisation membership | required |
| Organisation adoption | Enterprise | Show aggregate onboarding progress. | enterprise_admin | future org membership + profiles | aggregate completion by org with privacy thresholds | organisation aggregate | no individual vault detail by default | org/date | no users | unavailable until schema exists | minimal membership/profile status | required |

## Phase 4A Customer Overview Rule

Date: 2026-07-13.

Phase 4A customer category overviews may show active canonical record counts and last-updated dates for selected customer-owned asset areas only. The selected routes are `/property`, `/business`, `/vault/digital`, and `/vault/personal`.

These overview cards must not display document filenames, storage paths, contact email addresses, contact phone numbers, account numbers, sort codes, private notes, document bodies, invite tokens, audit payloads or records belonging to another owner. If a route still uses mixed or legacy persistence, it must be labelled as such in [CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md](/Users/ivan-imac/legacy-fortress-web/docs/architecture/CUSTOMER_DASHBOARD_ROUTE_AND_DATA_INVENTORY.md) before dashboard claims are expanded.
