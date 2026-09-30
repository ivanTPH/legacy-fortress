# Legacy Fortress — Known Technical Debt

Status: confirmed from the latest Codex review.

## Architecture consolidation pass 1

### Canonical subsystems

- Authentication and recovery use Supabase Auth plus the signed staging Send Email Hook; application recovery routes remain the only password-reset surface.
- Personal Vault records use the canonical `records`/`assets`/`documents` paths and the shared `AttachmentGallery` presentation boundary.
- Identity verification uses `identity_verification_requests`, `identity_verification_documents`, `identity_presence_challenges`, `identity_verification_decisions`, `identity_assurance_states`, and append-only verification events. The internal provider is staging-only.
- Linked access uses `contacts`, `contact_invitations`, `role_assignments`, and `account_access_grants`; invitation acceptance is enforced by the canonical `accept_contact_invitation` function and server-side ownership checks.
- Probate/death-state/quorum remains a separate authority model. Estate approvals use `sensitive_action_approvals` and the approved/rejected/revoked/expired decision vocabulary; they are not interchangeable with IDV decisions.
- Platform administration uses server-side `admin_users` capability checks. Enterprise administration is organisation-scoped and uses the enterprise operation services rather than consumer vault permissions.

### Proven schema drift corrected

The hosted IDV failure exposed one stale assertion in the staging runner. The canonical migration stores IDV decision fields as `requested_identity_level` and `achieved_identity_level`, with decision values `verified`, `failed`, and `review_required`. The runner previously queried `identity_level` and expected `approved`; `dd09db4` corrected the query and regression coverage. No migration was required and no staging schema mutation is implied.

Future schema changes must be checked across migrations, services, routes, staging runners, tests, and UI before deployment. In particular, `identity_level` remains canonical only on `identity_assurance_states`; it is not a column on `identity_verification_decisions`.

### Intentionally retained compatibility and prototype surfaces

- `section_entries` and `record_contacts` remain compatibility stores for legacy pages and support workflows. `persistenceReadiness`, `contactRepository`, and `canonicalContacts` explicitly prohibit expanding them for new people features. They must not be deleted until a backfill, route parity, and rollback plan exist.
- `components/sections/SectionWorkspace.tsx` remains legacy but is still imported by personal/employment/transport/wishes routes and support. It is not safe to remove in this pass.
- `/internal/admin/prototype/*` and `components/admin/prototype/*` are static/prototype operational surfaces. They remain behind prototype context/role guards and are still referenced by navigation and tests. They must not be treated as the canonical admin control plane or deleted without route replacement proof.
- `AttachmentGallery` remains the shared attachment surface. New document or attachment UI must not create a parallel gallery or page-level storage path.

### Workspace and permission boundary

- Platform/System Admin: server-side platform capabilities and `admin_users` role; may operate platform summaries, enterprise resources, licences, users, audit and approved probate/verification functions according to capability.
- Enterprise Admin: organisation-scoped enterprise membership, invitation, licence and reporting operations; no System Admin capabilities.
- Personal Vault owner: owns personal records and may nominate/invite contacts through the canonical contact/invitation path.
- Trusted contact/delegate/executor: receives only an accepted, active, context-bound grant and must satisfy any required identity assurance, estate authority and fresh-presence gates.
- Invited but unaccepted/unverified user: may authenticate and inspect only the invitation/verification flow; no sensitive vault access is active.
- UI workspace selection is not authorization. API services, RPCs, RLS, grant state, identity assurance, estate state and audit checks remain authoritative.

Known boundary: `lib/workspaces.ts` still exposes several historical workspace IDs and the prototype/admin route families coexist with `/admin`, `/enterprise`, and `/admin/probate`. This is navigation consolidation debt, not a permission bypass; server-side checks must remain in place while the shells are unified.

## High priority

### Fragmented contacts / people model
Confirmed split:
- `app/(app)/personal/page.tsx` — next of kin via legacy `SectionWorkspace`
- `app/(app)/trust/page.tsx` — executors / trusted contacts via canonical asset records
- `ContactInvitationManager.tsx` — invite status in a separate flow

Impact:
- people/contacts are still fragmented across multiple systems
- records do not reference one canonical contact entity across the app
- contacts are not yet reusable shared entities

### Legacy persistence still active in key pages
- `components/sections/SectionWorkspace.tsx`
- legacy pages still use `section_entries`

Impact:
- architecture remains mixed between canonical and legacy systems
- future features risk being implemented twice

## Medium priority

### Missing synthetic populated-account coverage
Not yet added for:
- profile
- finances
- property
- legal
- business
- personal
- tasks / reminders
- contacts

Impact:
- empty and near-empty states have not been fully pressure-tested
- realistic user journeys are not yet fully validated

### Attachment viewing still partial for office-style files
Impact:
- preview is shared for supported formats, but unsupported office-style files still require download

## Canonical contact design target identified, not yet implemented
- `id`
- `full_name`
- `email`
- `phone`
- `contact_role`
- `relationship`
- `linked_context`
- `invite_status`
- `verification_status`
- `source_type`

## Current verdict
- NOT FIXED
- architecture is mapped and one proven IDV schema-drift defect is corrected, but contacts, compatibility persistence, prototype admin surfaces and hosted Phase 3 proof remain incomplete

## Rules for future prompts
- Prioritise contact unification before adding more contact-adjacent features.
- Avoid extending `section_entries` unless there is no safe canonical path.
- Any new sample/demo data should cover multiple categories and realistic linked records.
- Do not declare the platform stable until shared entities and shared workflows are actually unified.
