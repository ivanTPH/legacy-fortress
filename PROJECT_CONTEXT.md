# Legacy Fortress — Authoritative Project Context

Status: working context baseline — 20 August 2026

## Product objective
Legacy Fortress is a UK digital personal/estate vault designed to let an individual organise personal, legal and financial information, securely share controlled access with trusted people/professional advisers, and support authorised estate administration after death.

## Non-negotiable product invariants
1. The wallet holder is the primary controller of access to their vault during life.
2. Relationship/person type, legal/estate role and access permission are separate concepts.
3. Invitation acceptance alone does not grant protected access where identity verification is required.
4. Photo-ID + facial/liveness matching is an identity-verification process, not merely biometric login.
5. Professional Adviser is the only normal pre-death person type eligible for document-contribution permission.
6. Document contribution creates a new immutable document/version; it must not overwrite an existing original.
7. Estate access is a separate post-death process requiring evidence, identity/re-verification and Legacy Fortress admin decision.
8. Estate access must not permit alteration/deletion of historic originals.
9. Sponsored/licensee customers remain Legacy Fortress customers/wallet holders. Sponsorship funds entitlement; the sponsor does not own the wallet.
10. Partner analytics access must be data-minimised and purpose-limited; underlying vault contents are not exposed by default.
11. Analytics eligibility and marketing eligibility are separate.
12. Marketing consent/preferences are not bundled into Terms & Conditions.
13. UK GDPR individual rights, retention/deletion and accountability controls are core product requirements, not later admin extras.
14. Security and privacy rules must be enforced server/API/database/RLS-side, not only in the UI.
15. Development and UAT occur on staging/test first. Production changes only occur after explicit approval following successful UAT.

## Canonical People & Access target
Person types:
- Family / Loved One
- Professional Adviser
- Other Trusted Person

Roles:
- Beneficiary
- Executor
- Trustee
- Representative / Attorney
- Professional Adviser

Permissions:
- basic relationship/access state
- view
- download
- contribute documents (Professional Adviser only in normal pre-death workflow)

Invitation states:
`draft -> sent -> accepted -> identity_required -> verification_submitted -> verified -> active`
with `delivery_failed / expired / revoked / rejected` as applicable.

## Estate access target
`estate_access_requested -> re-verification -> death_certificate -> probate/authority evidence if applicable -> admin review -> approved/rejected/more_information_required -> estate_access_active`

## Enterprise target
`Organisation -> Licence/Contract -> Registration Campaign -> Sponsored Entitlement -> LF User/Wallet`

Partner dashboard may show authorised aggregate/readiness/customer relationship indicators but not unrestricted vault content.

## Privacy/compliance target
See `LEGACY_FORTRESS_DATA_PROTECTION_GOVERNANCE.md`.
The platform requires operational support for:
- lawful-basis/purpose records;
- privacy notice/T&C versioning;
- partner data-sharing governance;
- consent/marketing preferences and withdrawal;
- SAR/access;
- rectification;
- erasure;
- restriction;
- portability;
- objection/suppression;
- retention schedules and disposal;
- DPIA governance;
- audit/accountability.

## Development discipline
- establish repo truth before changes;
- find canonical implementation before adding a new one;
- prefer shared components and shared services;
- do not extend legacy `section_entries` unless no safe canonical path exists;
- do not create seed/demo functionality that masquerades as working functionality;
- test real persistence, reload and new-session behaviour;
- include negative permission/security tests;
- verify staging before hosted mutations;
- never treat production as the development target.

Current hosted staging source-of-truth details are maintained in `docs/STAGING_ENVIRONMENT_SETUP.md` and `docs/HOSTED_STAGING_READINESS_PLAN.md`; as of 20 August 2026 the active evidence points to the Coolify/custom-domain staging path, not older Vercel Preview assumptions.

## Current known architectural concern
Contacts/invitations historically existed across multiple paths. Recent work indicates movement toward a shared `/contacts` workspace, but the effective persisted contact/invitation/verification permission model must be re-audited in current repo truth before further contact-adjacent development.

The current access model must also be audited to prove identity verification is a mandatory server-side gate where required. A UI verification state without server-side enforcement is insufficient.

