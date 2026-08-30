# Identity Verification Foundation

Status: architecture and staging foundation only. No commercial biometric provider is selected or integrated. The internal provider is synthetic and must never be treated as genuine identity verification.

## Security model

Legacy Fortress keeps these decisions separate:

1. **Authentication (L1):** the account session is authenticated.
2. **Identity verification (L2):** a provider and server policy establish an identity result for a bound user and purpose.
3. **Fresh presence (L3):** a short-lived step-up result proves recent strong presence.
4. **Relationship:** an owner nomination or invitation establishes who may be considered.
5. **Legal authority:** estate/probate policy establishes whether the claimed role is valid.
6. **Access decision:** the server evaluates all applicable policy and grant state.

IDV alone never grants vault access. A verified user can remain unauthorised. Rejected, revoked, and expired access records are not resurrected by a successful verification.

## Existing canonical implementation

The Phase 2 domain is retained and evolved rather than duplicated:

- `identity_verification_requests` binds an authenticated `user_id`, purpose, provider reference, requested/achieved level, expiry, retry count, and retention marker.
- `identity_verification_documents` stores document-processing metadata and private evidence paths.
- `identity_presence_challenges` stores challenge and liveness metadata.
- `identity_verification_decisions` stores the server/provider decision.
- `identity_verification_events` stores privacy-sanitised lifecycle events.
- `identity_assurance_states` stores the current assurance result.
- `identity-verification-evidence` is a private storage bucket scoped to `users/{user_id}/{request_id}/...`.

The provider boundary is `IdentityVerificationProvider`. The application does not depend on vendor payload terminology. The server routes determine the authoritative result; browser input cannot set `verified`, liveness, face-match, or assurance fields.

The reusable `requireIdentityAssurance` service helper is intended for future server-side gates. It checks durable L2 assurance or the existing short-lived L3 presence RPC and must be composed with relationship, authority, estate state, and access policy checks.

## Normalised lifecycle

The existing request states cover the foundation lifecycle: draft, started, document required/uploaded/processing/extracted, camera required/captured, comparison processing, review required, verified, failed, expired, and cancelled. Provider integrations must map into these states. `verification_purpose` is currently limited by the migration to `linked_access`, `registration_required`, `step_up_presence`, and `admin_review`; adding new purposes requires an explicit migration and policy review.

Document results are metadata categories, not an evidence browser: passport, driving licence, national identity document, or unknown; authenticity/extraction warnings; country; match categories; and a hashed document reference where justified. Liveness is passed, failed, or review required. Face comparison is normalised to match, no-match, or inconclusive for policy use. Numeric scores are provider data and are not routine admin output.

## Staging provider

`lf_internal_experimental_v1` is a deterministic, synthetic provider for local and staging tests. It is visibly labelled experimental and can simulate pass, fail, retry, review, expiry, timeout, and provider failure scenarios. It does not establish genuine biometric assurance.

It is enabled only when all of the following are true:

- `IDENTITY_VERIFICATION_PROVIDER=lf_internal_experimental_v1` is explicit;
- the environment is explicitly local/development/test/staging or the target is an approved local/staging host;
- no production target is present.

Ambiguous configuration fails closed. Production configuration must use no internal provider key and must not contain staging/local URLs.

## Privacy and retention

Durable records are limited to transaction references, purpose, status, assurance level, policy version/metadata, operational result categories, timestamps, expiry, and privacy-safe audit metadata. Raw document images, MRZ/NFC data, selfie video, raw camera frames, facial embeddings/templates, and unrestricted provider evidence are not durable product data by default.

Temporary evidence remains private, non-guessable, user/request scoped, and subject to deletion. The current implementation records an evidence-retention marker and provides cleanup logic; a scheduled cleanup process is still required before production. Retention periods and legal basis require formal privacy approval and must be configurable rather than indefinite.

Platform support may receive status, purpose, provider reference, timestamps, retry/review state, and non-sensitive reason categories through privileged server APIs. Enterprise administrators receive no individual raw IDV evidence. Subjects receive only the minimum status needed for their own flow. Logs and audit metadata must not contain document numbers, images, biometric vectors, tokens, passwords, signed URLs, or provider secrets.

## Webhook boundary for a commercial provider

No commercial callback is implemented in this foundation. A future provider adapter must validate signatures and timestamps, enforce idempotency by provider event ID, bind callbacks to the expected environment/session/provider reference, reject unknown sessions, handle duplicates and out-of-order events safely, and write append-only audit evidence. Browser-submitted results are never authoritative.

## Retry and review policy hooks

The data model supports attempt counts, retry relationships through request metadata, expiry, and `review_required`. A future provider policy must define maximum attempts, cooldowns, document/selfie recapture, technical-failure retry, repeated mismatch escalation, and manual-review separation of duties. Manual review is not an “approve IDV” bypass; it must use controlled evidence and policy.

## Storage and access gating

The evidence bucket is private and protected by owner-scoped RLS/storage policies. No Enterprise policy exposes raw records, and no linked-access policy grants evidence access. Future direct-provider capture is preferred where it avoids Legacy Fortress retaining raw media.

For linked access, the safe sequence remains nomination/invitation, acceptance, authentication, required IDV, relationship and authority checks, then server access policy. For estate/probate flows, identity, nominated role, legal authority, estate state, and fresh presence remain separate gates. Death evidence does not establish identity or executor authority.

## Decisions still required

- formal DPIA, lawful basis/consent, retention and deletion approval;
- commercial provider selection and data-residency/subprocessor review;
- supported-country/document policy;
- provider webhook and hosted-capture design;
- manual-review ownership and separation of duties;
- production backup/restore and evidence-cleanup operations;
- replacement invitation policy, transactional email proof, analytics, and bulk dispatch remain outside this phase.
