# Platform Admin Hosted UAT Plan

Target staging only: `https://test.mylegacyfortress.com`. Confirm the matching staging Supabase host and environment before testing. Never use the production Vercel or Supabase targets.

## Preconditions

- Deploy the candidate commit to staging.
- Use marked synthetic users and organisations only.
- Confirm the Platform Admin persona has the intended capability set.
- Do not expose or record secrets, vault contents, raw documents, or raw IDV evidence.

## Route checks

1. `/admin`: confirm Action centre queues, real/unavailable labels, metric source text, and links to invitations, verification, probate/access, support, audit, and health.
2. `/admin/users`: search a synthetic user, open detail, confirm only operational summaries appear, and verify safe error/empty states.
3. `/admin/admin-users`: invite a marked admin, test reason-required suspend/role actions, confirm self-lockout/last-admin protections and audit activity.
4. `/admin/organisations`: filter and open a marked organisation; verify administrators, users, licences, issues, success feedback, and failure feedback.
5. `/admin/licences`: inspect allocation/usage/availability and exercise only policy-supported lifecycle actions; verify validation, audit, and refresh persistence.
6. `/admin/invitations`: compare business lifecycle with transport evidence; resend/revoke a synthetic invitation and confirm truthful status.
7. `/admin/verification`: filter review-required synthetic IDV, assign to self, add a note, request retry where valid, refresh, and confirm no force-verify/access action or raw evidence.
8. `/admin/access` and `/admin/probate`: inspect a synthetic case, verify identity/authority/access/death/evidence states remain separate, and confirm no one-click unlock.
9. `/admin/support`: assign, note, escalate, resolve, reopen where permitted, and verify timeline/audit persistence.
10. `/admin/audit`: filter synthetic activity and confirm actor/action/target/result/safe metadata only.
11. `/admin/system-health`: confirm configured, unconfigured, unavailable, and staging-only states are truthful; do not treat missing email, commercial IDV, jobs, or backups as healthy.
12. `/admin/settings`: confirm safe readiness state only and no secret values.

## Access and estate case scenarios

- `/admin/access` and `/admin/probate` must use the same canonical case records; confirm the access route is not a second invitation-only case engine.
- Exercise death reported only, protective lock, evidence pending, identity verified/authority pending, authority approved/quorum pending, insufficient quorum, successful quorum, denied authority, and revoked access fixtures.
- Confirm the UI keeps death, identity, evidence, authority, quorum, and access states separate and never offers a generic unlock action.
- Attempt self-approval and duplicate approval through the authorised API/test harness; both must be rejected and audited.
- Confirm assignment, notes, decision history, escalation, terminal denial/revocation, and access-gate outcomes persist after refresh.

## Responsive and safety checks

- Repeat the primary queue/detail path at desktop, tablet, and mobile widths.
- Check keyboard focus, Escape/outside-click dismissal, readable cards, and no horizontal overflow.
- Verify Platform Admin navigation never silently enters a customer vault, Enterprise workspace, or Executor workspace.
- Capture failures as application defects, test-environment defects, or pre-production blockers. Do not mark hosted PASS from source review alone.
