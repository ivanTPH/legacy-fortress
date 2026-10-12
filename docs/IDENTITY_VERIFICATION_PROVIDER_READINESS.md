# Identity Verification Provider Readiness

## Current Boundary

Legacy Fortress calls the provider-neutral `IdentityVerificationProvider` interface in `lib/identity-verification/types.ts`. The current `lf_internal_experimental_v1` implementation is staging/local-only and must never be represented as production identity or biometric verification.

The application persists only the internal decision model: provider key/reference, assurance class, decision, reason codes, confidence metadata, timestamps, retention summary and the related user/invitation/access-grant identifiers. Identity verification remains separate from legal authority, quorum and protected access.

The provider capability contract is intentionally explicit. A commercial adapter must declare document capture and authenticity, liveness, 1:1 face comparison, hosted capture, and signed callback support before the customer flow can represent those capabilities. The internal provider declares these capabilities as unavailable: its document and camera operations are deterministic metadata-only tests, not biometric checks.

## Required Production Adapter Contract

An approved provider adapter must support:

- verification-session creation bound to the authenticated user and exact invitation/access request;
- document type/authenticity and minimum identity-data results;
- live capture, liveness and 1:1 face-comparison results;
- signed provider callbacks with timestamp tolerance, provider event ID and replay/idempotency handling;
- provider decision mapping to `verified`, `failed` or `review_required` and assurance level 2/3;
- bounded timeout, retry, cancellation and duplicate-callback behavior;
- explicit manual-review state where the provider cannot make an automated decision;
- provider reference and evidence-retention/deletion status without persisting raw biometric templates.

Callbacks must resolve the provider reference to an existing request, verify authenticity before persistence, reject unknown or terminal requests, and record the provider event ID exactly once. They must not activate access directly; the existing server-side decision and grant gates remain authoritative.

## Data Minimisation

Raw document and camera objects are temporary evidence in the private identity-verification bucket. Retain decision/audit metadata and provider references only as required by approved policy. Do not place document numbers, MRZ, selfies, biometric templates, raw provider payloads, tokens or signed URLs in logs or audit metadata.

Formal privacy review is still required for special-category biometric processing, lawful basis and condition, transparency notices, retention periods, processor/subprocessor terms, international transfers, deletion guarantees and manual-review operations. This document makes no legal-compliance claim.

## Staging Acceptance Gate

Before enabling a production-capable adapter, prove an invitation-bound hosted journey and negative cases for consent, wrong user, wrong invitation, replayed/expired challenge, failed verification, premature access and cleanup ownership. Use synthetic staging identities only. Commercial provider credentials and production configuration are not present in this repository.

## Provider Recommendation Status

No commercial provider is selected or configured in the repository. The current shortlist should begin with Yoti and Entrust Identity Verification because their current public documentation covers UK-capable identity-document checks, liveness and face matching, browser/mobile capture, sandbox testing and signed/server-side integration patterns. This is an evaluation recommendation, not an implementation or procurement decision. Selection still requires security/privacy review, UK data-residency and retention terms, processor/subprocessor review, support/SLA review, pricing, and a non-production account.

The exact configuration required before enabling a commercial adapter is:

- an approved provider key and adapter implementation behind `IdentityVerificationProvider`;
- server-only provider API credentials and webhook secret;
- provider sandbox workflow/session configuration for document, liveness and face match;
- an allow-listed staging callback URL and provider event-signature settings;
- retention/deletion and privacy configuration approved for biometric evidence;
- invitation/access/estate context binding tests against the provider sandbox.

Until those values exist, the application must fail closed rather than silently substituting the internal provider. The internal provider remains available only in explicitly authorised local/staging environments.