## Documentation precedence
For future development, use this order where documents conflict:
1. current approved product decisions in this file;
2. `LEGACY_FORTRESS_DATA_PROTECTION_GOVERNANCE.md` for privacy/security/data-sharing requirements;
3. current Inclusion/Exclusion Specification plus its 20 August 2026 addendum;
4. UX/Data Capture standards plus its 20 August 2026 addendum;
5. architecture/root notes based on current repo truth;
6. older MVP assumptions where not superseded.
## Security and identity architecture — approved 20 August 2026

### Progressive consent and communication control
- Do not front-load optional consent during onboarding where it is not required for account operation.
- Ask for consent or preference at the point a relevant optional/high-risk processing purpose arises and explain the user benefit in plain language.
- Keep service processing, sponsor relationship, Legacy Fortress marketing, named-partner marketing, channel preference and communication frequency as separate records where applicable.
- Partner communications must be permission- and frequency-controlled by the user. Sponsorship must never imply blanket marketing permission.
- Partner cohort eligibility and partner marketing eligibility remain separate controls.

### Identity assurance levels
Legacy Fortress should use risk-based step-up verification rather than repeatedly requesting the same evidence.
- `LF_IDENTITY_LEVEL_1_AUTHENTICATED`: authenticated account/session.
- `LF_IDENTITY_LEVEL_2_IDENTITY_VERIFIED`: photo-ID plus 1:1 camera/selfie match completed under the approved identity workflow.
- `LF_IDENTITY_LEVEL_3_PRESENCE_REVERIFIED`: fresh camera/liveness challenge and 1:1 match against the previously verified identity immediately before a high-risk action.

High-risk permission changes and estate/death claims must require server-enforced step-up verification at the level defined by policy. A client-side UI state is insufficient.

### Identity-verification provider strategy
Build against a canonical `IdentityVerificationProvider` interface so the application can use an internal experimental verifier during development/UAT and switch to a production-grade commercial/certified provider without changing the People & Access or estate workflows.

The internal verifier may be used to prove document capture, field extraction, 1:1 photo/selfie comparison, camera challenge/liveness flow, decision states, audit and permission transitions in controlled non-production use. It must be labelled experimental and must not be represented as equivalent to production document-authenticity/fraud assurance.

### Death Lock and estate transition
A death report changes the security state of the vault. It is not merely another permission grant.

Canonical vault states:
`OWNER_ACTIVE -> DEATH_REPORTED -> PROTECTIVE_LOCK -> ESTATE_LOCKED`

Exceptional recovery path:
`DEATH_STATUS_DISPUTED -> OWNER_RECOVERY -> OWNER_ACTIVE`

Rules:
- `PROTECTIVE_LOCK` preserves the vault while a death claim is investigated and prevents ordinary owner/delegate mutation.
- `ESTATE_LOCKED` makes the deceased owner's historic vault immutable. Historic records/documents cannot be edited, overwritten or deleted through normal estate administration.
- Post-death evidence and administration records are appended in a separate Estate Administration context with provenance.
- Estate claimant/representative access is a separate state machine from vault state. Revoking or suspending a compromised executor must not unlock or mutate the deceased vault.
- System administrators must be able to suspend/revoke estate access while preserving the estate lock.
- A false/malicious death report must have an exceptional owner-recovery path requiring fresh strong identity verification, security investigation, dual authorised approval and immutable audit evidence.
- Reinstating a living owner's account must never be a single ordinary-admin toggle.

### Encryption and recovery direction
Target architecture is privacy-preserving envelope encryption with per-user/vault data-encryption keys and separately protected key-encryption/recovery material. Encrypted data and usable recovery keys must not share the same ordinary security boundary.

The estate-recovery mechanism should use wrapped recovery material, separate key custody/HSM/KMS or equivalent controls, least privilege, dual control and auditable release. A periodic reconciliation job may verify that every active vault has valid recovery material, but recovery must not depend on a weekly batch export of plaintext keys.

### Privacy-preserving partner intelligence
Partner targeting should use a closed-loop cohort model. Partners may request an approved cohort based on authorised/pseudonymised indicators and receive aggregate counts or campaign capability, rather than unrestricted identity lists. Legacy Fortress resolves and delivers communications only to users whose purpose/channel/frequency permissions permit it.
