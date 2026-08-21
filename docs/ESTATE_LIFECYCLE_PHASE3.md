# Phase 3 Estate Lifecycle

Phase 3 adds death reporting, protective lock, estate lock, estate claims, estate administration documents, emergency suspension, and owner recovery.

## State Boundaries

Vault lifecycle is separate from claimant identity, probate status, access grants, and estate administration permissions.

Vault states:

- `OWNER_ACTIVE`
- `DEATH_REPORTED`
- `PROTECTIVE_LOCK`
- `ESTATE_LOCKED`
- `DEATH_STATUS_DISPUTED`
- `OWNER_RECOVERY`

Allowed transitions are explicit:

- `OWNER_ACTIVE -> DEATH_REPORTED`
- `DEATH_REPORTED -> PROTECTIVE_LOCK`
- `PROTECTIVE_LOCK -> ESTATE_LOCKED`
- `DEATH_REPORTED|PROTECTIVE_LOCK|ESTATE_LOCKED -> DEATH_STATUS_DISPUTED`
- `DEATH_STATUS_DISPUTED -> OWNER_RECOVERY`
- `OWNER_RECOVERY -> OWNER_ACTIVE`

No direct `ESTATE_LOCKED -> OWNER_ACTIVE` transition exists.

## Death Reports

Death reports use `death_reports`, `death_report_evidence`, and `death_report_events`.

Death certificate evidence does not grant access. It can support a death decision, but authorization still requires claimant identity, authority evidence, probate/administration status, explicit estate permissions, and an active estate claim.

Submitting a death report requires authenticated Level 3 fresh presence through the Phase 2 step-up mechanism. Anonymous reports cannot mutate a vault.

## Protective Lock

Protective lock preserves data while a claim is investigated. It blocks historic owner mutation and ordinary linked access because ordinary linked access remains OWNER_ACTIVE-only through the Phase 1 live vault-state predicate.

Protective lock is not proof of death and does not activate executor access.

## Estate Lock

Estate lock makes the historic owner vault immutable. Post-death material is added as estate administration evidence, not by replacing or deleting historic owner records.

## Estate Administration

Estate administration uses `estate_access_claims`, `estate_access_decisions`, `estate_administration_documents`, and `estate_security_actions`.

Estate documents are stored in the private `estate-administration-evidence` bucket with provenance:

- uploader
- timestamp
- estate claim
- death report or probate context
- document type
- prior version where applicable

Estate claim access is explicit and document scoped.

## Identity And Presence

Claimant approval requires at least Level 2 identity assurance.

High-risk estate actions use Level 3 fresh presence through Phase 2, including death report submission and owner recovery.

## Owner Recovery

OWNER_RECOVERY is temporary. Ordinary linked representative access remains denied, and final return to `OWNER_ACTIVE` must be explicit and audited.

Password login alone is not enough to restore a death-locked vault.

## Emergency Suspension

Suspending or revoking an estate claimant disables estate access without changing `ESTATE_LOCKED` or unlocking the historical vault. Evidence and audit rows are retained.

## Probate Separation

Existing probate case evidence remains logically separate from ordinary linked vault access. Probate approval can transition a vault into estate lock, but it does not rewrite historic owner records and does not create broad ordinary vault access.

## Commercial/Registry Future Seam

Future death registry, probate, or legal authority providers should feed evidence and decisions into the same death report and estate claim state machines. They must not bypass vault-state transitions, claimant identity checks, or estate permission scopes.
