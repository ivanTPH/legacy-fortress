# README snippet — Project operating rules

## Project operating rules
See:
- `docs/PROJECT_STRUCTURE.md`
- `docs/BUILD_AND_RELEASE.md`
- `docs/ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md`
- `docs/KNOWN_TECH_DEBT.md`

Working rules:
- prefer shared/canonical components over page-specific implementations
- do not reintroduce one-off attachment UIs where `AttachmentGallery` exists
- avoid new legacy patterns if a shared component or canonical data path already exists
- require explicit build and regression checks in every implementation report

## Authoritative product/privacy context — 20 August 2026
Before changing contacts, invitations, identity, documents, enterprise, marketing, estate access or admin controls, also read:
- `PROJECT_CONTEXT.md`
- `LEGACY_FORTRESS_DATA_PROTECTION_GOVERNANCE.md`

Additional working rules:
- treat service access, partner data sharing, analytics and marketing as separate purposes/permissions
- do not grant protected vault access solely because an invitation was accepted
- do not implement biometric recognition without an approved DPIA and documented lawful basis + special-category condition
- build UK GDPR rights administration, retention and disposal against real persisted data
- preserve document provenance; third-party contribution must not overwrite historical originals
- staging/UAT first; production only after explicit approval and passed release gates
## Security-state rules — 20 August 2026
- Use progressive consent: do not bundle optional partner/marketing permissions into generic onboarding or Terms.
- Implement identity verification through a provider abstraction; internal experimental IDV is permitted only for controlled development/UAT and must be distinguishable from production assurance.
- Use risk-based identity levels and server-enforced step-up verification for critical permission/estate actions.
- Treat death as a vault-state transition: `OWNER_ACTIVE -> DEATH_REPORTED -> PROTECTIVE_LOCK -> ESTATE_LOCKED`.
- `ESTATE_LOCKED` historical data is immutable. Post-death records are appended separately with provenance.
- Representative access state is independent of vault state. Suspending/revoking a compromised executor must not unlock the deceased vault.
- Living-owner recovery from a false/malicious death report requires exceptional security workflow and dual approval; never implement it as an ordinary admin toggle.
- Prefer envelope encryption, separated key custody and wrapped estate-recovery material. Do not colocate usable recovery keys with ordinary encrypted application data.
- Partner targeting should be closed-loop and permission/frequency controlled; avoid providing unrestricted customer identity lists where LF can perform the eligible delivery itself.
