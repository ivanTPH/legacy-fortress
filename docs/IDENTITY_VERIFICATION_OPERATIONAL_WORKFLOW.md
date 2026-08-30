# Identity Verification Operational Workflow

## Scope

Phase 7 adds an operational staging journey around the existing identity-verification foundation. The internal provider is synthetic and is never evidence of genuine biometric verification. It is enabled only when the explicit internal provider key and a known non-production target are present; production targets fail closed.

## User journey

Authenticated users start a verification for a server-validated purpose. The staging screen lets a tester select passport, driving licence, or national identity document metadata and a deterministic synthetic scenario. Document upload, camera permission/capture, liveness, comparison, processing, and the final decision remain server/provider operations. Browser input cannot submit a trusted decision.

Supported staging scenarios include successful checks, expired or failed documents, document-quality review, face mismatch, liveness review/failure, and provider failure/timeout. Synthetic results are labelled as staging test results.

## Platform review

`/admin/verification` exposes status metadata only: subject display name, purpose, provider, document metadata, liveness category, review reason, timestamps, and reviewer. Reviewers can assign a case, add an append-only note, request a controlled retry, and inspect lifecycle state. There is no identity-verification approve/reject shortcut in the identity queue and no access-activation action.

Review notes are stored separately from immutable verification events. Notes are service-mediated, attributed, timestamped, and must not contain vault, financial, document, or biometric data.

## Provider callback

The callback boundary is `POST /api/identity-verification/callback`. It requires the staging provider key, timestamped HMAC signature, provider reference, provider event ID, and an allow-listed event type. Unknown references, stale signatures, wrong providers, and invalid payloads are rejected. Provider event IDs are unique per provider for replay-safe insertion. Callback metadata is filtered for secrets and raw evidence.

## Assurance and access

L2 verified identity and L3 fresh presence are separate assurance levels. `requireIdentityAssurance` is server-side and purpose-aware. Verification does not establish owner nomination, legal authority, or access permission. Linked access is independently checked and terminal rejected, revoked, or expired access is never resurrected by verification. Estate identity and probate authority remain separate decisions.

## Privacy and retention

Normal APIs and Platform review omit raw documents, selfies, video, MRZ, document numbers, embeddings, and provider payloads. The existing private evidence bucket remains service/owner scoped with cleanup support. Durable records are decision and lifecycle metadata only; retention periods remain policy-controlled rather than indefinite.

## Schema and authorization

Migration `20260830100000_phase7_idv_operational_workflow.sql` adds reviewer assignment/reason metadata, provider event idempotency, and append-only review notes. RLS is enabled on review notes and direct anonymous/authenticated table access is revoked; privileged operations are server-mediated. The migration must be deployed through the normal non-production process before hosted testing.

## Remaining provider-readiness work

Commercial provider selection, camera/document production capture, formal DPIA/legal approval, retention policy approval, provider webhook credentials, and production deployment remain required. The internal provider must not be enabled in production.
