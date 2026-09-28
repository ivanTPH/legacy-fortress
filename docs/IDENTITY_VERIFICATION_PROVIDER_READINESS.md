# Identity Verification Provider Readiness

## Current Boundary

Legacy Fortress calls the provider-neutral `IdentityVerificationProvider` interface in `lib/identity-verification/types.ts`. The current `lf_internal_experimental_v1` implementation is staging/local-only and must never be represented as production identity or biometric verification.

The application persists only the internal decision model: provider key/reference, assurance class, decision, reason codes, confidence metadata, timestamps, retention summary and the related user/invitation/access-grant identifiers. Identity verification remains separate from legal authority, quorum and protected access.

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
