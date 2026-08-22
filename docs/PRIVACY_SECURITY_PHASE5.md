# Phase 5 Privacy, Encryption and Partner Control Plane

Phase 5 establishes the privacy/security/commercial-data foundation for Legacy Fortress. It is a structural implementation, not a claim of finished regulatory certification or production KMS readiness.

## Data Domains

Legacy Fortress separates three logical domains:

- Identity Domain: authentication, account identity, contact details, identity assurance and verification status.
- Vault Domain: assets, records, documents, estate records and other private customer content.
- Intelligence Domain: pseudonymous eligibility, aggregate reporting, campaign suppression and commercial operational metrics.

Partner analytics must not query raw Vault Domain tables directly. Intelligence records use opaque references where user-level persistence is unavoidable. Pseudonymous data is not anonymous data.

## Envelope Encryption Architecture

The canonical encryption model is per-vault envelope encryption:

- a Vault DEK encrypts selected high-sensitivity structured values and future object payloads;
- the DEK is wrapped under a normal wrapping key boundary;
- estate recovery wrapping is separate;
- the database stores wrapped material and metadata only;
- no plaintext DEK, KEK, recovery key or reusable master decryption secret is stored in the database.

The current internal provider is `lf_internal_staging_envelope_v1`. It uses AES-256-GCM with unique random nonces for UAT and architecture validation. It is explicitly staging/test only.

## Production KMS/HSM Requirement

Production-grade encryption requires an approved KMS/HSM-backed `VaultKeyManagementProvider`. The staging provider must not be described as certified KMS, HSM, or production custody.

Future provider responsibilities:

- create vault keys server-side;
- wrap and unwrap data keys inside a trusted boundary;
- rotate wrapping keys;
- create separate recovery wraps;
- validate recoverability without routine vault-content decryption;
- destroy key references only through approved lifecycle controls.

## Recovery Boundary

Exceptional recovery is an operation, not a key handoff. Recovery requires a valid case, justification, quorum or dual control where configured, fresh Level 3 presence, and immutable audit. No browser/admin UI receives a decrypted DEK.

Phase 5 builds on the Phase 4 wrapped recovery-material model. Recovery execution remains controlled-provider architecture until production KMS/HSM is configured.

## Structured Data Encryption

Phase 5 supports explicit encrypted payload records for selected sensitive values. It does not blindly encrypt every relational field, because some fields are needed for search, filtering, reporting or legal workflows.

Searchable metadata must remain minimal and non-sensitive. Exact-match indexes must use keyed hashes only after policy review.

## Document/Object Encryption

Private Supabase Storage policies remain mandatory. Encryption is not a substitute for access control.

Phase 5 adds an `encrypted-vault-objects` boundary for future object encryption and tests synthetic encrypted payloads. Bulk migration of existing vault documents is intentionally deferred until migration confidence and production KMS are available.

## Data Rights

The Data Rights workflow supports:

- subject access;
- rectification;
- erasure;
- restriction;
- portability;
- objection;
- marketing objection;
- other privacy enquiry.

SAR and portability are separate. Exports are scoped, server-created, expire, and exclude secrets, raw keys, internal risk logic and unrelated third-party private data.

## Retention and Legal Hold

Retention is classification based. Account closure is not a cascade delete.

The retention model distinguishes user account data, vault content, identity decisions, temporary evidence, security audit, estate records, contractual records, billing records, consent records, marketing preferences, privacy requests and partner campaign events.

Legal holds are explicit, reasoned and audited. A legal hold blocks destructive retention actions until removed through an approved process.

## Consent and Marketing Objection

Consent is append/history based and records purpose, partner, channel, scope, source and notice version. Withdrawal does not destroy prior consent evidence.

Marketing objection is operationally durable. Suppression records survive erasure workflows where needed to prevent accidental re-marketing. Sponsor entitlement must not override global, partner or channel objections.

## Partner and Sponsor Boundary

Canonical relationship:

Organisation -> Contract/Licence Pool -> Registration Campaign/Link -> Sponsored Entitlement -> Legacy Fortress User/Wallet.

The sponsor funds access. The sponsor does not own the vault, control the vault, receive blanket customer data, receive IDV evidence, or receive raw private vault contents.

## Closed-Loop Cohorts

Partners may submit only allowed cohort definitions. Legacy Fortress evaluates eligibility internally, applies consent/suppression/frequency controls, and returns aggregate outputs.

Analytical eligibility is separate from marketing eligibility. A user may be counted analytically while not being contactable.

Prohibited targeting includes sensitive vault-content predicates such as asset values, beneficiaries, will content, document text, identity evidence and medical data unless a later approved policy explicitly permits a narrow use case.

## Admin Access Model

System admins remain in the admin control plane. The policy is no routine staff access to decrypted vault content. Normal support/admin users have no routine decrypted vault access. Sensitive or exceptional vault access must go through recovery/security workflow with reason, Level 3, dual control where configured and immutable audit.

No admin "View Vault" convenience function is introduced by Phase 5.

## Incident Readiness

Phase 5 adds security incident references, affected domain metadata, containment state and notification decision support. It does not automatically disclose incident details to users or partners without review.

## Known Limitations

- The internal encryption provider is staging/test only.
- Existing plaintext vault fields are not bulk-encrypted in this phase.
- Object-level encryption for all existing documents is deferred.
- Production KMS/HSM integration is required before production encryption claims.
- Application code alone does not make the service fully GDPR compliant.
