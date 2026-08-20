# Legacy Fortress — Known Technical Debt

Status: confirmed from the latest Codex review.

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
- product is improved, but not yet stable enough to call complete

## Rules for future prompts
- Prioritise contact unification before adding more contact-adjacent features.
- Avoid extending `section_entries` unless there is no safe canonical path.
- Any new sample/demo data should cover multiple categories and realistic linked records.
- Do not declare the platform stable until shared entities and shared workflows are actually unified.

## Privacy, identity and governance debt — added 20 August 2026

### Identity-verification enforcement not yet proven
The product requires invitation acceptance and identity verification to be separate lifecycle events. Current implementation must be audited to prove that protected access cannot activate before required verification through server/API/RLS controls.

### Biometric/IDV compliance architecture incomplete until proven
Photo-ID plus facial/liveness matching requires a provider architecture, DPIA, lawful basis, special-category condition, retention policy and human/manual exception path. Treat this as NOT COMPLETE until evidenced.

### UK GDPR rights operations not yet proven end-to-end
Admin capability must be audited/implemented for:
- SAR/access
- rectification
- erasure
- restriction
- portability
- objection/marketing suppression
- consent withdrawal
- deadline tracking and audit evidence

### Retention/deletion lifecycle not yet proven
A documented retention schedule and data-category disposal mechanism are required. Record deletion, document provenance and backup expiry must be distinguished.

### Partner analytics/privacy boundary not yet proven
Sponsored entitlement must not imply sponsor ownership or unrestricted access. Partner analytics, data sharing and marketing eligibility require separate purpose/permission controls and tenant isolation.

### Document immutability/provenance not yet proven
Third-party contribution must create a new immutable document/version with uploader and timestamp rather than overwrite an existing original.
## Additional critical security debt — approved 20 August 2026

### No proven canonical vault death-lock state machine
Repo truth must prove or implement `OWNER_ACTIVE -> DEATH_REPORTED -> PROTECTIVE_LOCK -> ESTATE_LOCKED`, including immutable historical data, post-death append-only administration records and negative tests preventing edit/overwrite/delete.

### Representative compromise/revocation recovery not proven
Estate representative access must be independently suspendable/revocable without unlocking the deceased vault. Emergency suspension of downloads, decrypt/key release and post-death additions is required.

### False/malicious death-report owner recovery not proven
A living owner needs an exceptional recovery route with fresh high-assurance identity/presence verification, security investigation, dual approval, credential/session recovery and immutable audit. A normal admin `unlock` toggle is prohibited.

### Risk-based identity levels and step-up enforcement not proven
Implement/verify Level 1 authenticated, Level 2 photo-ID + 1:1 identity verified, and Level 3 fresh liveness/presence re-verification. High-risk permission and estate actions must be server-enforced.

### Replaceable IDV provider boundary not proven
Development/UAT may use an internal experimental verifier, but the application needs a canonical provider interface and assurance metadata so production can switch to an approved commercial/certified provider without workflow redesign.

### Progressive consent and partner frequency controls not proven
Partner purpose, topic, channel, frequency, withdrawal and suppression must be persisted independently from sponsorship and general Terms acceptance.

### Encryption/key custody target not yet proven
Current storage/encryption implementation must be audited against the target envelope-encryption model, separated key custody, wrapped estate-recovery material, least privilege, dual control and recovery-coverage reconciliation.

### Closed-loop partner activation not proven
Partner analytics/marketing should prefer aggregate cohort counts and LF-controlled delivery to eligible users rather than exposing unrestricted identity lists or detailed estate records.
