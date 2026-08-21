# Identity Verification Phase 2

Legacy Fortress Phase 2 introduces a canonical identity-verification layer for protected linked access and high-risk step-up presence checks. Phase 1 RLS and vault-state gates remain authoritative.

## Assurance Levels

- Level 1: authenticated account session.
- Level 2: identity verification for protected linked access. The Phase 2 internal provider performs controlled UAT document extraction, active camera capture, liveness scoring, and 1:1 comparison.
- Level 3: short-lived fresh presence assurance for high-risk actions. It is not permanent identity status and expires quickly.

## Provider Architecture

Application code depends on `IdentityVerificationProvider`, not provider-specific payloads. The interface covers starting verification, document extraction, presence challenge, liveness, 1:1 comparison, completion, status, cancellation, and evidence deletion.

The current provider key is `lf_internal_experimental_v1`. It is explicitly experimental and intended for local/staging UAT. It must not be represented as certified government-document validation or a commercial KYC substitute.

Future providers such as Persona, Veriff, Onfido/Entrust, Stripe Identity, or another regulated provider can implement the same interface without changing invitation/RLS business logic.

## Evidence Storage

Identity evidence is stored in the private `identity-verification-evidence` bucket, not in `vault-docs`.

Evidence paths are scoped under `users/{user_id}/{verification_request_id}/...`. Ordinary linked users do not receive storage access to this bucket. Raw evidence signed URLs should be short-lived and purpose-specific.

## Retention

The system separates:

- decision and audit metadata;
- extracted operational fields;
- raw document image;
- raw camera capture;
- biometric comparison output.

By default, decision/audit metadata is retained, while raw document/camera evidence is marked for temporary retention and can be deleted after decision. Face templates are not retained by the internal provider.

## Invitation Integration

Accepted invitations that do not satisfy the required identity level route to `/identity/verify`. Protected vault access remains denied until server-side verification updates `identity_assurance_states` and eligible grants become `verified`.

## Step-Up Presence

High-risk action requests start a Level 3 `step_up_presence` verification. Fresh presence is valid only inside the configured short TTL and is exposed through `lf_identity_presence_level`.

## Admin Review

`review_required` identity requests appear in the canonical admin verification queue. Admin approve/reject/request-review actions require the existing verification capabilities, reason capture, and audit/event writes. Raw identity images are not displayed by default.

## Security Boundaries

- No 1:N facial recognition.
- No population face database.
- No production “mark verified” bypass.
- No client-supplied verification score or decision is trusted.
- No linked user access to another user’s identity evidence.
- No raw document numbers, biometric templates, JWTs, passwords, or signed evidence URLs in audit metadata.

## Known Limitation

The internal provider uses deterministic experimental UAT checks. Production IDV remains gated on replacing the provider with an approved commercial or regulated verification provider.
